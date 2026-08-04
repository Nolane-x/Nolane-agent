import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Buffer.isBuffer(value)) return JSON.stringify({ type: 'Buffer', sha256: sha256(value), bytes: value.length });
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)])));
}
function receipt(base) { return freeze({ ...base, receiptSha256: sha256(canonical(base)) }); }
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function validSha(value) { return /^[a-f0-9]{64}$/i.test(String(value ?? '')); }
function artifact(kind, bytes, index = null) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError(`${kind} artifact must be a Buffer`);
  return freeze({ kind, index, bytes: bytes.length, sha256: sha256(bytes) });
}

export class ProductArtifactRecorder {
  constructor() { this.journeys = new Map(); }
  record({ journeyId, before, after, frames = [] } = {}) {
    const id = required(journeyId, 'journeyId');
    const record = receipt({ schema: 'forge.product-artifact-record.v1', journeyId: id, before: artifact('before', before), after: artifact('after', after), frames: frames.map((frame, index) => artifact('frame', frame, index)) });
    this.journeys.set(id, record); return record;
  }
  exportDemo(journeyId) {
    const record = this.journeys.get(String(journeyId)); if (!record) throw new Error('journey artifact record not found');
    return receipt({ schema: 'forge.product-artifact-demo.v1', journeyId: record.journeyId, artifacts: [record.before, record.after, ...record.frames] });
  }
}

export class VisualRegressionOracle {
  constructor() { this.baselines = new Map(); }
  approveBaseline({ id, pixels, critical = false, approval = null } = {}) {
    const baselineId = required(id, 'baseline id');
    if (!Array.isArray(pixels)) throw new TypeError('baseline pixels are required');
    if (critical && (!approval?.approved || !approval.actor || !validSha(approval.receiptSha256))) throw new Error('critical visual oracle requires a human-approved baseline');
    const baseline = receipt({ schema: 'forge.visual-baseline.v1', id: baselineId, critical: Boolean(critical), pixels: pixels.map(Number), approval: approval ? { actor: String(approval.actor), approved: Boolean(approval.approved), receiptSha256: String(approval.receiptSha256) } : null });
    this.baselines.set(baselineId, baseline); return baseline;
  }
  compare({ baselineId, actualPixels, tolerance = 0, ignoreRegions = [] } = {}) {
    const baseline = this.baselines.get(String(baselineId)); if (!baseline) throw new Error('visual baseline not found');
    if (!Array.isArray(actualPixels) || actualPixels.length !== baseline.pixels.length) throw new Error('visual pixel dimensions must match');
    const ignored = new Set();
    for (const region of ignoreRegions) {
      if (!validSha(region?.reviewReceiptSha256)) throw new Error('visual ignore region requires review receipt');
      for (const index of region.indexes ?? []) ignored.add(Number(index));
    }
    let differentPixels = 0;
    for (let index = 0; index < baseline.pixels.length; index += 1) if (!ignored.has(index) && Math.abs(Number(actualPixels[index]) - baseline.pixels[index]) > Number(tolerance)) differentPixels += 1;
    return receipt({ schema: 'forge.visual-regression-report.v1', baselineId: baseline.id, status: differentPixels === 0 ? 'pass' : 'fail', tolerance: Number(tolerance), differentPixels, ignoredPixels: ignored.size });
  }
}

export class JourneyContextReuse {
  constructor({ create, reset } = {}) { if (typeof create !== 'function' || typeof reset !== 'function') throw new TypeError('journey context create and reset are required'); this.create = create; this.reset = reset; this.byMission = new Map(); }
  async acquire({ missionId, journeyId } = {}) {
    const mission = required(missionId, 'missionId'); const journey = required(journeyId, 'journeyId'); let context = this.byMission.get(mission); let resetReceiptSha256 = null; let reused = false;
    if (!context) { context = await this.create({ missionId: mission, journeyId: journey }); this.byMission.set(mission, context); }
    else { const result = await this.reset(context, { missionId: mission, journeyId: journey }); if (result?.status !== 'reset' || !validSha(result.receiptSha256)) throw new Error('journey context reuse requires a reset receipt'); resetReceiptSha256 = result.receiptSha256; reused = true; }
    return freeze({ schema: 'forge.journey-context-lease.v1', missionId: mission, journeyId: journey, context, reused, resetReceiptSha256 });
  }
}

