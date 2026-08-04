import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const OPEN_REQUIREMENT_IDS = new Set(['NOL-AUDIT-012', 'NOL-UI-002', 'NOL-UI-030', 'NOL-UI-031', 'NOL-UI-032']);

const DOGFOOD_SCENARIOS = Object.freeze([
  'bug-fix-with-reproduction-test',
  'feature-with-hidden-acceptance-test',
  'security-audit-and-remediation',
  'browser-computer-use-journey',
  'multi-agent-delegated-task',
  'scheduled-background-task',
  'messaging-triggered-task',
  'media-voice-task',
  'remote-execution-task',
  'update-restart-resume-task',
]);

const ADVERSARIAL_SCENARIOS = Object.freeze([
  'prompt-injection',
  'tool-result-injection',
  'secret-exfiltration',
  'path-traversal',
  'symlink-escape',
  'malicious-plugin',
  'oauth-replay',
  'messaging-duplicate-reorder',
  'browser-malicious-download',
  'provider-disconnect',
  'worker-crash',
  'corrupted-session-store',
]);

function groupExternalContracts(candidateMappings = []) {
  const grouped = new Map();
  for (const mapping of candidateMappings) {
    if (mapping.status !== 'external_gate') continue;
    const current = grouped.get(mapping.contractId) ?? {
      id: mapping.contractId,
      domains: new Set(),
      pathCount: 0,
    };
    current.domains.add(mapping.domain);
    current.pathCount += 1;
    grouped.set(mapping.contractId, current);
  }
  return [...grouped.values()]
    .map((entry) => ({ ...entry, domains: [...entry.domains].sort() }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function openNolaneRequirements(requirements = {}) {
  return (requirements.requirements ?? [])
    .filter((entry) => OPEN_REQUIREMENT_IDS.has(entry.id) && entry.status !== 'verified')
    .map(({ id, group, title, status }) => ({ id, group, title, status }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildExternalCertificationCheckpoint({
  conformance,
  requirements,
  platform = process.platform,
  machine = {},
  checkpointVersion = '5.0.0-beta.6-wave15-checkpoint.1',
  generatedAt = null,
} = {}) {
  if (!conformance || !requirements) {
    const error = new TypeError('conformance and requirements are required');
    error.code = 'CHECKPOINT_INPUT_REQUIRED';
    throw error;
  }

  const externalContracts = groupExternalContracts(conformance.candidateMappings);
  const openRequirements = openNolaneRequirements(requirements);
  const checkpoint = {
    schema: 'nolane.nolane_native-native-waves.checkpoint.v1',
    checkpointVersion,
    productVersion: conformance.productVersion ?? requirements.productVersion,
    generatedAt,
    environment: {
      platform,
      machine: {
        label: machine.label ?? 'unlabelled',
        ramGb: Number.isFinite(machine.ramGb) ? machine.ramGb : null,
      },
    },
    localCore: {
      wavesCompletedThrough: 15,
      contracts: conformance.summary?.contracts ?? null,
      verifiedContracts: conformance.summary?.verifiedContracts ?? 0,
      verifiedPaths: conformance.candidateStatusCounts?.verified ?? 0,
      mappedPaths: conformance.summary?.matchedCandidates ?? conformance.candidateMappings?.length ?? 0,
    },
    external: {
      externalContracts: externalContracts.length,
      externalPaths: conformance.candidateStatusCounts?.external_gate ?? 0,
      unmappedPaths: conformance.summary?.unmatchedCandidates ?? conformance.unmatchedCandidateIds?.length ?? 0,
      contracts: externalContracts,
      openNolaneRequirements: openRequirements,
    },
    waves: {
      wave16: {
        status: 'blocked_external',
        title: 'Windows Desktop, Installer and Accessibility Certification',
        requiredPlatform: 'win32',
        machineRequirements: ['Windows 11 x64', 'machine-labelled 8 GB RAM', 'keyboard and screen-reader evidence'],
        blockedReasons: [
          'current environment is not a labelled Windows 11 x64 certification machine',
          'Authenticode and Nolane update-signing credentials are unavailable',
          'NVDA/Narrator, visual regression and real installer upgrade evidence have not run',
        ],
      },
      wave17: {
        status: 'blocked_external',
        title: 'Real Provider and Integration Certification Matrix',
        lanes: externalContracts.map((entry) => entry.id),
        verifiedReceipts: 0,
        receiptSchema: 'nolane.external-certification-receipt.v1',
      },
      wave18: {
        status: 'blocked_external',
        title: 'Provider-Real Dogfood, Adversarial Replay and Parity Freeze',
        dogfoodScenarios: [...DOGFOOD_SCENARIOS],
        adversarialScenarios: [...ADVERSARIAL_SCENARIOS],
        executedScenarios: 0,
      },
      wave19: {
        status: 'blocked_external',
        title: 'Final Stable Audit and Nolane 5.0.0',
        blockers: [
          `${externalContracts.length} external behavioral contracts remain`,
          `${openRequirements.length} Nolane acceptance requirements remain open`,
          'Windows and provider-real evidence is absent',
          'independent parity review is absent',
        ],
      },
    },
    claims: {
      completeParityClaimAllowed: false,
      superiorityClaimAllowed: false,
    },
  };
  checkpoint.receiptSha256 = sha256(checkpoint);
  return checkpoint;
}

function isCredentialReference(value) {
  if (typeof value !== 'string' || value.length < 3 || value.length > 256) return false;
  if (!/^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(value)) return false;
  return !/(^|[:/_-])(sk-|secret(?:$|[:/_-])|password(?:$|[:/_-])|private[-_]?key(?:$|[:/_-]))/i.test(value);
}

export function verifyExternalCertificationReceipt(receipt) {
  const failures = [];
  if (!receipt || typeof receipt !== 'object') failures.push('receipt-object-required');
  if (receipt?.schema !== 'nolane.external-certification-receipt.v1') failures.push('invalid-schema');
  if (typeof receipt?.lane !== 'string' || receipt.lane.length === 0) failures.push('lane-required');
  if (typeof receipt?.environment?.os !== 'string' || typeof receipt?.environment?.adapterVersion !== 'string') failures.push('environment-required');
  if (!isCredentialReference(receipt?.credentialReferenceId)) failures.push('credential-reference-required');
  if (!Array.isArray(receipt?.sequence) || receipt.sequence.length === 0) failures.push('sequence-required');
  if (!/^[a-f0-9]{64}$/i.test(receipt?.effectSha256 ?? '')) failures.push('effect-hash-required');
  for (const field of ['teardown', 'reconnect', 'negativePath', 'independentVerifier']) {
    if (receipt?.[field]?.status !== 'pass') failures.push(`${field}-pass-required`);
  }
  if (!receipt?.independentVerifier?.id) failures.push('independent-verifier-id-required');
  if (receipt?.mock !== false) failures.push('real-environment-required');
  if (!receipt?.usage || typeof receipt.usage !== 'object') failures.push('usage-required');
  return { valid: failures.length === 0, failures };
}

export function assertStableReleaseAllowed(checkpoint) {
  const blockers = [];
  if (checkpoint?.external?.externalContracts !== 0) blockers.push('external-contracts-remain');
  if ((checkpoint?.external?.openNolaneRequirements?.length ?? 0) !== 0) blockers.push('nolane-requirements-remain');
  if (checkpoint?.claims?.completeParityClaimAllowed !== true) blockers.push('complete-parity-claim-disabled');
  if (blockers.length > 0) {
    const error = new Error(`Stable release blocked: ${blockers.join(', ')}`);
    error.code = 'STABLE_RELEASE_BLOCKED';
    error.blockers = blockers;
    throw error;
  }
  return true;
}
