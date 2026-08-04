import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../update/canonical-json.mjs';
import { instructionMatches } from './instruction-discovery.mjs';

const SCOPE_RANK = Object.freeze({ global: 0, repository: 1, directory: 2, language: 3, task: 4 });
function hash(value) { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
function normalizedList(value) { return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean))].slice(0, 64); }
function publicIssue(item) { return Object.freeze({ code: item.code, message: item.message, field: item.field }); }
function directoryDepth(record) { return record.scope === 'directory' ? record.sourceDirectory.split('/').filter(Boolean).length : 0; }
function tuple(record) { return Object.freeze([SCOPE_RANK[record.scope] ?? 1, directoryDepth(record), record.priority]); }
function tupleKey(record) { return tuple(record).join(':'); }
function compareRecords(a, b) {
  const aa = tuple(a); const bb = tuple(b);
  for (let i = 0; i < aa.length; i += 1) if (aa[i] !== bb[i]) return aa[i] - bb[i];
  return a.sourcePath.localeCompare(b.sourcePath);
}
function applies(record, { paths, language, taskType, includeWorkflows }) {
  if (!record.valid) return false;
  if (record.kind === 'workflow' && !includeWorkflows) return false;
  if (!instructionMatches(record, paths)) return false;
  if (record.scope === 'directory' && record.sourceDirectory && paths.length && !paths.some((item) => item === record.sourceDirectory || item.startsWith(`${record.sourceDirectory}/`))) return false;
  if (record.languages.length && (!language || !record.languages.includes(language))) return false;
  if (record.tasks.length && (!taskType || !record.tasks.includes(taskType))) return false;
  return true;
}
function publicRecord(record) {
  return Object.freeze({
    id: record.id, kind: record.kind, rootKind: record.rootKind, sourcePath: record.sourcePath, sourceDirectory: record.sourceDirectory,
    description: record.description, scope: record.scope, priority: record.priority, languages: record.languages, tasks: record.tasks,
    imports: record.imports, rules: record.rules, valid: record.valid, issues: Object.freeze(record.issues.map(publicIssue)), importedBy: record.importedBy,
    sha256: record.sha256, modifiedAt: record.modifiedAt, trust: record.trust,
  });
}

