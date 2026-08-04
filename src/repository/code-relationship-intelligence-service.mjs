import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { parseAstSource, SUPPORTED_AST_EXTENSIONS } from './typescript-ast-loader.mjs';

const execFileAsync = promisify(execFile);
const AST_EXTENSIONS = new Set(SUPPORTED_AST_EXTENSIONS);
const DIRECTIONS = new Set(['ancestors', 'descendants', 'both']);
const MAX_LIMIT = 500;
const ISSUE_CONTEXT = /\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?|ref(?:s|erence[sd]?)?|related\s+issue|documents?\s+issue|issue|ticket)\s*[:=-]?\s*((?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#\d+|(?:GH|[A-Z][A-Z0-9]+)-\d+)\b/gi;

function coded(code, message, statusCode = 400, details = {}) {
  return Object.assign(new Error(message), { code, statusCode, ...details });
}

function normalize(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function sha256(value) {
  const encoded = typeof value === 'string' ? value : JSON.stringify(canonical(value));
  return createHash('sha256').update(encoded).digest('hex');
}

function boundedInteger(value, fallback, minimum, maximum, code = 'CODE_RELATIONSHIP_LIMIT_INVALID') {
  const number = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw coded(code, `Expected an integer from ${minimum} to ${maximum}`);
  return number;
}

function issueKey(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^#[0-9]+$/.test(raw)) return raw;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[0-9]+$/.test(raw)) return raw;
  if (/^[A-Za-z][A-Za-z0-9]+-[0-9]+$/.test(raw)) return raw.toUpperCase();
  return null;
}

function issueReferences(text) {
  const source = String(text ?? '');
  const found = [];
  ISSUE_CONTEXT.lastIndex = 0;
  let match;
  while ((match = ISSUE_CONTEXT.exec(source)) !== null) {
    const key = issueKey(match[1]);
    if (key) found.push(Object.freeze({ key, evidence: match[0].slice(0, 300), offset: match.index }));
  }
  return Object.freeze(found);
}

function lineOf(source, offset) {
  return String(source).slice(0, offset).split(/\r?\n/).length;
}

function nodeId(projectId, kind, filePath, name, line) {
  return sha256(`${projectId}\0${kind}\0${filePath}\0${name}\0${line}`);
}

function relationId(projectId, childId, relation, parentName, line) {
  return sha256(`${projectId}\0${childId}\0${relation}\0${parentName}\0${line}`);
}

function issueLinkId(projectId, issue, filePath, line, commitHash, detector) {
  return sha256(`${projectId}\0${issue}\0${filePath}\0${line ?? 0}\0${commitHash ?? ''}\0${detector}`);
}

function resolveRelativeImport(fromPath, specifier, knownPaths) {
  if (!String(specifier).startsWith('.')) return null;
  const base = normalize(path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier)));
  const candidates = [
    base,
    `${base}.mjs`, `${base}.js`, `${base}.cjs`, `${base}.jsx`,
    `${base}.ts`, `${base}.mts`, `${base}.cts`, `${base}.tsx`,
    `${base}/index.mjs`, `${base}/index.js`, `${base}/index.ts`, `${base}/index.tsx`,
  ];
  return candidates.find((candidate) => knownPaths.has(candidate)) ?? null;
}

function expressionName(compiler, expression, sourceFile) {
  if (compiler.isIdentifier(expression)) return expression.text;
  if (compiler.isPropertyAccessExpression(expression)) return expression.getText(sourceFile);
  return expression.getText(sourceFile).trim();
}

function extractAstFile(row, knownPaths, projectId) {
  const parsed = parseAstSource({ path: row.path, source: row.content });
  const { compiler, sourceFile } = parsed;
  const declarations = [];
  const heritage = [];
  const imports = new Map();
  const namespaceImports = new Map();

  const visit = (node) => {
    if (compiler.isImportDeclaration(node) && compiler.isStringLiteral(node.moduleSpecifier)) {
      const targetPath = resolveRelativeImport(row.path, node.moduleSpecifier.text, knownPaths);
      if (targetPath && node.importClause) {
        if (node.importClause.name) imports.set(node.importClause.name.text, Object.freeze({ importedName: 'default', targetPath }));
        const bindings = node.importClause.namedBindings;
        if (bindings && compiler.isNamedImports(bindings)) {
          for (const element of bindings.elements) imports.set(element.name.text, Object.freeze({ importedName: element.propertyName?.text ?? element.name.text, targetPath }));
        } else if (bindings && compiler.isNamespaceImport(bindings)) namespaceImports.set(bindings.name.text, targetPath);
      }
    }

    const declarationKind = compiler.isClassDeclaration(node) ? 'class' : compiler.isInterfaceDeclaration(node) ? 'interface' : null;
    if (declarationKind && node.name?.text) {
      const start = node.getStart(sourceFile, false);
      const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
      const declaration = Object.freeze({
        id: nodeId(projectId, declarationKind, row.path, node.name.text, line),
        kind: declarationKind,
        name: node.name.text,
        path: row.path,
        line,
        endLine: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
        sourceSha256: row.sha256,
        detector: 'typescript-declaration',
        confidence: 'compiler-ast',
      });
      declarations.push(declaration);
      for (const clause of node.heritageClauses ?? []) {
        const relation = clause.token === compiler.SyntaxKind.ImplementsKeyword ? 'implements' : 'extends';
        for (const type of clause.types ?? []) {
          const rawName = expressionName(compiler, type.expression, sourceFile);
          const typeLine = sourceFile.getLineAndCharacterOfPosition(type.getStart(sourceFile, false)).line + 1;
          heritage.push(Object.freeze({ childId: declaration.id, childName: declaration.name, childPath: declaration.path, relation, rawName, line: typeLine }));
        }
      }
    }
    compiler.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze({ compilerVersion: parsed.compilerVersion, declarations: Object.freeze(declarations), heritage: Object.freeze(heritage), imports, namespaceImports });
}

function publicNode(row) {
  return Object.freeze({
    id: row.id,
    kind: row.kind,
    name: row.name,
    path: row.path,
    line: row.line,
    endLine: row.end_line,
    detector: row.detector,
    confidence: row.confidence,
    sourceSha256: row.source_sha256,
  });
}

function publicInheritance(row) {
  return Object.freeze({
    id: row.id,
    relation: row.relation,
    childId: row.child_id,
    parentId: row.parent_id,
    childName: row.child_name,
    parentName: row.parent_name,
    childPath: row.child_path,
    parentPath: row.parent_path,
    line: row.line,
    resolved: row.resolved === 1,
    resolution: row.resolution,
    reason: row.reason,
    detector: row.detector,
    confidence: row.confidence,
  });
}

function publicIssueLink(row) {
  return Object.freeze({
    id: row.id,
    issueKey: row.issue_key,
    path: row.path,
    line: row.line,
    commitHash: row.commit_hash,
    commitAt: row.commit_at,
    detector: row.detector,
    confidence: row.confidence,
    evidence: row.evidence,
    sourceSha256: row.source_sha256,
  });
}

async function gitCommits(workspaceRoot, maxBuffer = 16 * 1024 * 1024) {
  try {
    const { stdout } = await execFileAsync('git', ['log', '--format=@@FORGE_COMMIT@@%H%x09%cI%n%B%n@@FORGE_FILES@@', '--name-only', '--no-renames', '--', '.'], {
      cwd: workspaceRoot,
      timeout: 20_000,
      maxBuffer,
      encoding: 'utf8',
    });
    const commits = [];
    let current = null;
    let mode = 'message';
    const finish = () => {
      if (!current) return;
      commits.push(Object.freeze({ ...current, message: current.messageLines.join('\n').trim(), files: Object.freeze([...new Set(current.files)].sort()) }));
    };
    for (const raw of stdout.split(/\r?\n/)) {
      if (raw.startsWith('@@FORGE_COMMIT@@')) {
        finish();
        const [hash, at] = raw.slice('@@FORGE_COMMIT@@'.length).split('\t');
        current = { hash: String(hash ?? '').trim(), at: String(at ?? '').trim() || null, messageLines: [], files: [] };
        mode = 'message';
        continue;
      }
      if (!current) continue;
      if (raw === '@@FORGE_FILES@@') { mode = 'files'; continue; }
      if (mode === 'message') current.messageLines.push(raw);
      else {
        const filePath = normalize(raw);
        if (filePath) current.files.push(filePath);
      }
    }
    finish();
    return Object.freeze({ available: true, commits: Object.freeze(commits) });
  } catch (error) {
    return Object.freeze({ available: false, commits: Object.freeze([]), error: String(error?.message ?? error).slice(0, 500) });
  }
}

export class CodeRelationshipIntelligenceService {
  constructor({ store, codebaseKnowledge, now = () => new Date().toISOString(), maxGitBytes = 16 * 1024 * 1024 } = {}) {
    if (!store?.db || typeof store.getProject !== 'function') throw new TypeError('CodeRelationshipIntelligenceService requires a StudioStore');
    if (!codebaseKnowledge || typeof codebaseKnowledge.index !== 'function') throw new TypeError('codebaseKnowledge is required');
    this.store = store;
    this.codebaseKnowledge = codebaseKnowledge;
    this.now = now;
    this.maxGitBytes = Math.max(64_000, Number(maxGitBytes) || 16 * 1024 * 1024);
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS code_relationship_nodes(project_id TEXT NOT NULL,id TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,path TEXT NOT NULL,line INTEGER NOT NULL,end_line INTEGER NOT NULL,detector TEXT NOT NULL,confidence TEXT NOT NULL,source_sha256 TEXT NOT NULL,PRIMARY KEY(project_id,id));
      CREATE INDEX IF NOT EXISTS code_relationship_nodes_name ON code_relationship_nodes(project_id,name,path);
      CREATE TABLE IF NOT EXISTS code_relationship_inheritance(project_id TEXT NOT NULL,id TEXT NOT NULL,relation TEXT NOT NULL,child_id TEXT NOT NULL,parent_id TEXT,child_name TEXT NOT NULL,parent_name TEXT NOT NULL,child_path TEXT NOT NULL,parent_path TEXT,line INTEGER NOT NULL,resolved INTEGER NOT NULL,resolution TEXT NOT NULL,reason TEXT,detector TEXT NOT NULL,confidence TEXT NOT NULL,PRIMARY KEY(project_id,id));
      CREATE INDEX IF NOT EXISTS code_relationship_inheritance_child ON code_relationship_inheritance(project_id,child_id,parent_id);
      CREATE TABLE IF NOT EXISTS code_relationship_issue_links(project_id TEXT NOT NULL,id TEXT NOT NULL,issue_key TEXT NOT NULL,path TEXT NOT NULL,line INTEGER,commit_hash TEXT,commit_at TEXT,detector TEXT NOT NULL,confidence TEXT NOT NULL,evidence TEXT NOT NULL,source_sha256 TEXT,PRIMARY KEY(project_id,id));
      CREATE INDEX IF NOT EXISTS code_relationship_issue_key ON code_relationship_issue_links(project_id,issue_key,path);
    `);
  }

  #context({ principalId, projectId } = {}) {
    const principal = String(principalId ?? '').trim();
    if (!principal) throw coded('CODE_RELATIONSHIP_PRINCIPAL_REQUIRED', 'An authenticated principal is required', 401);
    const id = String(projectId ?? '').trim();
    const project = id ? this.store.getProject(id) : null;
    if (!project) throw coded('CODE_RELATIONSHIP_PROJECT_NOT_FOUND', `Unknown project: ${id || '(empty)'}`, 404);
    return Object.freeze({ principalId: principal, projectId: id, project });
  }

  #graphSha256(projectId) {
    const nodes = this.store.db.prepare('SELECT id,kind,name,path,line,source_sha256 FROM code_relationship_nodes WHERE project_id=? ORDER BY id').all(projectId);
    const inheritance = this.store.db.prepare('SELECT id,relation,child_id,parent_id,parent_name,resolved,resolution,reason FROM code_relationship_inheritance WHERE project_id=? ORDER BY id').all(projectId);
    const issues = this.store.db.prepare('SELECT id,issue_key,path,line,commit_hash,detector,source_sha256 FROM code_relationship_issue_links WHERE project_id=? ORDER BY id').all(projectId);
    return sha256({ nodes, inheritance, issues });
  }

  async indexProject(input = {}) {
    const context = this.#context(input);
    const baseIndex = await this.codebaseKnowledge.index(context.project);
    const files = this.store.db.prepare('SELECT path,sha256,content FROM codebase_knowledge_files WHERE project_id=? ORDER BY path').all(context.projectId);
    const knownPaths = new Set(files.map((row) => row.path));
    const astFiles = [];
    const declarations = [];
    const heritage = [];
    let compilerVersion = null;

    for (const row of files) {
      if (!AST_EXTENSIONS.has(path.extname(row.path).toLowerCase())) continue;
      const extracted = extractAstFile(row, knownPaths, context.projectId);
      compilerVersion = extracted.compilerVersion;
      astFiles.push(Object.freeze({ path: row.path, imports: extracted.imports, namespaceImports: extracted.namespaceImports }));
      declarations.push(...extracted.declarations);
      heritage.push(...extracted.heritage);
    }

    const declarationByPathName = new Map(declarations.map((item) => [`${item.path}\0${item.name}`, item]));
    const declarationsByName = new Map();
    for (const item of declarations) {
      if (!declarationsByName.has(item.name)) declarationsByName.set(item.name, []);
      declarationsByName.get(item.name).push(item);
    }
    const astByPath = new Map(astFiles.map((item) => [item.path, item]));
    const inheritance = [];
    for (const item of heritage) {
      const fileContext = astByPath.get(item.childPath);
      let parent = declarationByPathName.get(`${item.childPath}\0${item.rawName}`) ?? null;
      let resolution = parent ? 'same-file' : 'unresolved';
      let reason = null;
      let parentName = item.rawName;
      if (!parent) {
        const namespaceSeparator = item.rawName.indexOf('.');
        if (namespaceSeparator > 0) {
          const namespace = item.rawName.slice(0, namespaceSeparator);
          const importedName = item.rawName.slice(namespaceSeparator + 1);
          const targetPath = fileContext?.namespaceImports.get(namespace);
          if (targetPath) {
            parent = declarationByPathName.get(`${targetPath}\0${importedName}`) ?? null;
            if (parent) { resolution = 'namespace-import'; parentName = parent.name; }
          }
        } else {
          const imported = fileContext?.imports.get(item.rawName);
          if (imported) {
            const expectedName = imported.importedName === 'default' ? item.rawName : imported.importedName;
            parent = declarationByPathName.get(`${imported.targetPath}\0${expectedName}`) ?? null;
            if (parent) { resolution = 'relative-import'; parentName = parent.name; }
          }
        }
      }
      if (!parent) {
        const candidates = declarationsByName.get(item.rawName) ?? [];
        if (candidates.length === 1) { parent = candidates[0]; resolution = 'unique-project-symbol'; parentName = parent.name; }
        else reason = candidates.length > 1 ? 'ambiguous' : 'not-found';
      }
      inheritance.push(Object.freeze({
        id: relationId(context.projectId, item.childId, item.relation, parent?.id ?? item.rawName, item.line),
        relation: item.relation,
        childId: item.childId,
        parentId: parent?.id ?? null,
        childName: item.childName,
        parentName,
        childPath: item.childPath,
        parentPath: parent?.path ?? null,
        line: item.line,
        resolved: Boolean(parent),
        resolution,
        reason,
        detector: 'typescript-heritage-clause',
        confidence: parent ? 'compiler-ast-resolved' : 'compiler-ast-unresolved',
      }));
    }

    const issueLinks = [];
    for (const row of files) {
      const lines = row.content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        for (const reference of issueReferences(lines[index])) {
          issueLinks.push(Object.freeze({
            id: issueLinkId(context.projectId, reference.key, row.path, index + 1, null, 'contextual-source-reference'),
            issueKey: reference.key,
            path: row.path,
            line: index + 1,
            commitHash: null,
            commitAt: null,
            detector: 'contextual-source-reference',
            confidence: 'context-keyword-exact',
            evidence: reference.evidence,
            sourceSha256: row.sha256,
          }));
        }
      }
    }

    const git = await gitCommits(context.project.workspaceRoot, this.maxGitBytes);
    const sourceShaByPath = new Map(files.map((row) => [row.path, row.sha256]));
    for (const commit of git.commits) {
      const references = issueReferences(commit.message);
      if (!references.length) continue;
      for (const filePath of commit.files) {
        if (!knownPaths.has(filePath)) continue;
        for (const reference of references) {
          issueLinks.push(Object.freeze({
            id: issueLinkId(context.projectId, reference.key, filePath, null, commit.hash, 'git-commit-reference'),
            issueKey: reference.key,
            path: filePath,
            line: null,
            commitHash: commit.hash,
            commitAt: commit.at,
            detector: 'git-commit-reference',
            confidence: 'commit-message-changed-file',
            evidence: reference.evidence,
            sourceSha256: sourceShaByPath.get(filePath) ?? null,
          }));
        }
      }
    }

    const uniqueIssues = new Map(issueLinks.map((link) => [link.id, link]));
    const insertNode = this.store.db.prepare('INSERT INTO code_relationship_nodes(project_id,id,kind,name,path,line,end_line,detector,confidence,source_sha256) VALUES(?,?,?,?,?,?,?,?,?,?)');
    const insertInheritance = this.store.db.prepare('INSERT INTO code_relationship_inheritance(project_id,id,relation,child_id,parent_id,child_name,parent_name,child_path,parent_path,line,resolved,resolution,reason,detector,confidence) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const insertIssue = this.store.db.prepare('INSERT INTO code_relationship_issue_links(project_id,id,issue_key,path,line,commit_hash,commit_at,detector,confidence,evidence,source_sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    this.store.transaction(() => {
      this.store.db.prepare('DELETE FROM code_relationship_nodes WHERE project_id=?').run(context.projectId);
      this.store.db.prepare('DELETE FROM code_relationship_inheritance WHERE project_id=?').run(context.projectId);
      this.store.db.prepare('DELETE FROM code_relationship_issue_links WHERE project_id=?').run(context.projectId);
      for (const node of declarations) insertNode.run(context.projectId, node.id, node.kind, node.name, node.path, node.line, node.endLine, node.detector, node.confidence, node.sourceSha256);
      for (const edge of inheritance) insertInheritance.run(context.projectId, edge.id, edge.relation, edge.childId, edge.parentId, edge.childName, edge.parentName, edge.childPath, edge.parentPath, edge.line, edge.resolved ? 1 : 0, edge.resolution, edge.reason, edge.detector, edge.confidence);
      for (const link of uniqueIssues.values()) insertIssue.run(context.projectId, link.id, link.issueKey, link.path, link.line, link.commitHash, link.commitAt, link.detector, link.confidence, link.evidence, link.sourceSha256);
    });

    const graphSha256 = this.#graphSha256(context.projectId);
    const payload = {
      schema: 'forge.code-relationship-index.v1',
      principalId: context.principalId,
      projectId: context.projectId,
      compiler: compilerVersion ? `typescript@${compilerVersion}` : null,
      indexedAt: this.now(),
      sourceIndexSha256: baseIndex.graphSha256 ?? null,
      inheritance: Object.freeze({ nodes: declarations.length, resolved: inheritance.filter((item) => item.resolved).length, unresolved: inheritance.filter((item) => !item.resolved).length }),
      issues: Object.freeze({ keys: new Set([...uniqueIssues.values()].map((item) => item.issueKey)).size, links: uniqueIssues.size, gitAvailable: git.available }),
      graphSha256,
    };
    return Object.freeze({ ...payload, receiptSha256: sha256(payload) });
  }

  inheritance(input = {}) {
    const context = this.#context(input);
    const limit = boundedInteger(input.limit, 200, 1, MAX_LIMIT);
    const depth = boundedInteger(input.depth, 4, 0, 12, 'CODE_RELATIONSHIP_DEPTH_INVALID');
    const direction = String(input.direction ?? 'both').trim();
    if (!DIRECTIONS.has(direction)) throw coded('CODE_RELATIONSHIP_DIRECTION_INVALID', `Unsupported inheritance direction: ${direction}`);
    const pathFilter = input.path == null || String(input.path).trim() === '' ? null : normalize(input.path);
    const allNodes = this.store.db.prepare('SELECT * FROM code_relationship_nodes WHERE project_id=? ORDER BY path,line,name').all(context.projectId).map(publicNode);
    const allEdges = this.store.db.prepare('SELECT * FROM code_relationship_inheritance WHERE project_id=? ORDER BY child_path,line,parent_name').all(context.projectId).map(publicInheritance);
    const nodesById = new Map(allNodes.map((node) => [node.id, node]));
    const rootName = String(input.root ?? '').trim();
    let selectedIds = new Set(allNodes.map((node) => node.id));
    let root = null;
    if (rootName) {
      const candidates = allNodes.filter((node) => node.name === rootName && (!pathFilter || node.path === pathFilter));
      if (!candidates.length) throw coded('CODE_RELATIONSHIP_ROOT_NOT_FOUND', `Unknown inheritance root: ${rootName}`, 404);
      if (candidates.length > 1) throw coded('CODE_RELATIONSHIP_ROOT_AMBIGUOUS', `Inheritance root is ambiguous: ${rootName}`, 409);
      root = candidates[0];
      selectedIds = new Set([root.id]);
      const distance = new Map([[root.id, 0]]);
      const queue = [root.id];
      while (queue.length) {
        const current = queue.shift();
        const currentDepth = distance.get(current);
        if (currentDepth >= depth) continue;
        const neighbors = new Set();
        for (const edge of allEdges) {
          if (!edge.resolved) continue;
          if (direction !== 'descendants' && edge.childId === current && edge.parentId) neighbors.add(edge.parentId);
          if (direction !== 'ancestors' && edge.parentId === current) neighbors.add(edge.childId);
        }
        for (const next of neighbors) {
          if (!distance.has(next)) { distance.set(next, currentDepth + 1); selectedIds.add(next); queue.push(next); }
        }
      }
    } else if (pathFilter) selectedIds = new Set(allNodes.filter((node) => node.path.startsWith(pathFilter)).map((node) => node.id));

    const nodes = allNodes.filter((node) => selectedIds.has(node.id)).slice(0, limit);
    const boundedIds = new Set(nodes.map((node) => node.id));
    const edges = allEdges.filter((edge) => edge.resolved && boundedIds.has(edge.childId) && boundedIds.has(edge.parentId)).slice(0, limit * 4);
    const unresolved = allEdges.filter((edge) => !edge.resolved && boundedIds.has(edge.childId)).slice(0, limit * 2);
    const payload = {
      schema: 'forge.inheritance-graph.v1',
      principalId: context.principalId,
      projectId: context.projectId,
      compiler: 'typescript@5.8.3',
      root,
      direction,
      depth,
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      unresolved: Object.freeze(unresolved),
      graphSha256: this.#graphSha256(context.projectId),
    };
    return Object.freeze({ ...payload, receiptSha256: sha256(payload) });
  }

  issues(input = {}) {
    const context = this.#context(input);
    const limit = boundedInteger(input.limit, 200, 1, MAX_LIMIT);
    const requestedIssue = input.issueKey == null || String(input.issueKey).trim() === '' ? null : issueKey(input.issueKey);
    if (input.issueKey != null && String(input.issueKey).trim() !== '' && !requestedIssue) throw coded('CODE_RELATIONSHIP_ISSUE_KEY_INVALID', 'Issue key must be #123, owner/repo#123, or ABC-123');
    const pathPrefix = input.pathPrefix == null || String(input.pathPrefix).trim() === '' ? null : normalize(input.pathPrefix);
    const rows = this.store.db.prepare('SELECT * FROM code_relationship_issue_links WHERE project_id=? ORDER BY issue_key,path,COALESCE(line,0),COALESCE(commit_hash,\'\')').all(context.projectId)
      .map(publicIssueLink)
      .filter((link) => (!requestedIssue || link.issueKey === requestedIssue) && (!pathPrefix || link.path.startsWith(pathPrefix)))
      .slice(0, limit);
    const grouped = new Map();
    for (const link of rows) {
      const current = grouped.get(link.issueKey) ?? { key: link.issueKey, linkCount: 0, sourceLinks: 0, commitLinks: 0, paths: new Set() };
      current.linkCount += 1;
      current.paths.add(link.path);
      if (link.commitHash) current.commitLinks += 1;
      else current.sourceLinks += 1;
      grouped.set(link.issueKey, current);
    }
    const issues = [...grouped.values()].sort((left, right) => left.key.localeCompare(right.key)).map((item) => Object.freeze({ key: item.key, linkCount: item.linkCount, sourceLinks: item.sourceLinks, commitLinks: item.commitLinks, paths: Object.freeze([...item.paths].sort()) }));
    const payload = {
      schema: 'forge.issue-code-index.v1',
      principalId: context.principalId,
      projectId: context.projectId,
      filters: Object.freeze({ issueKey: requestedIssue, pathPrefix, limit }),
      issues: Object.freeze(issues),
      links: Object.freeze(rows),
      graphSha256: this.#graphSha256(context.projectId),
    };
    return Object.freeze({ ...payload, receiptSha256: sha256(payload) });
  }
}
