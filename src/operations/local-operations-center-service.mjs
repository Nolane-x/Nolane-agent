import { execFile } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { sanitizeUntrustedContent } from '../security/content-sanitizer.mjs';

const exec = promisify(execFile);
function required(value, label, max = 4000) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); if (text.length > max) throw new TypeError(`${label} is too long`); return text; }
function bounded(value, min, max, label) { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`); return number; }
function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || Buffer.isBuffer(value) || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }
function receipt(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function sanitized(value, maxChars = 2000) { return sanitizeUntrustedContent(value, { maxChars }); }

async function defaultGitHistoryProvider({ projectRoot, limit }) {
  const format = '%H%x1f%an%x1f%aI%x1f%s%x1e';
  const { stdout } = await exec('git', ['log', `--max-count=${limit}`, `--pretty=format:${format}`, '--name-only', '--no-renames'], {
    cwd: projectRoot, timeout: 30_000, maxBuffer: 2_000_000, windowsHide: true,
    env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', HOME: process.env.HOME ?? '', GIT_TERMINAL_PROMPT: '0' },
  });
  return String(stdout).split('\x1e').map((block) => block.trim()).filter(Boolean).map((block) => {
    const [header, ...lines] = block.split(/\r?\n/); const [hash, author, authoredAt, subject] = header.split('\x1f');
    return { hash, author, authoredAt, subject, paths: lines.map((line) => line.trim()).filter(Boolean).slice(0, 500) };
  });
}

export class LocalOperationsCenterService {
  constructor({ projectResolver, imageFactory, codeIntelligence, gitHistoryProvider = defaultGitHistoryProvider, missionState, commandGovernance, runCoordinator, sandbox, cache, clockMs = Date.now, eventSink = () => {} } = {}) {
    if (typeof projectResolver !== 'function') throw new TypeError('projectResolver is required');
    if (typeof imageFactory !== 'function') throw new TypeError('imageFactory is required');
    this.projectResolver = projectResolver; this.imageFactory = imageFactory; this.codeIntelligence = codeIntelligence; this.gitHistoryProvider = gitHistoryProvider;
    this.missionState = missionState; this.commandGovernance = commandGovernance; this.runCoordinator = runCoordinator; this.sandbox = sandbox; this.cache = cache; this.clockMs = clockMs; this.eventSink = eventSink;
  }
  #scope(input = {}) {
    const projectId = required(input.projectId, 'projectId'); const principalId = required(input.principalId, 'principalId'); const project = this.projectResolver(projectId);
    if (!project?.workspaceRoot) throw Object.assign(new Error(`Unknown project: ${projectId}`), { statusCode: 404, code: 'LOCAL_OPERATIONS_PROJECT_NOT_FOUND' });
    return { projectId, principalId, project, projectRoot: path.resolve(project.workspaceRoot) };
  }
  #path(scope, value) {
    const relative = required(value, 'path').replaceAll('\\', '/'); const absolute = path.resolve(scope.projectRoot, relative); const check = path.relative(scope.projectRoot, absolute);
    if (!check || check.startsWith('..') || path.isAbsolute(check)) throw Object.assign(new Error('Path is outside project'), { statusCode: 403, code: 'LOCAL_OPERATIONS_PATH_DENIED' });
    return { relative: check.split(path.sep).join('/'), absolute };
  }
  async inspectImage(input = {}) {
    const scope = this.#scope(input); const target = this.#path(scope, input.path); const result = await this.imageFactory({ projectRoot: scope.projectRoot }).inspect({ path: target.relative });
    return receipt({ schema:'forge.local-operations.image.v1', projectId:scope.projectId, principalId:scope.principalId, ...result });
  }
  async readImage(input = {}) {
    const scope = this.#scope(input); const target = this.#path(scope, input.path); const result = await this.imageFactory({ projectRoot: scope.projectRoot }).read({ path: target.relative });
    const base = { schema:'forge.local-operations.image-content.v1', projectId:scope.projectId, principalId:scope.principalId, relativePath:result.relativePath, format:result.format, mimeType:result.mimeType, contentSha256:result.contentSha256, bytes:result.buffer.length };
    return Object.freeze({ ...base, receiptSha256:canonicalSha256(base), buffer:Buffer.from(result.buffer) });
  }
  async callGraph(input = {}) {
    const scope = this.#scope(input); const target = this.#path(scope, input.path); const languageId = required(input.languageId, 'languageId', 80);
    if (!this.codeIntelligence?.callHierarchy) throw Object.assign(new Error('Call graph service unavailable'), { statusCode:503, code:'LOCAL_OPERATIONS_CALL_GRAPH_UNAVAILABLE' });
    const raw = await this.codeIntelligence.callHierarchy({ projectRoot:scope.projectRoot, languageId, uri:pathToFileURL(target.absolute).href, line:bounded(input.line ?? 0,0,10_000_000,'line'), character:bounded(input.character ?? 0,0,10_000_000,'character') });
    const cleanItem = (item = {}) => freeze({ ...item, ...(item.name != null ? { name:sanitized(item.name,500) } : {}) });
    const result = { items:(raw.result?.items ?? []).map(cleanItem), incoming:(raw.result?.incoming ?? []).map((entry) => freeze({ ...entry, from:cleanItem(entry.from) })), outgoing:(raw.result?.outgoing ?? []).map((entry) => freeze({ ...entry, to:cleanItem(entry.to) })) };
    return receipt({ schema:'forge.local-operations.call-graph.v1', projectId:scope.projectId, principalId:scope.principalId, path:target.relative, source:raw.source ?? 'unavailable', result:freeze(result) });
  }
  async gitHistory(input = {}) {
    const scope = this.#scope(input); const limit = bounded(input.limit ?? 50,1,200,'limit'); const rows = await this.gitHistoryProvider({ projectRoot:scope.projectRoot, limit });
    const commits = rows.slice(0,limit).map((row) => freeze({ hash:String(row.hash ?? '').slice(0,64), author:sanitized(row.author,300), authoredAt:String(row.authoredAt ?? '').slice(0,80), subject:sanitized(row.subject,1000), paths:freeze((row.paths ?? []).map((item) => String(item).slice(0,1000)).slice(0,500)) }));
    return receipt({ schema:'forge.local-operations.git-history.v1', projectId:scope.projectId, principalId:scope.principalId, commits:freeze(commits), source:'local-git-only' });
  }
  costSummary(input = {}) {
    const scope = this.#scope(input); if (!this.missionState?.snapshot) throw new Error('Mission state service unavailable'); const snapshot = this.missionState.snapshot({ projectId:scope.projectId, missionId:required(input.missionId,'missionId'), principalId:scope.principalId });
    return receipt({ schema:'forge.local-operations.cost-summary.v1', projectId:scope.projectId, missionId:String(input.missionId), principalId:scope.principalId, source:'recorded-usage-only', usage:snapshot.usage, cost:snapshot.cost, sourceReceiptSha256:snapshot.receiptSha256 ?? null });
  }
  editCommandCandidate(input = {}) {
    const scope = this.#scope(input); const taskId = required(input.taskId,'taskId'); const shellKind = required(input.shellKind ?? 'bash','shellKind',40);
    const validated = this.commandGovernance?.shellCodec?.validateArgv({ command:input.command, args:input.args ?? [], env:input.env ?? {} }); if (!validated) throw new Error('Command governance shell codec unavailable');
    const commandFingerprint = canonicalSha256({ shellKind, command:validated.command, args:validated.args, env:validated.env });
    return receipt({ schema:'forge.local-operations.command-candidate.v1', projectId:scope.projectId, principalId:scope.principalId, taskId, shellKind, command:validated.command, args:freeze([...validated.args]), envKeys:freeze(Object.keys(validated.env).sort()), commandFingerprint, previousFingerprint:String(input.previousFingerprint ?? '') || null, approvalReusable:false, status:'requires-fresh-governance' });
  }
  takeManualControl(input = {}) {
    const scope = this.#scope(input); const missionId = required(input.missionId,'missionId'); if (!this.runCoordinator?.pause) throw new Error('Run coordinator unavailable'); const run = this.runCoordinator.pause(missionId);
    const result = receipt({ schema:'forge.local-operations.manual-control.v1', projectId:scope.projectId, principalId:scope.principalId, missionId, status:'manual-control', reason:sanitized(input.reason ?? 'operator takeover',500), atMs:this.clockMs(), run });
    this.eventSink({ type:'local-operations.manual-control', ...result }); return result;
  }
  retainSandbox(input = {}) { const scope=this.#scope(input); return this.sandbox.retainLease(required(input.leaseId,'leaseId'), { projectId:scope.projectId, principalId:scope.principalId, retainForMs:bounded(input.retainForMs ?? 900_000,1_000,86_400_000,'retainForMs') }); }
  releaseSandbox(input = {}) { const scope=this.#scope(input); return this.sandbox.closeLease(required(input.leaseId,'leaseId'), { projectId:scope.projectId, principalId:scope.principalId, terminate:input.terminate !== false }); }
  cacheStatus(input = {}) { const scope=this.#scope(input); return this.cache.list({ projectId:scope.projectId, principalId:scope.principalId, namespace:required(input.namespace ?? 'operations','namespace'), limit:bounded(input.limit ?? 100,1,500,'limit') }); }
  purgeCache(input = {}) { const scope=this.#scope(input); return this.cache.purge({ projectId:scope.projectId, principalId:scope.principalId, namespace:required(input.namespace ?? 'operations','namespace') }); }
}
