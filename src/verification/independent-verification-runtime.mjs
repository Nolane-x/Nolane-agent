import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { signed, strings, text } from '../construction/construction-utils.mjs';

const SHA256 = /^[a-f0-9]{64}$/i;
const JOURNEY_KINDS = new Set(['browser', 'api']);

function sha(value, label) {
  const output = String(value ?? '').toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}
function safeCaseId(value) {
  const output = text(value, 'caseId', 128);
  if (!/^[a-zA-Z0-9._-]+$/.test(output)) throw new TypeError('caseId contains unsupported characters');
  return output;
}
function deepEqual(left, right) { return canonicalSha256(left) === canonicalSha256(right); }

export class IndependentVerificationRuntime {
  constructor({ vaultRoot, vaultKey } = {}) {
    this.vaultRoot = path.resolve(text(vaultRoot, 'vaultRoot', 4096));
    if (!Buffer.isBuffer(vaultKey) || vaultKey.length !== 32) throw new TypeError('vaultKey must be a 32-byte Buffer');
    this.vaultKey = Buffer.from(vaultKey);
  }

  async runMutationProbe({ probeId, filePath, mutate, verify } = {}) {
    const id = text(probeId, 'probeId', 256); const target = path.resolve(text(filePath, 'filePath', 4096));
    if (typeof mutate !== 'function' || typeof verify !== 'function') throw new TypeError('mutate and verify are required');
    const original = await readFile(target);
    const originalHash = canonicalSha256(original.toString('base64'));
    const mutatedText = await mutate(original.toString('utf8'));
    if (typeof mutatedText !== 'string' || Buffer.from(mutatedText).equals(original)) throw new Error('mutation must change the target bytes');
    const mutated = Buffer.from(mutatedText, 'utf8');
    const mutatedHash = canonicalSha256(mutated.toString('base64'));
    let verification = null; let verificationError = null;
    try {
      await writeFile(target, mutated);
      try { verification = await verify({ probeId: id, filePath: target, originalHash, mutatedHash }); }
      catch (error) { verificationError = String(error?.message ?? error); }
    } finally {
      await writeFile(target, original);
    }
    const restored = await readFile(target);
    const restoredExactBytes = restored.equals(original);
    const receiptValid = SHA256.test(String(verification?.receiptSha256 ?? ''));
    const mutationCaught = verification?.status === 'fail' && Number(verification?.failureCount ?? 0) > 0 && receiptValid;
    const reasons = [];
    if (!mutationCaught) reasons.push('mutation-survived');
    if (!restoredExactBytes) reasons.push('original-bytes-not-restored');
    if (verificationError) reasons.push('verification-error');
    return signed({
      schema: 'forge.temporary-mutation-proof.v1', probeId: id, status: reasons.length ? 'fail' : 'pass', reasons,
      originalHash, mutatedHash, mutationCaught, restoredExactBytes,
      verification: verification ? { status: String(verification.status), failureCount: Number(verification.failureCount ?? 0), receiptSha256: String(verification.receiptSha256 ?? '').toLowerCase() } : null,
      verificationError,
      claims: { mutationPermanent: false, targetRestored: restoredExactBytes },
    });
  }

  requireIndependentReview({ risk = 0, executor, reviewer, review } = {}) {
    const riskValue = Number(risk);
    const executorIdentity = text(executor?.identity, 'executor.identity', 256);
    const executorProvider = text(executor?.provider, 'executor.provider', 256);
    const reviewerIdentity = reviewer?.identity ? String(reviewer.identity) : null;
    const reviewerProvider = reviewer?.provider ? String(reviewer.provider) : null;
    const required = riskValue >= 0.7;
    const reasons = [];
    if (required && !review) reasons.push('independent-review-required');
    if (review) {
      if (!reviewerIdentity || reviewerIdentity === executorIdentity) reasons.push('reviewer-identity-not-independent');
      if (!reviewerProvider || reviewerProvider === executorProvider) reasons.push('reviewer-provider-not-independent');
      if (review.status !== 'approved') reasons.push('review-not-approved');
      if (!SHA256.test(String(review.receiptSha256 ?? ''))) reasons.push('review-receipt-invalid');
    }
    const approved = reasons.length === 0;
    return signed({
      schema: 'forge.independent-review-requirement.v1', status: approved ? 'approved' : 'blocked', required, risk: riskValue,
      identityIndependent: approved && reviewerIdentity !== executorIdentity,
      providerIndependent: approved && reviewerProvider !== executorProvider,
      executor: { identity: executorIdentity, provider: executorProvider },
      reviewer: reviewerIdentity ? { identity: reviewerIdentity, provider: reviewerProvider } : null,
      reviewReceiptSha256: review?.receiptSha256 ? String(review.receiptSha256).toLowerCase() : null, reasons,
      claims: { sameModelProviderAcceptedAboveThreshold: false, selfReviewAcceptedAboveThreshold: false },
    });
  }

