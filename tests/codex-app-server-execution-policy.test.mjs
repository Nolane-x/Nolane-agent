import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCodexAppServerExecutionPolicy } from '../src/providers/codex-app-server-execution-policy.mjs';
import { decideCodexAppServerApproval } from '../src/providers/codex-app-server.mjs';

test('Codex App Server authority resolver grants full access only to a valid deep task policy', () => {
  const policy = resolveCodexAppServerExecutionPolicy({
    metadata: {
      modeId: 'deep',
      modePolicy: { id: 'deep', writesAllowed: true, commitPolicy: 'allow' },
    },
  });

  assert.deepEqual(policy, {
    modeId: 'deep',
    sandboxPolicy: { type: 'dangerFullAccess' },
    automaticApproval: true,
  });
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(policy.sandboxPolicy), true);
});

test('Codex App Server authority resolver cannot broaden malformed or non-deep task metadata', () => {
  const malformedDeep = resolveCodexAppServerExecutionPolicy({
    metadata: { modeId: 'deep', modePolicy: { id: 'deep', writesAllowed: true, commitPolicy: 'ask' } },
  });
  const writable = resolveCodexAppServerExecutionPolicy({
    metadata: { modeId: 'auto-edit', modePolicy: { id: 'auto-edit', writesAllowed: true, commitPolicy: 'ask' } },
  });
  const missing = resolveCodexAppServerExecutionPolicy({ metadata: {} });

  assert.deepEqual(malformedDeep, { modeId: null, sandboxPolicy: { type: 'readOnly' }, automaticApproval: false });
  assert.deepEqual(writable, { modeId: 'auto-edit', sandboxPolicy: { type: 'workspaceWrite' }, automaticApproval: false });
  assert.deepEqual(missing, { modeId: null, sandboxPolicy: { type: 'readOnly' }, automaticApproval: false });
});

test('Codex App Server approval decision accepts only a resolved full-access policy', () => {
  assert.deepEqual(decideCodexAppServerApproval({ executionPolicy: { modeId: 'deep', sandboxPolicy: { type: 'dangerFullAccess' }, automaticApproval: true } }), { decision: 'accept' });
  assert.deepEqual(decideCodexAppServerApproval({ executionPolicy: { modeId: 'deep', sandboxPolicy: { type: 'workspaceWrite' }, automaticApproval: true } }), { decision: 'decline' });
  assert.deepEqual(decideCodexAppServerApproval({ executionPolicy: null }), { decision: 'decline' });
});