export class InstructionPolicyService {
  constructor({ discovery, store, globalRoots = [], version = '0.0.0', maxImportDepth = 8, maxImportedRecords = 128 } = {}) {
    if (!discovery || typeof discovery.discover !== 'function' || typeof discovery.readRecord !== 'function') throw new TypeError('instruction discovery with readRecord is required');
    if (!store || typeof store.getProject !== 'function') throw new TypeError('project store is required');
    this.discovery = discovery;
    this.store = store;
    this.globalRoots = normalizedList(globalRoots).map((item) => path.resolve(item));
    this.version = String(version);
    this.maxImportDepth = Math.max(1, Math.min(32, Number(maxImportDepth) || 8));
    this.maxImportedRecords = Math.max(1, Math.min(1024, Number(maxImportedRecords) || 128));
    this.cache = new Map();
  }
  clear(projectId = null) {
    if (projectId == null) { this.cache.clear(); return; }
    const id = String(projectId);
    for (const key of this.cache.keys()) {
      try { if (JSON.parse(key).id === id) this.cache.delete(key); } catch { this.cache.delete(key); }
    }
  }
  async #expandImports(root, rootKind, records, omissions) {
    const output = [...records];
    const seenKeys = new Set(records.map((item) => `${rootKind}:${item.sourcePath}`));
    const visit = async (record, chain, depth) => {
      if (depth >= this.maxImportDepth) { omissions.push({ sourcePath: record.sourcePath, reason: 'import-depth-limit' }); return; }
      for (const requested of record.imports) {
        if (output.length >= this.maxImportedRecords + records.length) { omissions.push({ sourcePath: record.sourcePath, importPath: requested, reason: 'import-record-limit' }); return; }
        const baseDirectory = record.sourceDirectory || '';
        const relative = path.posix.normalize(path.posix.join(baseDirectory, requested));
        if (relative === '..' || relative.startsWith('../') || path.posix.isAbsolute(relative)) { omissions.push({ sourcePath: record.sourcePath, importPath: requested, reason: 'import-path-outside-root' }); continue; }
        const chainKey = `${rootKind}:${relative}`;
        if (chain.includes(chainKey)) { omissions.push({ sourcePath: record.sourcePath, importPath: requested, reason: 'import-cycle' }); continue; }
        const loaded = await this.discovery.readRecord(root, relative, { rootKind, defaultScope: record.scope, kind: 'instruction', importedBy: record.id });
        if (!loaded.record) { omissions.push({ sourcePath: record.sourcePath, importPath: requested, reason: loaded.reason }); continue; }
        let imported = loaded.record;
        if (SCOPE_RANK[imported.scope] < SCOPE_RANK[record.scope]) imported = Object.freeze({ ...imported, scope: record.scope });
        if (!seenKeys.has(chainKey)) { output.push(imported); seenKeys.add(chainKey); }
        await visit(imported, [...chain, chainKey], depth + 1);
      }
    };
    for (const record of records) await visit(record, [`${rootKind}:${record.sourcePath}`], 0);
    return output;
  }
  async resolve({ projectId, principalId, paths = [], language = null, taskType = null, includeWorkflows = false, refresh = false } = {}) {
    const id = String(projectId ?? '');
    const principal = String(principalId ?? '');
    if (!id || !principal) throw Object.assign(new Error('projectId and principalId are required'), { statusCode: 400 });
    const project = this.store.getProject(id);
    if (!project?.workspaceRoot) throw Object.assign(new Error('Unknown project'), { statusCode: 404 });
    const normalizedPaths = normalizedList(paths).map((item) => item.replaceAll('\\', '/').replace(/^\.\//, ''));
    const normalizedLanguage = language ? String(language).trim().toLowerCase() : null;
    const normalizedTask = taskType ? String(taskType).trim().toLowerCase() : null;
    const cacheKey = canonicalJson({ id, principal, paths: normalizedPaths, language: normalizedLanguage, taskType: normalizedTask, includeWorkflows });
    if (!refresh && this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const omissions = [];
    let records = [];
    for (const globalRoot of this.globalRoots) {
      const discovered = await this.discovery.discover(globalRoot, { rootKind: 'global', defaultScope: 'global' });
      records.push(...await this.#expandImports(globalRoot, 'global', discovered, omissions));
    }
    const projectRoot = path.resolve(project.workspaceRoot);
    const discovered = await this.discovery.discover(projectRoot, { rootKind: 'project', defaultScope: 'repository' });
    records.push(...await this.#expandImports(projectRoot, 'project', discovered, omissions));
    records = [...new Map(records.map((item) => [item.id, item])).values()];
    const invalidRecords = records.filter((item) => !item.valid).map(publicRecord);
    const selectedRecords = records.filter((item) => applies(item, { paths: normalizedPaths, language: normalizedLanguage, taskType: normalizedTask, includeWorkflows })).sort(compareRecords);
    for (const record of records) {
      if (!record.valid) continue;
      if (record.kind === 'workflow' && !includeWorkflows) omissions.push({ sourcePath: record.sourcePath, reason: 'workflow-not-invoked' });
      else if (!instructionMatches(record, normalizedPaths)) omissions.push({ sourcePath: record.sourcePath, reason: 'glob-scope-mismatch' });
      else if (record.scope === 'directory' && record.sourceDirectory && normalizedPaths.length && !normalizedPaths.some((item) => item === record.sourceDirectory || item.startsWith(`${record.sourceDirectory}/`))) omissions.push({ sourcePath: record.sourcePath, reason: 'directory-scope-mismatch' });
      else if (record.languages.length && (!normalizedLanguage || !record.languages.includes(normalizedLanguage))) omissions.push({ sourcePath: record.sourcePath, reason: 'language-scope-mismatch' });
      else if (record.tasks.length && (!normalizedTask || !record.tasks.includes(normalizedTask))) omissions.push({ sourcePath: record.sourcePath, reason: 'task-scope-mismatch' });
    }

    const effectiveRules = {};
    const conflicts = [];
    const groups = new Map();
    for (const record of selectedRecords) {
      const key = tupleKey(record);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    for (const group of groups.values()) {
      const byRule = new Map();
      for (const record of group) for (const [rule, value] of Object.entries(record.rules)) {
        if (!byRule.has(rule)) byRule.set(rule, []);
        byRule.get(rule).push({ record, value, encoded: canonicalJson(value) });
      }
      for (const [rule, definitions] of byRule) {
        const unique = new Map(definitions.map((item) => [item.encoded, item]));
        if (unique.size > 1) {
          delete effectiveRules[rule];
          conflicts.push({ rule, precedence: tuple(group[0]), sources: definitions.map((item) => ({ sourcePath: item.record.sourcePath, value: item.value, recordId: item.record.id })), resolved: false, resolvedBy: null });
        } else {
          const winner = definitions.at(-1);
          effectiveRules[rule] = { value: winner.value, sourcePath: winner.record.sourcePath, recordId: winner.record.id, precedence: tuple(winner.record) };
          for (const conflict of conflicts) if (conflict.rule === rule && !conflict.resolved) { conflict.resolved = true; conflict.resolvedBy = winner.record.id; }
        }
      }
    }
    const nodes = selectedRecords.map((record) => ({ id: record.id, sourcePath: record.sourcePath, scope: record.scope, priority: record.priority, depth: directoryDepth(record), importedBy: record.importedBy }));
    const edges = [];
    for (let i = 1; i < selectedRecords.length; i += 1) edges.push({ from: selectedRecords[i - 1].id, to: selectedRecords[i].id, relation: 'precedes' });
    for (const record of selectedRecords) if (record.importedBy) edges.push({ from: record.importedBy, to: record.id, relation: 'imports' });
    const body = Object.freeze({
      schema: 'forge.instruction-policy.v1', version: this.version, projectId: id, principalId: principal,
      query: Object.freeze({ paths: Object.freeze(normalizedPaths), language: normalizedLanguage, taskType: normalizedTask, includeWorkflows: includeWorkflows === true }),
      selected: Object.freeze(selectedRecords.map(publicRecord)),
      effectiveRules: Object.freeze(Object.fromEntries(Object.entries(effectiveRules).sort(([a], [b]) => a.localeCompare(b)))),
      conflicts: Object.freeze(conflicts.map((item) => Object.freeze({ ...item, sources: Object.freeze(item.sources) }))),
      invalidRecords: Object.freeze(invalidRecords),
      precedence: Object.freeze({ nodes: Object.freeze(nodes), edges: Object.freeze(edges) }),
      omissions: Object.freeze(omissions.map((item) => Object.freeze({ ...item }))),
    });
    const result = Object.freeze({ ...body, receiptSha256: hash(body) });
    this.cache.set(cacheKey, result);
    return result;
  }
}
