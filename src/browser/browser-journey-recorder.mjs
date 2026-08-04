import { createHash, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

function clean(value, max = 512) { return String(value ?? '').trim().slice(0, max); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
function sha256(value) { return createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const item of Object.values(value)) freeze(item); return Object.freeze(value); }
function urlView(value) {
  const url = new URL(String(value ?? 'about:blank'));
  if (!['http:', 'https:', 'about:'].includes(url.protocol)) throw new TypeError('journey URL protocol is not allowed');
  return freeze({ origin: url.protocol === 'about:' ? 'about:' : url.origin, pathname: url.pathname || '/', protocol: url.protocol });
}
function domView(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return freeze({ sha256: sha256(text), bytes: Buffer.byteLength(text), approximateNodes: (text.match(/<[^/!][^>]*>|^-\s+/g) ?? []).length, captured: Boolean(text) });
}
function accessibilityView(input = {}) {
  const roles = {};
  for (const node of Array.isArray(input?.nodes) ? input.nodes : []) { const role = clean(node?.role ?? 'unknown', 80).toLowerCase() || 'unknown'; roles[role] = (roles[role] ?? 0) + 1; }
  const violations = (Array.isArray(input?.violations) ? input.violations : []).slice(0, 100).map((item) => ({ rule: clean(item?.rule ?? item?.id ?? 'unknown', 160), count: Math.max(1, Math.floor(Number(item?.count) || 1)) }));
  return freeze({ status: input?.status ? clean(input.status, 64) : 'captured', nodeCount: Object.values(roles).reduce((sum, count) => sum + count, 0), roles, violationCount: violations.reduce((sum, item) => sum + item.count, 0), violations });
}
function consoleView(entries = []) {
  const normalized = (Array.isArray(entries) ? entries : []).slice(-500).map((entry) => ({ level: clean(entry?.level ?? entry?.type ?? 'log', 32).toLowerCase(), fingerprint: sha256(clean(entry?.message ?? entry?.text ?? '', 4_000)) }));
  return freeze({ status: 'captured', total: normalized.length, errors: normalized.filter((item) => ['error', 'assert'].includes(item.level)).length, warnings: normalized.filter((item) => item.level === 'warning' || item.level === 'warn').length, fingerprints: normalized.filter((item) => ['error', 'assert', 'warning', 'warn'].includes(item.level)).slice(0, 50) });
}
function networkView(entries = []) {
  const failures = [];
  let total = 0;
  for (const entry of (Array.isArray(entries) ? entries : []).slice(-1_000)) {
    total += 1; const status = Number(entry?.status ?? 0); const failed = entry?.failed === true || status >= 400 || status === 0;
    if (!failed) continue;
    let origin = null; let pathname = null;
    try { const url = new URL(String(entry?.url ?? '')); origin = url.origin; pathname = url.pathname; } catch {}
    failures.push({ method: clean(entry?.method ?? 'GET', 16).toUpperCase(), status: status || null, origin, pathname: clean(pathname, 500) || null, errorFingerprint: entry?.error ? sha256(clean(entry.error, 2_000)) : null });
  }
  return freeze({ status: 'captured', total, failures: failures.length, items: failures.slice(0, 100) });
}
function assertionsView(items = []) {
  const normalized = (Array.isArray(items) ? items : []).slice(0, 500).map((item, index) => ({ id: clean(item?.id ?? `assertion-${index + 1}`, 160), passed: item?.passed === true, message: clean(item?.message, 500) || null }));
  return freeze({ total: normalized.length, passed: normalized.filter((item) => item.passed).length, failed: normalized.filter((item) => !item.passed).length, items: normalized });
}

export class BrowserJourneyRecorder {
  constructor({ projectRootResolver, clock = () => Date.now(), maxEntries = 500, eventSink = () => {} } = {}) {
    if (typeof projectRootResolver !== 'function') throw new TypeError('projectRootResolver is required');
    this.projectRootResolver = projectRootResolver; this.clock = clock; this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || 500)); this.eventSink = typeof eventSink === 'function' ? eventSink : () => {}; this.entries = [];
  }
  async #artifact(projectRoot, input = {}) {
    const kind = clean(input?.kind, 64) || 'artifact'; const source = input?.path == null ? '' : String(input.path);
    if (!source) return freeze({ kind, status: 'unavailable', reason: 'not-captured', path: null, bytes: null, sha256: null });
    const root = path.resolve(projectRoot); const target = path.resolve(source); const relative = path.relative(root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Browser journey artifact is outside project: ${target}`);
    let bytes; let digest;
    try { const data = await readFile(target); const info = await stat(target); bytes = info.size; digest = sha256(data); }
    catch (error) { if (error?.code === 'ENOENT') return freeze({ kind, status: 'unavailable', reason: 'missing', path: relative.replaceAll('\\', '/'), bytes: null, sha256: null }); throw error; }
    return freeze({ kind, status: 'available', path: relative.replaceAll('\\', '/'), bytes, sha256: digest });
  }
  async record({ projectId, missionId = null, taskId = null, sessionId = null, url = 'about:blank', domSnapshot = '', accessibility = {}, consoleEntries = [], networkEntries = [], assertions = [], artifacts = [] } = {}) {
    const project = clean(projectId, 256); if (!project) throw new TypeError('projectId is required');
    const projectRoot = path.resolve(await this.projectRootResolver(project));
    const artifactViews = [];
    for (const artifact of Array.isArray(artifacts) ? artifacts : []) artifactViews.push(await this.#artifact(projectRoot, artifact));
    const semantic = {
      schema: 'forge.browser-journey-receipt.v1', id: randomUUID(), projectId: project,
      missionId: clean(missionId, 256) || null, taskId: clean(taskId, 256) || null, sessionId: clean(sessionId, 256) || null,
      capturedAtMs: this.clock(), url: urlView(url), dom: domView(domSnapshot), accessibility: accessibilityView(accessibility),
      console: consoleView(consoleEntries), network: networkView(networkEntries), assertions: assertionsView(assertions), artifacts: artifactViews,
      claims: freeze({ domCaptured: Boolean(String(domSnapshot ?? '').trim()), accessibilityCaptured: accessibility?.status !== 'unavailable', consoleCaptured: !consoleEntries?.status, networkCaptured: !networkEntries?.status, visualCorrectness: false }),
    };
    const receipt = freeze({ ...semantic, receiptSha256: sha256(semantic) });
    this.entries.push(receipt); if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    try { void this.eventSink(freeze({ type: 'browser-journey.recorded', projectId: project, missionId: semantic.missionId, taskId: semantic.taskId, receiptSha256: receipt.receiptSha256 })); } catch {}
    return receipt;
  }
  compare(previous, current) {
    if (!previous?.receiptSha256 || !current?.receiptSha256) throw new TypeError('journey receipts are required');
    const before = new Map((previous.assertions?.items ?? []).map((item) => [item.id, item.passed]));
    const regressedAssertions = (current.assertions?.items ?? []).filter((item) => item.passed === false && before.get(item.id) === true).map((item) => item.id).sort();
    const recoveredAssertions = (current.assertions?.items ?? []).filter((item) => item.passed === true && before.get(item.id) === false).map((item) => item.id).sort();
    const base = { schema: 'forge.browser-journey-comparison.v1', previousReceiptSha256: previous.receiptSha256, currentReceiptSha256: current.receiptSha256, domChanged: previous.dom?.sha256 !== current.dom?.sha256, accessibilityViolationDelta: Number(current.accessibility?.violationCount ?? 0) - Number(previous.accessibility?.violationCount ?? 0), consoleErrorDelta: Number(current.console?.errors ?? 0) - Number(previous.console?.errors ?? 0), networkFailureDelta: Number(current.network?.failures ?? 0) - Number(previous.network?.failures ?? 0), regressedAssertions, recoveredAssertions, visualCorrectnessClaimed: false };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }
  snapshot({ projectId = null, missionId = null } = {}) { const entries = this.entries.filter((item) => (!projectId || item.projectId === String(projectId)) && (!missionId || item.missionId === String(missionId))); const base = { schema: 'forge.browser-journey-recorder-snapshot.v1', entries }; return freeze({ ...base, receiptSha256: sha256(base) }); }
}
