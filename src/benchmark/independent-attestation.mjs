import { createHash, createPublicKey, verify } from 'node:crypto';

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function normalizedRuns(runs = []) {
  return runs.map((run) => ({
    system: String(run.system ?? ''), taskId: String(run.taskId ?? ''), taskVersion: Number(run.taskVersion ?? 1), seed: Number(run.seed ?? 1),
    verified: run.verified === true, budgetExceeded: run.budgetExceeded === true,
    durationMs: Number(run.durationMs ?? run.latencyMs ?? 0), usage: { tokens: Number(run.usage?.tokens ?? 0), costUsd: Number(run.usage?.costUsd ?? run.costUsd ?? 0) },
    adapterHash: String(run.adapterHash ?? ''), patchHash: String(run.patchHash ?? ''), stdoutHash: String(run.stdoutHash ?? ''), stderrHash: String(run.stderrHash ?? ''),
    verification: Array.isArray(run.verification) ? run.verification.map((entry) => ({ exitCode: Number(entry.exitCode ?? -1), stdoutHash: String(entry.stdoutHash ?? ''), stderrHash: String(entry.stderrHash ?? '') })) : [],
    providerKind: String(run.providerKind ?? ''), modelDigest: String(run.modelDigest ?? ''), contractReceiptSha256: String(run.contractReceiptSha256 ?? ''),
    environmentManifestHash: String(run.environmentManifestHash ?? ''),
    resources: { peakRssMb: Number(run.resources?.peakRssMb ?? 0), rssMbSeconds: Number(run.resources?.rssMbSeconds ?? 0), processCount: Number(run.resources?.processCount ?? 0) },
    corrections: { cycles: Number(run.corrections?.cycles ?? 0), revertedLines: Number(run.corrections?.revertedLines ?? 0), humanInterventions: Number(run.corrections?.humanInterventions ?? 0) },
    verifiedCriteria: Number(run.verifiedCriteria ?? 0), totalCriteria: Number(run.totalCriteria ?? 0), regressions: Number(run.regressions ?? 0),
    firstPatchPassed: run.firstPatchPassed === true, retainedPatch: run.retainedPatch === true, benchmarkSpecificBehaviorDetected: run.benchmarkSpecificBehaviorDetected === true,
    artifacts: Array.isArray(run.artifacts) ? run.artifacts.map((entry) => ({ kind: String(entry.kind ?? ''), sha256: String(entry.sha256 ?? '') })) : [],
  })).sort((a, b) => `${a.system}\0${a.taskId}\0${a.seed}`.localeCompare(`${b.system}\0${b.taskId}\0${b.seed}`));
}

export function canonicalAttestationPayload(attestation = {}) {
  const { signature: _signature, ...unsigned } = attestation;
  return canonical(unsigned);
}

export function benchmarkRunDigest(runs = []) {
  return createHash('sha256').update(canonical(normalizedRuns(runs))).digest('hex');
}

export function verifyIndependentAttestation({ attestation, publicKey, suite, runs } = {}) {
  if (!attestation || typeof attestation !== 'object' || Number(attestation.schemaVersion) !== 1) throw new TypeError('Independent benchmark attestation v1 is required');
  if (!publicKey) throw new TypeError('Trusted independent operator public key is required');
  if (!attestation.operator?.id || !attestation.operator?.name) throw new TypeError('Attestation operator identity is required');
  if (String(attestation.suite?.id) !== String(suite?.id) || Number(attestation.suite?.version) !== Number(suite?.version)) throw new Error('Attestation suite does not match benchmark suite');
  const digest = benchmarkRunDigest(runs);
  if (String(attestation.runDigest) !== digest) throw new Error('Attestation run digest does not match exact benchmark runs');
  const actualSystems = [...new Set(runs.map((run) => String(run.system)))].sort();
  const attestedSystems = [...new Set((attestation.systems ?? []).map(String))].sort();
  if (canonical(actualSystems) !== canonical(attestedSystems)) throw new Error('Attestation systems do not match benchmark runs');
  if (!actualSystems.includes(String(attestation.claimantSystem ?? ''))) throw new Error('Attestation claimant system is missing from benchmark runs');
  const signature = Buffer.from(String(attestation.signature ?? ''), 'base64url');
  if (!signature.length || !verify(null, Buffer.from(canonicalAttestationPayload(attestation)), publicKey?.type ? publicKey : createPublicKey(publicKey), signature)) throw new Error('Independent benchmark attestation signature is invalid');
  return Object.freeze({ verified: true, operator: Object.freeze({ id: String(attestation.operator.id), name: String(attestation.operator.name), organization: attestation.operator.organization ? String(attestation.operator.organization) : null }), claimantSystem: String(attestation.claimantSystem), runDigest: digest, issuedAt: String(attestation.issuedAt ?? ''), systems: Object.freeze(actualSystems) });
}
