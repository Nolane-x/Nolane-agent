import crypto from 'node:crypto';

const HIDDEN_REASONING_KEY = /(?:chain[_-]?of[_-]?thought|reasoning[_-]?text|hidden[_-]?reasoning|scratchpad|private[_-]?thought)/i;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const canonicalJson = (value) => JSON.stringify(canonical(value));
const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};

function rejectHiddenReasoning(value, path = 'result') {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (HIDDEN_REASONING_KEY.test(key)) throw new Error(`hidden reasoning field is forbidden: ${path}.${key}`);
    rejectHiddenReasoning(entry, `${path}.${key}`);
  }
}

function validateEvidence(evidence, label) {
  if (!Array.isArray(evidence) || evidence.length === 0 || evidence.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${label} evidence must contain at least one non-empty item`);
  }
  return [...new Set(evidence.map(String))].sort();
}

export class MixtureOfAgentsCoordinator {
  constructor({ maxProposers = 8, timeoutMs = 30_000, clock = () => Date.now() } = {}) {
    if (!Number.isInteger(maxProposers) || maxProposers < 2) throw new TypeError('maxProposers must be at least 2');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs must be positive');
    this.maxProposers = maxProposers;
    this.timeoutMs = timeoutMs;
    this.clock = clock;
    this.runs = [];
  }

  async run({ task, proposers, synthesize, verify, signal = null } = {}) {
    if (!task || typeof task.goal !== 'string' || !task.goal.trim()) throw new Error('MoA task goal is required');
    if (!Array.isArray(proposers) || proposers.length < 2) throw new Error('MoA requires at least two proposers');
    if (proposers.length > this.maxProposers) throw new Error(`MoA proposer budget exceeded: ${proposers.length}/${this.maxProposers}`);
    if (typeof synthesize !== 'function' || typeof verify !== 'function') throw new Error('MoA synthesize and verify functions are required');
    const ids = proposers.map((entry) => String(entry?.id ?? ''));
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('MoA requires distinct proposer identities');
    if (proposers.some((entry) => typeof entry.propose !== 'function')) throw new Error('each proposer must implement propose');

    const startedAt = this.clock();
    const taskView = freeze(structuredClone(task));
    let proposals;
    try {
      proposals = await Promise.all(proposers.map((entry) => this.#runProposer(entry, taskView, signal)));
    } catch (error) {
      throw Object.assign(new Error(`MoA proposer failed: ${error?.message ?? error}`), { code: error?.code ?? 'MOA_PROPOSER_FAILED' });
    }
    proposals.sort((a, b) => a.proposerId.localeCompare(b.proposerId));
    const answerHashes = new Set(proposals.map((entry) => entry.answerSha256));
    const disagreement = answerHashes.size > 1;

    const synthesisRaw = await synthesize(freeze({ task: taskView, proposals, disagreement }));
    rejectHiddenReasoning(synthesisRaw, 'synthesis');
    if (!synthesisRaw || typeof synthesisRaw.answer !== 'string' || !synthesisRaw.answer.trim()) throw new Error('MoA synthesis answer is required');
    if (!Array.isArray(synthesisRaw.usedProposalIds) || synthesisRaw.usedProposalIds.length === 0) throw new Error('MoA synthesis must identify used proposals');
    const usedProposalIds = [...new Set(synthesisRaw.usedProposalIds.map(String))].sort();
    if (usedProposalIds.some((id) => !ids.includes(id))) throw new Error('MoA synthesis references an unknown proposer');
    const synthesis = freeze({
      answer: synthesisRaw.answer,
      usedProposalIds,
      disagreementObserved: synthesisRaw.disagreementObserved === true,
      answerSha256: sha256(synthesisRaw.answer),
    });

    const verificationRaw = await verify(freeze({ task: taskView, proposals, synthesis, disagreement }));
    rejectHiddenReasoning(verificationRaw, 'verification');
    if (!verificationRaw || typeof verificationRaw.verifierId !== 'string' || !verificationRaw.verifierId.trim()) throw new Error('MoA verifier identity is required');
    if (ids.includes(verificationRaw.verifierId)) throw new Error('MoA requires an independent verifier');
    const verificationEvidence = validateEvidence(verificationRaw.evidence, 'verification');
    const verification = freeze({ passed: verificationRaw.passed === true, verifierId: verificationRaw.verifierId, evidence: verificationEvidence });

    const withoutReceipt = {
      schema: 'nolane.native.mixture-of-agents.v1',
      status: verification.passed ? 'verified' : 'rejected',
      task: { goal: taskView.goal, constraints: [...(taskView.constraints ?? [])] },
      proposals,
      disagreement,
      synthesis,
      verification,
      startedAt,
      finishedAt: this.clock(),
    };
    const result = freeze({ ...withoutReceipt, receiptSha256: sha256(canonicalJson(withoutReceipt)) });
    this.runs.push(result);
    return result;
  }

  snapshot() {
    const base = {
      schema: 'nolane.native.mixture-of-agents.snapshot.v1',
      runs: this.runs.length,
      verified: this.runs.filter((entry) => entry.status === 'verified').length,
      rejected: this.runs.filter((entry) => entry.status === 'rejected').length,
      lastReceiptSha256: this.runs.at(-1)?.receiptSha256 ?? null,
    };
    return freeze({ ...base, receiptSha256: sha256(canonicalJson(base)) });
  }

  async #runProposer(proposer, task, externalSignal) {
    const controller = new AbortController();
    const externalAbort = () => controller.abort(externalSignal.reason ?? new Error('MoA cancelled'));
    if (externalSignal?.aborted) externalAbort(); else externalSignal?.addEventListener?.('abort', externalAbort, { once: true });
    const timeoutError = Object.assign(new Error(`proposer ${proposer.id} timed out after ${this.timeoutMs}ms`), { code: 'MOA_PROPOSER_TIMEOUT' });
    const timer = setTimeout(() => controller.abort(timeoutError), this.timeoutMs);
    const started = this.clock();
    try {
      const raw = await Promise.race([
        Promise.resolve(proposer.propose(task, Object.freeze({ signal: controller.signal }))),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason ?? timeoutError), { once: true })),
      ]);
      rejectHiddenReasoning(raw, `proposal:${proposer.id}`);
      if (!raw || typeof raw.answer !== 'string' || !raw.answer.trim()) throw new Error(`proposal answer is required: ${proposer.id}`);
      const evidence = validateEvidence(raw.evidence, 'proposal');
      return freeze({
        proposerId: String(proposer.id), answer: raw.answer, evidence,
        confidence: Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : null,
        answerSha256: sha256(raw.answer), durationMs: Math.max(0, this.clock() - started),
      });
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener?.('abort', externalAbort);
    }
  }
}
