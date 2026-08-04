import { verify } from 'node:crypto';
import { canonicalSha256 } from '../../../vendor/forge-os/src/core/canonical-json.mjs';
import { deepFreeze, nonEmpty, requireSha256, signed } from '../superiority-utils.mjs';

const DEFAULT_SCENARIOS = Object.freeze(['bug-fix', 'hidden-feature', 'security-audit', 'browser-journey', 'multi-agent', 'scheduled-task', 'messaging-task', 'media-voice', 'remote-execution', 'update-resume']);
const DEFAULT_PROBES = Object.freeze(['prompt-injection', 'tool-result-injection', 'secret-exfiltration', 'path-traversal', 'symlink-escape', 'malicious-plugin', 'oauth-replay', 'message-reorder', 'malicious-download', 'provider-disconnect', 'worker-crash', 'corrupt-session-store']);

export class ProviderDogfoodReplayLab {
  constructor({ trustedIssuers = {}, clock = () => Date.now(), limits = {} } = {}) {
    this.trustedIssuers = new Map(Object.entries(trustedIssuers));
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxSuites = Math.max(1, Math.floor(Number(limits.maxSuites) || 50));
    this.suites = new Map();
  }

  createSuite(input = {}) {
    const suiteId = nonEmpty(input.suiteId, 'suiteId');
    if (this.suites.has(suiteId)) throw new Error(`Suite already exists ${suiteId}`);
    const state = { suiteId, requiredScenarios: deepFreeze([...(input.requiredScenarios ?? DEFAULT_SCENARIOS)]), requiredAdversarialProbes: deepFreeze([...(input.requiredAdversarialProbes ?? DEFAULT_PROBES)]), receipt: null, createdAtMs: Number(this.clock()) };
    this.suites.set(suiteId, state);
    while (this.suites.size > this.maxSuites) this.suites.delete(this.suites.keys().next().value);
    return this.#public(state);
  }

  verifyReceipt(suiteId, input = {}) {
    if (input.mock === true || input?.payload?.mock === true) throw new Error('Mock dogfood receipt is forbidden');
    const state = this.#state(suiteId);
    const payload = input.payload;
    if (!payload || typeof payload !== 'object') throw new TypeError('Signed dogfood payload is required');
    if (payload.suiteId !== state.suiteId) throw new Error('Dogfood suite mismatch');
    const issuer = nonEmpty(payload.issuer, 'issuer');
    const publicKey = this.trustedIssuers.get(issuer);
    if (!publicKey) throw new Error(`Untrusted dogfood issuer ${issuer}`);
    const signature = Buffer.from(nonEmpty(input.signature, 'signature'), 'base64');
    const protocolValid = verify(null, Buffer.from(canonicalSha256(payload)), publicKey, signature);
    if (!protocolValid) throw new Error('Dogfood receipt signature invalid');
    if (payload.providerReal !== true || payload.mock === true) throw new Error('Provider-real receipt required');
    if (payload.machine?.os !== 'win32' || Number(payload.machine?.ramGb) < 8 || !String(payload.machine?.label ?? '').trim()) throw new Error('Machine-labelled Windows 8 GB receipt required');
    nonEmpty(payload.credentialReferenceId, 'credentialReferenceId');
    if (payload.secretStored !== false) throw new Error('Dogfood receipt must prove secretStored=false');
    if (payload.independentVerifier !== true) throw new Error('Independent verifier required');
    const scenarioMap = new Map((payload.scenarios ?? []).map((item) => [item.scenarioId, item]));
    const probeMap = new Map((payload.adversarial ?? []).map((item) => [item.probeId, item]));
    const scenariosPassed = state.requiredScenarios.every((id) => { const item = scenarioMap.get(id); return item?.status === 'pass' && item.negativePathPassed === true && item.teardownPassed === true && item.restartPassed === true && Boolean(requireSha256(item.effectHash, 'effectHash')); });
    const adversarialPassed = state.requiredAdversarialProbes.every((id) => { const item = probeMap.get(id); return item?.status === 'pass' && Boolean(requireSha256(item.effectHash, 'effectHash')); });
    const externalCertificationAccepted = protocolValid && scenariosPassed && adversarialPassed;
    state.receipt = deepFreeze({ issuer, payloadHash: canonicalSha256(payload), protocolValid, scenariosPassed, adversarialPassed, externalCertificationAccepted, verifiedAtMs: Number(this.clock()) });
    return signed({ schema: 'nolane.superiority.provider-dogfood-receipt.v1', suiteId: state.suiteId, ...state.receipt, claims: { mockAccepted: false, rawSecretStored: false } });
  }

  evaluate(suiteId) {
    const state = this.#state(suiteId);
    return signed({ schema: 'nolane.superiority.provider-dogfood-evaluation.v1', suiteId: state.suiteId, providerRealDogfoodCertified: state.receipt?.externalCertificationAccepted === true, receipt: state.receipt, blockers: state.receipt?.externalCertificationAccepted ? [] : ['provider-real-windows-receipt-missing'], requirementProjection: { 'NOL-AUDIT-012': state.receipt?.externalCertificationAccepted ? 'verified_source_test' : 'external_gate' } });
  }

  snapshot() { return signed({ schema: 'nolane.superiority.provider-dogfood-replay-lab.v1', suites: [...this.suites.values()].map((state) => this.#public(state)), trustedIssuerCount: this.trustedIssuers.size, claims: { providerRealDogfoodCertified: false, mockAccepted: false } }); }
  #state(id) { const key = nonEmpty(id, 'suiteId'); const state = this.suites.get(key); if (!state) throw new Error(`Unknown suite ${key}`); return state; }
  #public(state) { return signed({ schema: 'nolane.superiority.provider-dogfood-suite.v1', suiteId: state.suiteId, requiredScenarios: state.requiredScenarios, requiredAdversarialProbes: state.requiredAdversarialProbes, hasVerifiedReceipt: state.receipt?.externalCertificationAccepted === true, createdAtMs: state.createdAtMs }); }
}
