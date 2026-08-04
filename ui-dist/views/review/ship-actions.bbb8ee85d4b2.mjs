const SHA256 = /^[a-f0-9]{64}$/i;
export function selectShipAction({ projectState, canCommit = false, canPush = false, canCreatePullRequest = false, canApply = false } = {}) {
  if (projectState === 'local-dirty' && canCommit) return 'commit';
  if (projectState === 'clean' && canPush) return 'push';
  if (projectState === 'pushed' && canCreatePullRequest) return 'create-pull-request';
  if (projectState === 'isolated' && canApply) return 'apply-local';
  return 'export-patch';
}
export function createRollbackPlan({ checkpointId, checkpointSha256, files, discardCount = 0 } = {}) {
  if (!checkpointId) throw new Error('Rollback requires checkpointId');
  if (!SHA256.test(checkpointSha256 ?? '')) throw new Error('Rollback requires checkpointSha256');
  if (!Array.isArray(files) || files.length === 0) throw new Error('Rollback requires affected files');
  return Object.freeze({ checkpointId: String(checkpointId), checkpointSha256: checkpointSha256.toLowerCase(), files: Object.freeze([...new Set(files.map(String))]), discardCount: Math.max(0, Number(discardCount) || 0), preserveConversation: true, preserveTerminalHistory: true, reversible: true });
}
