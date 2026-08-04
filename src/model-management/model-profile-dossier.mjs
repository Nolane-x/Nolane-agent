import { deepFreeze, sha256Receipt } from '../model-profiles/model-profile-schema.mjs';

function present(value) { return value !== null && value !== undefined && value !== 'unknown'; }
function entriesWithValues(object = {}) { return Object.entries(object).filter(([, value]) => present(value)); }

export function createModelProfileDossier(profile, { health = null, policyEvaluations = [], generatedAt = new Date().toISOString() } = {}) {
  if (!profile?.canonicalId) throw new TypeError('A normalized model profile is required');
  const known = [];
  const unknown = [];
  const inspect = (prefix, object) => {
    for (const [key, value] of Object.entries(object ?? {})) {
      const path = `${prefix}.${key}`;
      if (value && typeof value === 'object' && !Array.isArray(value)) inspect(path, value);
      else if (present(value)) known.push(path);
      else unknown.push(path);
    }
  };
  inspect('profile', profile);
  const capabilityMatrix = {
    verified: [...entriesWithValues(profile.capabilities), ...entriesWithValues(profile.toolCalling).map(([key, value]) => [`toolCalling.${key}`, value])].filter(([, value]) => value === true).map(([key]) => key),
    unsupported: [...entriesWithValues(profile.capabilities), ...entriesWithValues(profile.toolCalling).map(([key, value]) => [`toolCalling.${key}`, value])].filter(([, value]) => value === false).map(([key]) => key),
    unknown: [...Object.entries(profile.capabilities ?? {}), ...Object.entries(profile.toolCalling ?? {}).map(([key, value]) => [`toolCalling.${key}`, value])].filter(([, value]) => !present(value)).map(([key]) => key),
  };
  const base = {
    schema: 'nolane.model-profile-dossier.v1',
    generatedAt,
    canonicalId: profile.canonicalId,
    displayName: profile.identity?.displayName,
    executiveSummary: {
      publisher: profile.identity?.publisher,
      family: profile.identity?.family,
      lifecycle: profile.lifecycle?.status,
      resolution: profile.resolution?.kind,
      confidence: profile.provenance?.confidence?.overall,
      local: profile.deployment?.local,
      selfHostable: profile.deployment?.selfHostable,
      maximumTaskClass: profile.taskEnvelope?.maximumClass,
      autonomousChangeRisk: profile.taskEnvelope?.autonomousChangeRisk,
      verificationRequired: profile.taskEnvelope?.verificationRequired,
    },
    identity: profile.identity,
    lifecycle: profile.lifecycle,
    architecture: profile.architecture,
    context: profile.context,
    modalities: profile.modalities,
    capabilities: capabilityMatrix,
    reasoning: profile.reasoning,
    quality: profile.quality,
    specialties: profile.specialties,
    taskEnvelope: profile.taskEnvelope,
    economics: { pricing: profile.pricing, limits: profile.limits },
    deployment: { deployment: profile.deployment, localRequirements: profile.localRequirements },
    harnessRecommendations: profile.harnessRecommendations,
    health,
    policyEvaluations,
    uncertainty: {
      knownFieldCount: known.length,
      unknownFieldCount: unknown.length,
      unknownFields: unknown.sort(),
      warnings: profile.warnings,
    },
    provenance: profile.provenance,
    profileReceiptSha256: profile.receiptSha256,
  };
  return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
}

export function dossierToMarkdown(dossier) {
  const capabilities = dossier.capabilities.verified.length ? dossier.capabilities.verified.join(', ') : 'none verified';
  const warnings = dossier.uncertainty.warnings?.length ? dossier.uncertainty.warnings.map((item) => `- ${item.code}: ${item.message}`).join('\n') : '- None';
  return `# Model dossier: ${dossier.canonicalId}\n\n` +
    `- Lifecycle: **${dossier.executiveSummary.lifecycle ?? 'unknown'}**\n` +
    `- Resolution: **${dossier.executiveSummary.resolution ?? 'unknown'}**\n` +
    `- Confidence: **${dossier.executiveSummary.confidence ?? 0}**\n` +
    `- Maximum task class: **${dossier.executiveSummary.maximumTaskClass ?? 'unknown'}**\n` +
    `- Verification required: **${dossier.executiveSummary.verificationRequired ?? true}**\n` +
    `- Verified capabilities: ${capabilities}\n` +
    `- Unknown fields: ${dossier.uncertainty.unknownFieldCount}\n` +
    `- Profile receipt: \`${dossier.profileReceiptSha256}\`\n` +
    `- Dossier receipt: \`${dossier.receiptSha256}\`\n\n## Warnings\n\n${warnings}\n`;
}
