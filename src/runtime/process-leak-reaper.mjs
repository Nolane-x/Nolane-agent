import { canonicalSha256, canonicalStringify } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
function text(value, label, max = 256) { const output = String(value ?? '').trim(); if (!output) throw new TypeError(`${label} is required`); if (output.length > max) throw new TypeError(`${label} is too long`); return output; }
function pid(value) { const output = Number(value); if (!Number.isInteger(output) || output <= 0) throw new TypeError('rootPid must be a positive integer'); return output; }
function sha(value, label) { const output = String(value ?? '').trim().toLowerCase(); if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`); return output; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function sameIdentity(left, right) { return canonicalStringify(left ?? null) === canonicalStringify(right ?? null); }

export class ProcessLeakReaper {
  constructor({ driver = {}, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), maxGraceMs = 30_000 } = {}) {
    this.driver = driver;
    this.sleep = typeof sleep === 'function' ? sleep : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    this.maxGraceMs = Math.max(0, Math.min(120_000, Math.floor(Number(maxGraceMs) || 30_000)));
  }

  async reapMission(input = {}) {
    const missionId = text(input.missionId, 'missionId');
    const rootPid = pid(input.rootPid);
    const identityReceiptSha256 = sha(input.identityReceiptSha256, 'identityReceiptSha256');
    const rootIdentity = input.rootIdentity && typeof input.rootIdentity === 'object' ? structuredClone(input.rootIdentity) : null;
    if (!rootIdentity) throw new TypeError('rootIdentity is required');
    if (!Array.isArray(input.registeredPids) || input.registeredPids.length === 0 || input.registeredPids.length > 10_000) throw new TypeError('registeredPids must contain 1-10000 items');
    const registeredPids = [...new Set(input.registeredPids.map(pid))].sort((a, b) => a - b);
    if (!registeredPids.includes(rootPid)) throw new TypeError('registeredPids must include rootPid');
    const graceMs = Math.max(0, Math.min(this.maxGraceMs, Math.floor(Number(input.graceMs) || 0)));
    const baseContext = { schema: 'forge.process-leak-reap.v1', missionId, rootPid, registeredPids, rootIdentity, identityReceiptSha256 };
    if (typeof this.driver.sampleTree !== 'function' || typeof this.driver.killTree !== 'function' || typeof this.driver.isTreeAlive !== 'function') return signed({ ...baseContext, status: 'unsupported', reason: 'platform-driver-contract-unavailable', killedPids: [], outsideRegisteredPids: [], signals: [] });
    let sample;
    try { sample = await this.driver.sampleTree(rootPid); }
    catch (error) {
      if (['SANDBOX_PROCESS_NOT_FOUND', 'ESRCH', 'ENOENT'].includes(error?.code)) return signed({ ...baseContext, status: 'already_exited', reason: 'root-process-unavailable', killedPids: [], outsideRegisteredPids: [], signals: [] });
      throw error;
    }
    if (!sameIdentity(sample.rootIdentity, rootIdentity)) return signed({ ...baseContext, status: 'safety_blocked', reason: 'root-identity-mismatch', observedRootIdentity: sample.rootIdentity ?? null, killedPids: [], outsideRegisteredPids: [], signals: [] });
    const registered = new Set(registeredPids);
    const outsideRegisteredPids = [...(sample.pids ?? [])].map(Number).filter((candidate) => Number.isInteger(candidate) && !registered.has(candidate)).sort((a, b) => a - b);
    if (outsideRegisteredPids.length) return signed({ ...baseContext, status: 'safety_blocked', reason: 'process-tree-outside-registered-set', observedRootIdentity: sample.rootIdentity, killedPids: [], outsideRegisteredPids, signals: [] });
    const signals = [];
    const killed = new Set();
    const graceful = await this.driver.killTree(rootPid, { signal: 'SIGTERM', expectedRootIdentity: rootIdentity, allowedPids: registeredPids });
    signals.push('SIGTERM'); for (const killedPid of graceful?.terminated ?? []) if (registered.has(Number(killedPid))) killed.add(Number(killedPid));
    if (graceMs > 0) await this.sleep(graceMs);
    if (!(await this.driver.isTreeAlive(rootPid))) return signed({ ...baseContext, status: 'graceful', reason: 'tree-exited-after-sigterm', observedRootIdentity: sample.rootIdentity, killedPids: [...killed].sort((a,b)=>a-b), outsideRegisteredPids: [], signals });
    const beforeEscalation = await this.driver.sampleTree(rootPid);
    if (!sameIdentity(beforeEscalation.rootIdentity, rootIdentity)) return signed({ ...baseContext, status: 'safety_blocked', reason: 'root-identity-changed-before-escalation', observedRootIdentity: beforeEscalation.rootIdentity ?? null, killedPids: [...killed].sort((a,b)=>a-b), outsideRegisteredPids: [], signals });
    const outsideBeforeEscalation = [...(beforeEscalation.pids ?? [])].filter((candidate) => !registered.has(Number(candidate))).map(Number).sort((a,b)=>a-b);
    if (outsideBeforeEscalation.length) return signed({ ...baseContext, status: 'safety_blocked', reason: 'process-tree-changed-before-escalation', observedRootIdentity: beforeEscalation.rootIdentity, killedPids: [...killed].sort((a,b)=>a-b), outsideRegisteredPids: outsideBeforeEscalation, signals });
    const forced = await this.driver.killTree(rootPid, { signal: 'SIGKILL', expectedRootIdentity: rootIdentity, allowedPids: registeredPids });
    signals.push('SIGKILL'); for (const killedPid of forced?.terminated ?? []) if (registered.has(Number(killedPid))) killed.add(Number(killedPid));
    if (graceMs > 0) await this.sleep(graceMs);
    const alive = await this.driver.isTreeAlive(rootPid);
    return signed({ ...baseContext, status: alive ? 'leaked' : 'escalated', reason: alive ? 'tree-still-alive-after-sigkill' : 'tree-exited-after-sigkill', observedRootIdentity: sample.rootIdentity, killedPids: [...killed].sort((a,b)=>a-b), outsideRegisteredPids: [], signals });
  }
}