  verifyJourney({ journeyId, kind, steps = [], beforeArtifact, afterArtifact, runtimeReceiptSha256, assertions = [] } = {}) {
    const id = text(journeyId, 'journeyId', 256); const journeyKind = text(kind, 'kind', 64);
    if (!JOURNEY_KINDS.has(journeyKind)) throw new TypeError('kind must be browser or api');
    const before = { artifactId: text(beforeArtifact?.artifactId, 'beforeArtifact.artifactId', 512), sha256: sha(beforeArtifact?.sha256, 'beforeArtifact.sha256') };
    const after = { artifactId: text(afterArtifact?.artifactId, 'afterArtifact.artifactId', 512), sha256: sha(afterArtifact?.sha256, 'afterArtifact.sha256') };
    const runtimeReceipt = sha(runtimeReceiptSha256, 'runtimeReceiptSha256');
    if (!Array.isArray(steps) || !steps.length || steps.length > 512) throw new TypeError('steps must contain 1-512 items');
    const normalizedSteps = steps.map((step, index) => ({ action: text(step.action, `steps[${index}].action`, 128), target: text(step.target, `steps[${index}].target`, 1024) }));
    const normalizedAssertions = (Array.isArray(assertions) ? assertions : []).map((assertion, index) => ({ id: text(assertion.id, `assertions[${index}].id`, 256), status: text(assertion.status, `assertions[${index}].status`, 64) }));
    const failed = normalizedAssertions.filter((assertion) => assertion.status !== 'pass').map((assertion) => assertion.id);
    return signed({
      schema: 'forge.runtime-journey-proof.v1', journeyId: id, kind: journeyKind, status: failed.length ? 'fail' : 'pass',
      steps: normalizedSteps, artifacts: { before, after }, runtimeReceiptSha256: runtimeReceipt, assertions: normalizedAssertions, failedAssertionIds: failed,
      claims: { runtimeSurfaceExercised: true, artifactBytesEmbedded: false, narrationUsedAsProof: false },
    });
  }

  async registerHiddenCase({ caseId, taskKind, executorInput, expected, tags = [] } = {}) {
    const id = safeCaseId(caseId); const kind = text(taskKind, 'taskKind', 128);
    await mkdir(this.vaultRoot, { recursive: true });
    const payload = Buffer.from(JSON.stringify({ schema: 'forge.hidden-regression-case.v1', caseId: id, taskKind: kind, executorInput, expected, tags: strings(tags, 'tags', 64, 128) }), 'utf8');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.vaultKey, iv);
    cipher.setAAD(Buffer.from(id));
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    const record = {
      schema: 'forge.hidden-regression-envelope.v1', algorithm: 'aes-256-gcm', caseId: id,
      iv: iv.toString('base64'), authTag: tag.toString('base64'), ciphertext: ciphertext.toString('base64'),
      payloadSha256: canonicalSha256(payload.toString('base64')),
    };
    const target = this.#casePath(id); const temp = `${target}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(record)}\n`, { mode: 0o600 }); await rename(temp, target);
    return signed({
      schema: 'forge.hidden-regression-registration.v1', caseId: id, taskKind: kind, tags: strings(tags, 'tags', 64, 128),
      envelopeSha256: canonicalSha256(record), payloadExposed: false,
      claims: { expectedAnswerReturned: false, executorCanReadEnvelope: false },
    });
  }

  async evaluateHiddenCase(caseId, executor) {
    const id = safeCaseId(caseId);
    if (typeof executor !== 'function') throw new TypeError('executor is required');
    const envelope = JSON.parse(await readFile(this.#casePath(id), 'utf8'));
    if (envelope.caseId !== id || envelope.algorithm !== 'aes-256-gcm') throw new Error('hidden regression envelope invalid');
    const decipher = createDecipheriv('aes-256-gcm', this.vaultKey, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from(id)); decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
    if (canonicalSha256(plaintext.toString('base64')) !== envelope.payloadSha256) throw new Error('hidden regression payload integrity failed');
    const payload = JSON.parse(plaintext.toString('utf8'));
    const executorInput = structuredClone(payload.executorInput);
    const actual = await executor(executorInput);
    const passed = deepEqual(actual, payload.expected);
    return signed({
      schema: 'forge.hidden-regression-result.v1', caseId: id, taskKind: payload.taskKind, status: passed ? 'pass' : 'fail',
      actualSha256: canonicalSha256(actual), expectedSha256: canonicalSha256(payload.expected), expectedExposedToExecutor: false,
      claims: { executorReadExpectedAnswer: false, hiddenPayloadReturned: false },
    });
  }

  #casePath(caseId) { return path.join(this.vaultRoot, `${safeCaseId(caseId)}.hidden`); }
}
