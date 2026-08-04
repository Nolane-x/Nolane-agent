import { receipt, signed, text, uniqueStrings } from './learning-utils.mjs';

function endpoint(input, label) {
  if (!input || typeof input !== 'object') throw new TypeError(`${label} is required`);
  return Object.freeze({
    modelId: text(input.modelId, `${label}.modelId`, 256),
    harness: text(input.harness, `${label}.harness`, 256),
    capabilities: uniqueStrings(input.capabilities ?? [], `${label}.capabilities`, 512),
  });
}

function cleanMap(input, label) {
  if (input == null) return Object.freeze({});
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`${label} must be an object`);
  const output = {};
  for (const key of Object.keys(input).sort()) output[text(key, `${label} key`, 256)] = text(input[key], `${label}.${key}`, 256);
  return Object.freeze(output);
}

export class ModelSwitchCoordinator {
  constructor({ capsuleStore } = {}) {
    if (!capsuleStore?.load || !capsuleStore?.resume) throw new TypeError('capsuleStore with load and resume is required');
    this.capsuleStore = capsuleStore;
  }

  async switchSession(input = {}) {
    const capsuleId = text(input.capsuleId, 'capsuleId', 256);
    const from = endpoint(input.from, 'from');
    const to = endpoint(input.to, 'to');
    const requiredCapabilities = uniqueStrings(input.requiredCapabilities ?? [], 'requiredCapabilities', 512);
    const missing = requiredCapabilities.filter((capability) => !to.capabilities.includes(capability));
    if (missing.length) throw new Error(`missing target capability: ${missing.join(', ')}`);
    const translationInput = input.translation ?? {};
    const sourceHarness = text(translationInput.sourceHarness, 'translation.sourceHarness', 256);
    const targetHarness = text(translationInput.targetHarness, 'translation.targetHarness', 256);
    if (sourceHarness !== from.harness || targetHarness !== to.harness) throw new Error('unsupported harness translation');
    const translation = Object.freeze({
      sourceHarness,
      targetHarness,
      revisionSha256: receipt(translationInput.revisionSha256, 'translation.revisionSha256'),
      toolAliases: cleanMap(translationInput.toolAliases, 'translation.toolAliases'),
      roleMap: cleanMap(translationInput.roleMap, 'translation.roleMap'),
    });
    const resume = await this.capsuleStore.resume(capsuleId, input.currentState ?? {});
    if (resume.status !== 'resumable') throw new Error(`state capsule requires revalidation: ${resume.invalidReasons.join(', ')}`);
    const capsule = await this.capsuleStore.load(capsuleId);
    const translatedState = Object.freeze({
      missionId: capsule.missionId,
      planId: capsule.planId,
      planRevision: capsule.planRevision,
      invariantRevision: capsule.invariantRevision,
      repositoryFingerprint: capsule.repositoryFingerprint,
      completedCriterionIds: capsule.completedCriterionIds,
      decisionReceiptIds: capsule.decisionReceiptIds,
      changedSymbolIds: capsule.changedSymbolIds,
      verificationReceiptIds: capsule.verificationReceiptIds,
      residualRisks: capsule.residualRisks,
      gitCheckpoint: capsule.gitCheckpoint,
      nextStepIds: capsule.nextStepIds,
    });
    return signed({
      schema: 'forge.mid-session-model-switch.v1', status: 'switched', capsuleId,
      capsuleReceiptSha256: capsule.receiptSha256, from, to, requiredCapabilities, translation, translatedState,
      claims: Object.freeze({ rawPromptTransferred: false, chainOfThoughtTransferred: false, staleCapsuleAccepted: false, unsupportedCapabilityIgnored: false }),
    });
  }
}
