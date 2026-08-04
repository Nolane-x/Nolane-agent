import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { signed, strings, text } from './construction-utils.mjs';

function capsuleBase(input = {}) {
  return {
    schema: 'forge.construction-state-capsule.v1',
    capsuleId: text(input.capsuleId, 'capsuleId', 256), missionId: text(input.missionId, 'missionId', 256),
    planId: text(input.planId, 'planId', 256), planRevision: Number(input.planRevision ?? 0), invariantRevision: Number(input.invariantRevision ?? 0),
    repositoryFingerprint: text(input.repositoryFingerprint, 'repositoryFingerprint', 512), goal: text(input.goal, 'goal', 8_000),
    completedCriterionIds: strings(input.completedCriterionIds ?? [], 'completedCriterionIds', 512, 256),
    decisionReceiptIds: strings(input.decisionReceiptIds ?? [], 'decisionReceiptIds', 1_000, 512),
    changedSymbolIds: strings(input.changedSymbolIds ?? [], 'changedSymbolIds', 2_000, 512),
    verificationReceiptIds: strings(input.verificationReceiptIds ?? [], 'verificationReceiptIds', 2_000, 512),
    residualRisks: strings(input.residualRisks ?? [], 'residualRisks', 512, 2_048),
    gitCheckpoint: text(input.gitCheckpoint, 'gitCheckpoint', 512), nextStepIds: strings(input.nextStepIds ?? [], 'nextStepIds', 256, 256),
  };
}

export class StateCapsuleStore {
  constructor({ root, maxBytes = 1_000_000 } = {}) {
    this.root = path.resolve(text(root, 'root', 4_096));
    this.maxBytes = Math.max(4_096, Number(maxBytes) || 1_000_000);
  }

  async save(input = {}) {
    await mkdir(this.root, { recursive: true });
    const capsule = signed(capsuleBase(input));
    const payload = `${JSON.stringify(capsule, null, 2)}\n`;
    if (Buffer.byteLength(payload) > this.maxBytes) throw new RangeError('state capsule exceeds byte budget');
    const target = this.#path(capsule.capsuleId);
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, payload, { mode: 0o600 });
    await rename(temp, target);
    return capsule;
  }

  async load(capsuleId) {
    const raw = await readFile(this.#path(capsuleId), 'utf8');
    if (Buffer.byteLength(raw) > this.maxBytes) throw new RangeError('state capsule exceeds byte budget');
    const parsed = JSON.parse(raw);
    const receipt = parsed.receiptSha256;
    const { receiptSha256: _ignored, ...base } = parsed;
    if (!receipt || canonicalSha256(base) !== receipt) throw new Error('state capsule integrity check failed');
    return signed(capsuleBase(parsed));
  }

  async resume(capsuleId, currentState = {}) {
    const capsule = await this.load(capsuleId);
    const invalidReasons = [];
    for (const [field, reason] of [
      ['repositoryFingerprint', 'repository-fingerprint-changed'], ['planRevision', 'plan-revision-changed'], ['invariantRevision', 'invariant-revision-changed'], ['gitCheckpoint', 'git-checkpoint-changed'],
    ]) if (String(currentState[field] ?? '') !== String(capsule[field] ?? '')) invalidReasons.push(reason);
    return signed({ schema: 'forge.construction-resume-result.v1', capsuleId: capsule.capsuleId, status: invalidReasons.length ? 'revalidation-required' : 'resumable', invalidReasons, nextStepIds: invalidReasons.length ? [] : [...capsule.nextStepIds], capsuleReceiptSha256: capsule.receiptSha256 });
  }

  #path(capsuleId) { return path.join(this.root, `${text(capsuleId, 'capsuleId', 256)}.json`); }
}
