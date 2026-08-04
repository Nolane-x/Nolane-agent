const PRIVATE_KEY = /(?:^|_)(?:rawprompt|rawoutput|rawdiff|chainofthought|rationale|authorization|password|secret|cookie|clipboard)(?:$|_)/i;
const SHA256 = /^[a-f0-9]{64}$/i;

function assertPublic(value: unknown, path = '$', depth = 0): void {
  if (depth > 12) throw new Error(`Collaboration state exceeds public depth at ${path}.`);
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (let i = 0; i < Math.min(value.length, 500); i += 1) assertPublic(value[i], `${path}[${i}]`, depth + 1); return; }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_KEY.test(key.replace(/[-\s]/g, '_'))) throw new Error(`Private collaboration field rejected: ${path}.${key}`);
    assertPublic(item, `${path}.${key}`, depth + 1);
  }
}
function text(value: unknown, max = 500): string { return String(value ?? '').slice(0, max); }
function hash(value: unknown): string | null { const out = text(value, 64); return SHA256.test(out) ? out.toLowerCase() : null; }

export function projectCollaborationMissionState(input: any): any {
  assertPublic(input);
  const reviews = (input?.reviewQueue?.items ?? []).slice(0, 100).map((item: any) => ({
    itemId: text(item?.itemId, 256), kind: text(item?.kind, 64), target: text(item?.target, 2_000), risk: text(item?.risk, 32), state: text(item?.state, 64), receiptSha256: hash(item?.receiptSha256),
  }));
  const events = (input?.playback?.events ?? []).slice(-100).map((event: any) => ({ type: text(event?.type, 128), summary: text(event?.summary, 2_000), artifactSha256: hash(event?.artifactSha256), atMs: Number(event?.atMs ?? 0) }));
  const checkpoints = (input?.playback?.checkpoints ?? []).slice(-100).map((checkpoint: any) => ({ checkpointId: text(checkpoint?.checkpointId, 256), gitCommit: text(checkpoint?.gitCommit, 256), verificationReceiptSha256: hash(checkpoint?.verificationReceiptSha256), atMs: Number(checkpoint?.atMs ?? 0) }));
  const missions = (input?.steering?.missions ?? []).slice(0, 100).map((mission: any) => ({ missionId: text(mission?.missionId, 256), revision: Number(mission?.revision ?? 0), state: text(mission?.state, 64), lastAction: text(mission?.commands?.at?.(-1)?.action, 64) || null }));
  return Object.freeze({ schema: 'nolane.agent.vscode-collaboration-state.v1', receiptSha256: hash(input?.receiptSha256), counts: { blackboard: Number(input?.blackboard?.entries?.length ?? 0), commitments: Number(input?.commitments?.commitments?.length ?? 0), reviews: reviews.length }, reviews, playback: { events, checkpoints }, missions, claims: { rawPromptStored: false, rawDiffStored: false, hiddenReasoningStored: false } });
}


export function projectSecurityCertificationState(input: any): any {
  assertPublic(input);
  const findings = (input?.findings ?? []).slice(0, 100).map((item: any) => ({ code: text(item?.code, 256), severity: text(item?.severity, 32), receiptSha256: hash(item?.receiptSha256) }));
  const quarantines = (input?.quarantines ?? []).slice(0, 100).map((item: any) => ({ kind: text(item?.kind, 64), subjectId: text(item?.subjectId, 512), status: text(item?.status, 64), receiptSha256: hash(item?.receiptSha256) }));
  const certification = Object.freeze({ claimAllowed: input?.certification?.claimAllowed === true, reasons: (input?.certification?.reasons ?? []).slice(0, 100).map((reason: any) => text(reason, 500)), commonTaskCount: Number(input?.certification?.commonTaskCount ?? 0), receiptSha256: hash(input?.certification?.receiptSha256) });
  return Object.freeze({ schema: 'nolane.agent.vscode-security-certification-state.v1', receiptSha256: hash(input?.receiptSha256), auditEntries: Number(input?.auditEntries ?? 0), benchmarkEvidenceEntries: Number(input?.benchmarkEvidenceEntries ?? 0), findings, quarantines, certification, claims: { comparativeSuperiorityProven: input?.claims?.comparativeSuperiorityProven === true, rawPromptStored: false } });
}
