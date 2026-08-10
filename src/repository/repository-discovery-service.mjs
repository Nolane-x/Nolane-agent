import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { enumerateRepositoryFiles } from './repository-file-enumerator.mjs';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const execFileAsync = promisify(execFile);

const MAX_FILE_BYTES = 1_000_000;
const MAX_SOURCE_FILES = 600;
const SKIP_DIRS = new Set(['.git', '.forge', '.forgeos-data', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', '__pycache__', 'target', 'vendor']);
const SECRET_PATH = /(^|\/)(?:\.env(?:\.(?!example$|sample$|template$|dist$|defaults$)[^/]*)?|\.npmrc|\.pypirc|credentials?(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx))$/i;
const ENV_TEMPLATE = /(^|\/)\.env\.(?:example|sample|template|dist|defaults)$/i;
const SOURCE_EXTENSIONS = new Map([
  ['.js', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'], ['.jsx', 'javascript'],
  ['.ts', 'typescript'], ['.mts', 'typescript'], ['.cts', 'typescript'], ['.tsx', 'typescript'],
  ['.py', 'python'], ['.go', 'go'], ['.rs', 'rust'], ['.java', 'java'], ['.kt', 'kotlin'],
  ['.c', 'c'], ['.h', 'c'], ['.cpp', 'cpp'], ['.hpp', 'cpp'], ['.cs', 'csharp'],
  ['.rb', 'ruby'], ['.php', 'php'], ['.swift', 'swift'], ['.scala', 'scala'], ['.sql', 'sql'],
]);
const KNOWN_CONFIGS = new Set([
  'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb',
  'pyproject.toml', 'requirements.txt', 'poetry.lock', 'Pipfile', 'setup.py', 'setup.cfg', 'tox.ini',
  'go.mod', 'go.work', 'Cargo.toml', 'rust-toolchain.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
  'tsconfig.json', 'jsconfig.json', 'vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'webpack.config.js', 'rollup.config.js',
  'eslint.config.js', 'eslint.config.mjs', '.eslintrc', '.eslintrc.json', '.prettierrc', '.prettierrc.json',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml',
  'README.md', 'ARCHITECTURE.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CONTRIBUTING.md',
]);

const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const clip = (value, max = 500) => String(value ?? '').slice(0, max);
const unique = (values) => [...new Set(values.filter(Boolean))];
function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}
function isSecret(relative) { return SECRET_PATH.test(normalize(relative)); }
function isSkipped(relative) { return normalize(relative).split('/').some((part) => SKIP_DIRS.has(part)); }
function lineFor(content, needle) {
  const lines = String(content ?? '').split(/\r?\n/);
  const matcher = needle instanceof RegExp ? needle : new RegExp(String(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const index = lines.findIndex((line) => matcher.test(line));
  return index < 0 ? 1 : index + 1;
}
function evidence(record, needle = null, detector = 'repository-discovery') {
  const line = needle == null ? 1 : lineFor(record.content, needle);
  return freeze({ path: record.path, startLine: line, endLine: line, sha256: record.sha256, detector });
}
function finding(id, label, evidenceItems, confidence = 1, detail = null) {
  return freeze({ id, label, confidence, ...(detail == null ? {} : { detail }), evidence: freeze(evidenceItems) });
}
function commandFinding(command, source) {
  return command ? freeze({ status: 'detected', command: clip(command, 1_000), evidence: freeze([source]) }) : freeze({ status: 'unknown', command: null, evidence: freeze([]) });
}
async function gitState(root) {
  try {
    // Probe repository membership before launching the metadata calls. In a
    // temporary/non-git workspace, starting all three commands concurrently
    // can leave Windows child processes alive long enough to lock the fixture
    // directory during cleanup.
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, timeout: 10_000, maxBuffer: 128_000 });
    const { stdout: head } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root, timeout: 10_000, maxBuffer: 128_000 });
    const { stdout: branch } = await execFileAsync('git', ['branch', '--show-current'], { cwd: root, timeout: 10_000, maxBuffer: 128_000 });
    const { stdout: statusText } = await execFileAsync('git', ['status', '--porcelain=v1', '-z'], { cwd: root, encoding: 'buffer', timeout: 10_000, maxBuffer: 4_000_000 });
    const entries = statusText.toString('utf8').split('\0').filter(Boolean);
    const changedPaths = []; const untrackedPaths = [];
    for (const entry of entries) {
      const code = entry.slice(0, 2); const filePath = normalize(entry.slice(3));
      if (!filePath || isSecret(filePath)) continue;
      changedPaths.push(filePath); if (code === '??') untrackedPaths.push(filePath);
    }
    return freeze({ isGitRepository: true, clean: changedPaths.length === 0, branch: clip(branch.trim(), 200), head: clip(head.trim(), 64), changedPaths: freeze(changedPaths.slice(0, 500)), untrackedPaths: freeze(untrackedPaths.slice(0, 500)) });
  } catch {
    return freeze({ isGitRepository: false, clean: null, branch: null, head: null, changedPaths: freeze([]), untrackedPaths: freeze([]) });
  }
}
function packageData(record) {
  if (!record) return null;
  try { return JSON.parse(record.content); } catch { return null; }
}
function dependencyMap(pkg) { return { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}), ...(pkg?.peerDependencies ?? {}) }; }
function packageEvidence(record, name) { return evidence(record, new RegExp(`"${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i'), 'package-manifest'); }
function pathEvidence(record, detector = 'path-pattern') { return evidence(record, null, detector); }
function configRecords(records, predicate) { return [...records.values()].filter((record) => predicate(record.path, record)); }
function detectArchitecture(files, records) {
  const ids = [];
  const add = (id, label, paths, confidence = 0.85) => {
    const found = paths.map((candidate) => records.get(candidate)).filter(Boolean);
    if (found.length) ids.push(finding(id, label, found.map((record) => pathEvidence(record, 'architecture-layout')), confidence));
  };
  add('layered', 'Layered architecture', ['src/controllers/index.ts', 'src/services/index.ts', 'src/repositories/index.ts']);
  const grouped = ['controllers', 'services', 'repositories'].filter((name) => files.some((file) => file.split('/').includes(name)));
  if (grouped.length >= 2) {
    const found = files.filter((file) => grouped.some((name) => file.split('/').includes(name))).slice(0, 3).map((file) => records.get(file)).filter(Boolean);
    ids.push(finding('layered', 'Layered architecture', found.map((record) => pathEvidence(record, 'architecture-layout')), 0.9));
  }
  if (files.some((file) => /(^|\/)apps\//.test(file)) && files.some((file) => /(^|\/)packages\//.test(file))) {
    const found = files.filter((file) => /^(apps|packages)\//.test(file)).slice(0, 4).map((file) => records.get(file)).filter(Boolean);
    ids.push(finding('workspace-monorepo', 'Workspace monorepo', found.map((record) => pathEvidence(record, 'architecture-layout')), 0.95));
  }
  const readme = records.get('ARCHITECTURE.md') ?? records.get('README.md');
  if (readme && /layered architecture|hexagonal|clean architecture|event[- ]driven|microservice|modular monolith/i.test(readme.content)) {
    const match = readme.content.match(/layered architecture|hexagonal|clean architecture|event[- ]driven|microservice|modular monolith/i)?.[0] ?? 'architecture';
    ids.push(finding(normalize(match).replace(/\s+/g, '-'), match, [evidence(readme, match, 'architecture-document')], 0.8));
  }
  return uniqueById(ids);
}
function uniqueById(items) {
  const map = new Map();
  for (const item of items) if (!map.has(item.id)) map.set(item.id, item);
  return freeze([...map.values()].sort((a, b) => a.id.localeCompare(b.id)));
}

export class RepositoryDiscoveryService {
  constructor({ version, store, clock = () => new Date().toISOString(), maxFileBytes = MAX_FILE_BYTES, maxSourceFiles = MAX_SOURCE_FILES } = {}) {
    if (!store?.getProject) throw new TypeError('RepositoryDiscoveryService requires a project store');
    this.version = String(version ?? '0.0.0'); this.store = store; this.clock = clock;
    this.maxFileBytes = Math.max(4_096, Number(maxFileBytes) || MAX_FILE_BYTES);
    this.maxSourceFiles = Math.max(20, Number(maxSourceFiles) || MAX_SOURCE_FILES);
    this.cache = new Map();
  }

  async snapshot({ projectId, principalId, refresh = false } = {}) {
    const id = String(projectId ?? '').trim(); if (!id) throw new TypeError('projectId is required');
    const principal = String(principalId ?? '').trim(); if (!principal) throw new TypeError('principalId is required');
    const project = this.store.getProject(id); if (!project) throw Object.assign(new Error(`Unknown project: ${id}`), { statusCode: 404 });
    if (!refresh && this.cache.has(id)) return this.cache.get(id);
    const root = path.resolve(project.workspaceRoot);
    const enumeration = await enumerateRepositoryFiles(root, { maxFiles: 20_000, skipDirs: SKIP_DIRS });
    const files = enumeration.files.filter((file) => !isSecret(file) && !isSkipped(file));
    const selected = new Set();
    for (const file of files) {
      const base = path.posix.basename(file);
      if (KNOWN_CONFIGS.has(file) || KNOWN_CONFIGS.has(base) || file.startsWith('.github/workflows/') || ENV_TEMPLATE.test(file) || /(^|\/)(?:migrations?|db\/migrate|prisma\/migrations)\//i.test(file) || SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) selected.add(file);
    }
    const sourceCandidates = [...selected].filter((file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())).slice(0, this.maxSourceFiles);
    const mustRead = unique([[...selected].filter((file) => !SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())), sourceCandidates].flat());
    const records = new Map();
    for (const relative of mustRead) {
      const absolute = path.resolve(root, relative); const rel = path.relative(root, absolute);
      if (rel.startsWith('..') || path.isAbsolute(rel) || isSecret(relative)) continue;
      let info; try { info = await stat(absolute); } catch { continue; }
      if (!info.isFile() || info.size > this.maxFileBytes) continue;
      const buffer = await readFile(absolute); if (buffer.includes(0)) continue;
      const content = buffer.toString('utf8'); records.set(relative, { path: relative, content, sha256: sha256(buffer), bytes: buffer.length });
    }

    const packageRecord = records.get('package.json'); const pkg = packageData(packageRecord); const deps = dependencyMap(pkg);
    const languages = uniqueById(files.map((file) => {
      const language = SOURCE_EXTENSIONS.get(path.extname(file).toLowerCase()); const record = records.get(file);
      return language && record ? finding(language, language, [pathEvidence(record, 'language-extension')], 1) : null;
    }).filter(Boolean));

    const frameworks = [];
    const frameworkDeps = [['express', 'Express'], ['react', 'React'], ['next', 'Next.js'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['@nestjs/core', 'NestJS'], ['fastify', 'Fastify'], ['electron', 'Electron'], ['django', 'Django'], ['fastapi', 'FastAPI'], ['flask', 'Flask'], ['spring-boot', 'Spring Boot']];
    for (const [dep, label] of frameworkDeps) if (packageRecord && Object.hasOwn(deps, dep)) frameworks.push(finding(dep, label, [packageEvidence(packageRecord, dep)], 1));
    const pythonText = [records.get('pyproject.toml')?.content, records.get('requirements.txt')?.content].filter(Boolean).join('\n');
    for (const [idValue, label, regex] of [['django', 'Django', /\bdjango\b/i], ['fastapi', 'FastAPI', /\bfastapi\b/i], ['flask', 'Flask', /\bflask\b/i]]) {
      const source = records.get('pyproject.toml') ?? records.get('requirements.txt');
      if (source && regex.test(pythonText)) frameworks.push(finding(idValue, label, [evidence(source, regex, 'python-manifest')], 1));
    }

    const packageManagers = [];
    if (packageRecord) {
      const declared = String(pkg?.packageManager ?? '').split('@')[0];
      if (declared) packageManagers.push(finding(declared, declared, [packageEvidence(packageRecord, 'packageManager')], 1));
      else if (records.has('pnpm-lock.yaml')) packageManagers.push(finding('pnpm', 'pnpm', [pathEvidence(records.get('pnpm-lock.yaml'))], 1));
      else if (records.has('yarn.lock')) packageManagers.push(finding('yarn', 'Yarn', [pathEvidence(records.get('yarn.lock'))], 1));
      else if (records.has('package-lock.json')) packageManagers.push(finding('npm', 'npm', [pathEvidence(records.get('package-lock.json'))], 1));
      else packageManagers.push(finding('npm', 'npm', [pathEvidence(packageRecord, 'package-manifest')], 0.85));
    }
    if (records.has('pyproject.toml')) packageManagers.push(finding(records.has('poetry.lock') ? 'poetry' : 'python-project', records.has('poetry.lock') ? 'Poetry' : 'Python project', [pathEvidence(records.get('pyproject.toml'))], 0.95));
    if (records.has('go.mod')) packageManagers.push(finding('go-modules', 'Go modules', [pathEvidence(records.get('go.mod'))], 1));
    if (records.has('Cargo.toml')) packageManagers.push(finding('cargo', 'Cargo', [pathEvidence(records.get('Cargo.toml'))], 1));

    const buildSystems = []; const testRunners = []; const linters = []; const formatters = []; const typeCheckers = [];
    const hasDep = (name) => packageRecord && Object.hasOwn(deps, name);
    for (const [idValue, label, detector] of [['vite', 'Vite', () => hasDep('vite') || records.has('vite.config.ts') || records.has('vite.config.js')], ['webpack', 'webpack', () => hasDep('webpack') || records.has('webpack.config.js')], ['typescript', 'TypeScript build', () => records.has('tsconfig.json')]]) if (detector()) buildSystems.push(finding(idValue, label, [packageRecord && hasDep(idValue) ? packageEvidence(packageRecord, idValue) : pathEvidence(records.get(idValue === 'typescript' ? 'tsconfig.json' : `${idValue}.config.ts`) ?? records.get(`${idValue}.config.js`))].filter(Boolean), 1));
    if (records.has('go.mod')) buildSystems.push(finding('go', 'Go toolchain', [pathEvidence(records.get('go.mod'))], 1));
    if (records.has('Cargo.toml')) buildSystems.push(finding('cargo', 'Cargo', [pathEvidence(records.get('Cargo.toml'))], 1));
    const scripts = pkg?.scripts ?? {};
    for (const [idValue, label, regex] of [['vitest', 'Vitest', /\bvitest\b/i], ['jest', 'Jest', /\bjest\b/i], ['mocha', 'Mocha', /\bmocha\b/i], ['node-test', 'Node test runner', /node\s+--test/i]]) if (packageRecord && (hasDep(idValue) || regex.test(String(scripts.test ?? '')))) testRunners.push(finding(idValue, label, [packageEvidence(packageRecord, hasDep(idValue) ? idValue : 'test')], 1));
    const pyManifest = records.get('pyproject.toml') ?? records.get('requirements.txt'); if (pyManifest && /\bpytest\b/i.test(pyManifest.content)) testRunners.push(finding('pytest', 'pytest', [evidence(pyManifest, /\bpytest\b/i, 'python-manifest')], 1));
    if (records.has('go.mod')) testRunners.push(finding('go-test', 'go test', [pathEvidence(records.get('go.mod'))], 1));
    if (records.has('Cargo.toml')) testRunners.push(finding('cargo-test', 'cargo test', [pathEvidence(records.get('Cargo.toml'))], 1));
    for (const [idValue, label, scriptKey] of [['eslint', 'ESLint', 'lint'], ['prettier', 'Prettier', 'format'], ['typescript', 'TypeScript', 'typecheck']]) {
      const target = idValue === 'typescript' ? typeCheckers : idValue === 'eslint' ? linters : formatters;
      if (packageRecord && (hasDep(idValue) || new RegExp(idValue, 'i').test(String(scripts[scriptKey] ?? '')))) target.push(finding(idValue, label, [packageEvidence(packageRecord, hasDep(idValue) ? idValue : scriptKey)], 1));
    }
    if (pyManifest && /\b(?:ruff|flake8|pylint)\b/i.test(pyManifest.content)) linters.push(finding('python-linter', 'Python linter', [evidence(pyManifest, /\b(?:ruff|flake8|pylint)\b/i, 'python-manifest')], 0.95));
    if (pyManifest && /\b(?:black|ruff)\b/i.test(pyManifest.content)) formatters.push(finding('python-formatter', 'Python formatter', [evidence(pyManifest, /\b(?:black|ruff)\b/i, 'python-manifest')], 0.95));
    if (pyManifest && /\b(?:mypy|pyright)\b/i.test(pyManifest.content)) typeCheckers.push(finding('python-types', 'Python type checker', [evidence(pyManifest, /\b(?:mypy|pyright)\b/i, 'python-manifest')], 0.95));

    const workspaces = Array.isArray(pkg?.workspaces) ? pkg.workspaces.map(String) : Array.isArray(pkg?.workspaces?.packages) ? pkg.workspaces.packages.map(String) : [];
    const workspaceRecord = records.get('pnpm-workspace.yaml');
    if (!workspaces.length && workspaceRecord) for (const match of workspaceRecord.content.matchAll(/^\s*-\s+([^#\n]+)$/gm)) workspaces.push(match[1].trim());
    const monorepo = freeze({ detected: workspaces.length > 0 || records.has('go.work') || files.some((file) => /^apps\//.test(file)) && files.some((file) => /^packages\//.test(file)), workspaces: freeze(unique(workspaces).sort()), evidence: freeze([packageRecord && pkg?.workspaces ? packageEvidence(packageRecord, 'workspaces') : null, workspaceRecord ? pathEvidence(workspaceRecord) : null, records.get('go.work') ? pathEvidence(records.get('go.work')) : null].filter(Boolean)) });

    const entryPoints = [];
    const addEntry = (candidate, reason, source = records.get(candidate)) => { if (candidate && files.includes(candidate) && source) entryPoints.push(freeze({ path: candidate, reason, evidence: freeze([pathEvidence(source, 'entry-point')]) })); };
    if (typeof pkg?.main === 'string') addEntry(normalize(pkg.main), 'package-main', packageRecord ? evidence(packageRecord, 'main', 'package-manifest') : null);
    for (const candidate of ['src/index.ts', 'src/index.js', 'src/index.mjs', 'src/main.ts', 'src/main.js', 'src/server.ts', 'src/server.js', 'src/server.mjs', 'main.py', 'app.py', 'cmd/main.go', 'src/main.rs']) addEntry(candidate, 'conventional-entry');

    const ciWorkflows = configRecords(records, (file) => file.startsWith('.github/workflows/') || /^\.gitlab-ci\.yml$|^azure-pipelines\.yml$|^Jenkinsfile$/i.test(file)).map((record) => freeze({ path: record.path, evidence: freeze([pathEvidence(record, 'ci-workflow')]) }));
    const containerFiles = configRecords(records, (file) => /(^|\/)(?:Dockerfile(?:\.[^/]*)?|docker-compose\.ya?ml|compose\.ya?ml)$/i.test(file)).map((record) => freeze({ path: record.path, evidence: freeze([pathEvidence(record, 'container-config')]) }));
    const migrations = configRecords(records, (file) => /(^|\/)(?:migrations?|db\/migrate|prisma\/migrations)\//i.test(file)).map((record) => freeze({ path: record.path, evidence: freeze([pathEvidence(record, 'migration-path')]) })).slice(0, 100);

    const databases = [];
    const databaseSignals = [['postgresql', 'PostgreSQL', /\b(?:pg|postgres|postgresql)\b/i], ['mysql', 'MySQL', /\b(?:mysql|mysql2|mariadb)\b/i], ['sqlite', 'SQLite', /\b(?:sqlite|better-sqlite3)\b/i], ['mongodb', 'MongoDB', /\b(?:mongodb|mongoose)\b/i], ['redis', 'Redis', /\bredis\b/i]];
    const databaseSources = [packageRecord, ...containerFiles.map((item) => records.get(item.path)), records.get('pyproject.toml'), records.get('requirements.txt'), records.get('go.mod'), records.get('Cargo.toml')].filter(Boolean);
    for (const [idValue, label, regex] of databaseSignals) {
      const source = databaseSources.find((record) => regex.test(record.content));
      if (source) databases.push(finding(idValue, label, [evidence(source, regex, 'database-signal')], 0.95));
    }

    const sourceRecords = sourceCandidates.map((file) => records.get(file)).filter(Boolean);
    const apiStyles = [];
    const restSource = sourceRecords.find((record) => /\.(?:get|post|put|patch|delete)\s*\(|@(Get|Post|Put|Patch|Delete)\b|router\.(?:get|post|put|patch|delete)/.test(record.content));
    if (restSource) apiStyles.push(finding('rest', 'REST/HTTP routes', [evidence(restSource, /\.(?:get|post|put|patch|delete)\s*\(|@(Get|Post|Put|Patch|Delete)\b|router\.(?:get|post|put|patch|delete)/, 'api-style')], 0.95));
    const graphqlSource = sourceRecords.find((record) => /\b(?:graphql|typeDefs|gql`)\b/i.test(record.content));
    if (graphqlSource) apiStyles.push(finding('graphql', 'GraphQL', [evidence(graphqlSource, /\b(?:graphql|typeDefs|gql`)\b/i, 'api-style')], 0.95));
    const grpcSource = sourceRecords.find((record) => /\bgrpc\b|\.proto\b/i.test(record.content));
    if (grpcSource) apiStyles.push(finding('grpc', 'gRPC', [evidence(grpcSource, /\bgrpc\b|\.proto\b/i, 'api-style')], 0.9));

    const generatedPaths = unique(files.filter((file) => /(^|\/)(?:generated|gen|dist|build|coverage|\.next)(\/|$)/i.test(file)).map((file) => {
      const match = file.match(/^(.*?(?:generated|gen|dist|build|coverage|\.next))(?:\/|$)/i); return match?.[1];
    })).sort();
    const vendorPaths = unique(files.filter((file) => /(^|\/)(?:vendor|third_party)(\/|$)/i.test(file)).map((file) => file.split('/').slice(0, file.split('/').findIndex((part) => /^(?:vendor|third_party)$/i.test(part)) + 1).join('/'))).sort();

    const envVars = [];
    for (const record of configRecords(records, (file) => ENV_TEMPLATE.test(file))) {
      for (let index = 0; index < record.content.split(/\r?\n/).length; index += 1) {
        const match = record.content.split(/\r?\n/)[index].match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
        if (match) envVars.push(freeze({ name: match[1], evidence: freeze([{ path: record.path, startLine: index + 1, endLine: index + 1, sha256: record.sha256, detector: 'environment-template' }]) }));
      }
    }
    const environmentVariables = freeze([...new Map(envVars.map((item) => [item.name, item])).values()].sort((a, b) => a.name.localeCompare(b.name)));
    const agentDocumentation = configRecords(records, (file) => /(^|\/)(?:AGENTS|CLAUDE|GEMINI)\.md$/i.test(file) || /(^|\/)\.github\/copilot-instructions\.md$/i.test(file)).map((record) => freeze({ path: record.path, evidence: freeze([pathEvidence(record, 'agent-documentation')]) }));

    const commands = {
      dev: commandFinding(scripts.dev ?? scripts.start ?? null, packageRecord ? packageEvidence(packageRecord, scripts.dev ? 'dev' : 'start') : null),
      build: commandFinding(scripts.build ?? (records.has('go.mod') ? 'go build ./...' : records.has('Cargo.toml') ? 'cargo build' : null), packageRecord && scripts.build ? packageEvidence(packageRecord, 'build') : records.has('go.mod') ? pathEvidence(records.get('go.mod')) : records.has('Cargo.toml') ? pathEvidence(records.get('Cargo.toml')) : null),
      test: commandFinding(scripts.test ?? (records.has('go.mod') ? 'go test ./...' : records.has('Cargo.toml') ? 'cargo test' : pyManifest && /pytest/i.test(pyManifest.content) ? 'pytest' : null), packageRecord && scripts.test ? packageEvidence(packageRecord, 'test') : records.has('go.mod') ? pathEvidence(records.get('go.mod')) : records.has('Cargo.toml') ? pathEvidence(records.get('Cargo.toml')) : pyManifest ? evidence(pyManifest, /pytest/i, 'python-manifest') : null),
      lint: commandFinding(scripts.lint ?? null, packageRecord && scripts.lint ? packageEvidence(packageRecord, 'lint') : null),
      format: commandFinding(scripts.format ?? null, packageRecord && scripts.format ? packageEvidence(packageRecord, 'format') : null),
      typecheck: commandFinding(scripts.typecheck ?? scripts['type-check'] ?? null, packageRecord && (scripts.typecheck || scripts['type-check']) ? packageEvidence(packageRecord, scripts.typecheck ? 'typecheck' : 'type-check') : null),
      deploy: commandFinding(scripts.deploy ?? null, packageRecord && scripts.deploy ? packageEvidence(packageRecord, 'deploy') : null),
    };
    const cleanliness = await gitState(root);
    const architecture = detectArchitecture(files, records);
    const namingConventions = [];
    const sourceNames = files.filter((file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())).map((file) => path.posix.basename(file, path.extname(file)));
    if (sourceNames.length) {
      const kebab = sourceNames.filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(name)).length;
      const camel = sourceNames.filter((name) => /^[a-z][A-Za-z0-9]*$/.test(name) && /[A-Z]/.test(name)).length;
      const snake = sourceNames.filter((name) => /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(name)).length;
      const [idValue, label, count] = [['kebab-case', 'kebab-case', kebab], ['camelCase', 'camelCase', camel], ['snake_case', 'snake_case', snake]].sort((a, b) => b[2] - a[2])[0];
      if (count > 0) {
        const sample = files.find((file) => path.posix.basename(file, path.extname(file)).includes(idValue === 'kebab-case' ? '-' : idValue === 'snake_case' ? '_' : ''));
        const record = sample ? records.get(sample) : null;
        if (record) namingConventions.push(finding(idValue, label, [pathEvidence(record, 'naming-convention')], Math.min(0.95, 0.5 + count / Math.max(1, sourceNames.length))));
      }
    }

    const unknowns = [];
    if (!frameworks.length) unknowns.push('framework');
    if (!testRunners.length) unknowns.push('test-runner');
    if (!linters.length) unknowns.push('linter');
    if (!formatters.length) unknowns.push('formatter');
    if (!typeCheckers.length) unknowns.push('type-checker');
    if (!apiStyles.length) unknowns.push('api-style');
    if (!architecture.length) unknowns.push('architecture');
    if (!databases.length) unknowns.push('database');
    if (!entryPoints.length) unknowns.push('entry-point');
    const configs = configRecords(records, (file) => KNOWN_CONFIGS.has(file) || KNOWN_CONFIGS.has(path.posix.basename(file))).map((record) => freeze({ path: record.path, evidence: freeze([pathEvidence(record, 'configuration-file')]) }));
    const publicPayload = {
      schema: 'forge.repository-discovery.v1', version: this.version, projectId: id, generatedAt: this.clock(), principalId: principal,
      summary: freeze({ filesObserved: files.length, filesRead: records.size, evidenceItems: [...records.values()].length, unknowns: unknowns.length, clean: cleanliness.clean, discoveryMode: enumeration.mode, warnings: enumeration.warnings, enumerationReceiptSha256: enumeration.receiptSha256 }),
      languages, frameworks: uniqueById(frameworks), packageManagers: uniqueById(packageManagers), buildSystems: uniqueById(buildSystems), testRunners: uniqueById(testRunners),
      formatters: uniqueById(formatters), linters: uniqueById(linters), typeCheckers: uniqueById(typeCheckers), monorepo,
      entryPoints: freeze(uniqueByPath(entryPoints)), configs: freeze(uniqueByPath(configs)), ci: freeze({ workflows: freeze(uniqueByPath(ciWorkflows)) }),
      containers: freeze({ files: freeze(uniqueByPath(containerFiles)) }), migrations: freeze(uniqueByPath(migrations)), databases: uniqueById(databases), apiStyles: uniqueById(apiStyles),
      namingConventions: uniqueById(namingConventions), architecture, generatedPaths: freeze(generatedPaths), vendorPaths: freeze(vendorPaths), commands: freeze(commands),
      environmentVariables, agentDocumentation: freeze(uniqueByPath(agentDocumentation)), cleanliness, unknowns: freeze(unknowns.sort()),
    };
    const result = freeze({ ...publicPayload, receiptSha256: canonicalSha256(publicPayload) });
    this.cache.set(id, result); return result;
  }
}

function uniqueByPath(items) {
  const map = new Map();
  for (const item of items) if (item?.path && !map.has(item.path)) map.set(item.path, item);
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}