export class AccessibilityAcceptance {
  evaluate({ featureId, criteria = [], findings = {} } = {}) {
    const id = required(featureId, 'featureId'); const normalized = [...criteria].map(String);
    const results = normalized.map((criterion) => freeze({ criterion, pass: findings[criterion] === true }));
    return receipt({ schema: 'forge.accessibility-acceptance.v1', featureId: id, status: results.every((item) => item.pass) ? 'pass' : 'fail', criteria: results });
  }
}

export class ArtifactPlayback {
  constructor() { this.journeys = new Map(); }
  append(journeyId, checkpoint = {}) {
    const id = required(journeyId, 'journeyId'); const checkpointId = required(checkpoint.checkpointId, 'checkpointId'); if (!validSha(checkpoint.artifactSha256)) throw new TypeError('artifact sha256 is required');
    const list = this.journeys.get(id) ?? []; if (list.some((item) => item.checkpointId === checkpointId)) throw new Error('checkpoint already exists');
    const item = receipt({ schema: 'forge.artifact-playback-checkpoint.v1', checkpointId, atMs: Number(checkpoint.atMs), artifactSha256: checkpoint.artifactSha256, state: structuredClone(checkpoint.state ?? {}) }); list.push(item); list.sort((a, b) => a.atMs - b.atMs); this.journeys.set(id, list); return item;
  }
  timeline(journeyId) { return freeze([...(this.journeys.get(String(journeyId)) ?? [])]); }
  rewind(journeyId, checkpointId) { const item = (this.journeys.get(String(journeyId)) ?? []).find((entry) => entry.checkpointId === String(checkpointId)); if (!item) throw new Error('playback checkpoint not found'); return structuredClone(item); }
}

const FAULTS = Object.freeze({
  'network-loss': { code: 'ENETDOWN', domain: 'network' }, timeout: { code: 'ETIMEDOUT', domain: 'network' }, 'dns-failure': { code: 'ENOTFOUND', domain: 'network' },
  'provider-overload': { code: 'EPROVIDEROVERLOAD', domain: 'provider' }, 'out-of-memory': { code: 'ENOMEM', domain: 'resource' }, 'process-death': { code: 'EPROCESSDEATH', domain: 'process' },
  'orphan-child': { code: 'EORPHANCHILD', domain: 'process' }, 'fd-exhaustion': { code: 'EMFILE', domain: 'resource' }, 'db-lock': { code: 'EDBLOCKED', domain: 'storage' },
  'disk-full': { code: 'ENOSPC', domain: 'storage' }, 'file-changed-during-transaction': { code: 'ESTALEFILE', domain: 'storage' }, 'environment-leakage': { code: 'EENVLEAK', domain: 'escape' },
  'socket-escape': { code: 'ESOCKETESCAPE', domain: 'escape' }, 'credential-escape': { code: 'ECREDENTIALESCAPE', domain: 'escape' },
});
export class FailureInjectionLab {
  definition(scenario) { const value = FAULTS[String(scenario)]; if (!value) throw new Error(`unsupported failure injection scenario: ${scenario}`); return freeze({ scenario: String(scenario), ...value }); }
  async run(scenario, executor) { if (typeof executor !== 'function') throw new TypeError('failure injection executor is required'); const fault = this.definition(scenario); const outcome = await executor(fault); return receipt({ schema: 'forge.failure-injection-report.v1', scenario: fault.scenario, fault, status: outcome?.contained === true && outcome?.observed === fault.code ? 'contained' : 'escaped', outcome: structuredClone(outcome ?? {}) }); }
}

