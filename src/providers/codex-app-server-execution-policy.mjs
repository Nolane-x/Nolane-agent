function freeze(value) {
  return Object.freeze(value);
}

function policy(modeId, sandboxPolicy, automaticApproval) {
  return freeze({ modeId, sandboxPolicy: freeze(sandboxPolicy), automaticApproval });
}

export function resolveCodexAppServerExecutionPolicy(task) {
  const metadata = task?.metadata && typeof task.metadata === 'object' ? task.metadata : {};
  const modeId = String(metadata.modeId ?? '').trim();
  const mode = metadata.modePolicy && typeof metadata.modePolicy === 'object' ? metadata.modePolicy : null;

  if (modeId === 'deep' && mode?.id === 'deep' && mode.writesAllowed === true && mode.commitPolicy === 'allow') {
    return policy('deep', { type: 'dangerFullAccess' }, true);
  }
  if (modeId !== 'deep' && mode?.writesAllowed === true && modeId && mode.id === modeId) {
    return policy(modeId, { type: 'workspaceWrite' }, false);
  }
  return policy(null, { type: 'readOnly' }, false);
}