const VIEW_IDS = Object.freeze(['browser', 'code', 'diff', 'terminal', 'test', 'timeline']);
export class UnifiedWorkSurface {
  constructor({ state = {} } = {}) { this.state = freeze(structuredClone(state)); this.commands = new Map(); }
  views() { return [...VIEW_IDS]; }
  registerCommand(command = {}) { const id = required(command.id, 'command id'); this.commands.set(id, freeze(structuredClone(command))); return this; }
  executeCommand(id) { const command = this.commands.get(String(id)); if (!command) throw new Error('command not found'); return structuredClone(command); }
  roleViews() { const stateSha256 = sha256(canonical(this.state)); return freeze({ builder: { role: 'builder', stateSha256 }, reviewer: { role: 'reviewer', stateSha256 }, operator: { role: 'operator', stateSha256 } }); }
  crossRepositoryChain({ repositories = [] } = {}) {
    const byId = new Map(repositories.map((item) => [String(item.id), [...(item.dependsOn ?? [])].map(String)])); const order = []; const visiting = new Set(); const done = new Set();
    const visit = (id) => { if (done.has(id)) return; if (visiting.has(id)) throw new Error('cross-repository dependency cycle'); if (!byId.has(id)) throw new Error(`unknown repository dependency: ${id}`); visiting.add(id); for (const dependency of byId.get(id)) visit(dependency); visiting.delete(id); done.add(id); order.push(id); };
    for (const id of [...byId.keys()].sort()) visit(id); return receipt({ schema: 'forge.cross-repository-chain.v1', order });
  }
  virtualize(rows, { start = 0, count = 50 } = {}) { const safeStart = Math.max(0, Number(start)); const safeCount = Math.max(0, Number(count)); return freeze({ schema: 'forge.virtualized-collection.v1', total: rows.length, start: safeStart, count: safeCount, items: rows.slice(safeStart, safeStart + safeCount) }); }
  effects({ pressure = 'normal', prefersReducedMotion = false } = {}) { if (pressure === 'high' || pressure === 'critical' || prefersReducedMotion) return freeze({ animation: false, blur: false, transitionsMs: 0 }); return freeze({ animation: true, blur: false, transitionsMs: 120 }); }
  deviceDoctor({ availableRamMb, cpuCores, subsystem } = {}) { const ram = Number(availableRamMb); const cpu = Number(cpuCores); const recommendation = ram < 8192 || cpu < 8 ? 'bounded' : 'standard'; return receipt({ schema: 'forge.device-doctor.v1', subsystem: required(subsystem, 'subsystem'), availableRamMb: ram, cpuCores: cpu, recommendation }); }
  performance(actual = {}, budget = {}) { const violations = Object.keys(budget).filter((metric) => Number(actual[metric]) > Number(budget[metric])).map((metric) => freeze({ metric, actual: Number(actual[metric]), budget: Number(budget[metric]) })); return receipt({ schema: 'forge.work-surface-performance.v1', status: violations.length ? 'fail' : 'pass', actual: structuredClone(actual), budget: structuredClone(budget), violations }); }
  designHonesty() { return freeze({ schema: 'forge.design-honesty.v1', hidesMissingStateWithEffects: false, truthfulMissingStates: true }); }
}

export class VsCodeEvidenceBridge {
  publish(input = {}) { const revision = Number(input.revision); if (!Number.isInteger(revision) || revision < 0) throw new TypeError('revision must be a non-negative integer'); return receipt({ schema: 'forge.vscode-evidence-bridge.v1', revision, inlineDiff: structuredClone(input.inlineDiff ?? []), diagnostics: structuredClone(input.diagnostics ?? []), symbols: structuredClone(input.symbols ?? []), tests: structuredClone(input.tests ?? []), missionState: structuredClone(input.missionState ?? {}) }); }
}
