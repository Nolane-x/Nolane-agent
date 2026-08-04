import test from 'node:test';
import assert from 'node:assert/strict';
import { AgencyLedger } from '../src/cognition/agency-ledger.mjs';

test('records intent expected effect actual effect and controllability without raw command', () => {
  const ledger = new AgencyLedger();
  const record = ledger.record({
    actionId: 'act-1', taskId: 'task-1', intent: 'restart dev server', commandKind: 'process-start', commandFingerprint: 'cmd-sha',
    expectedEffect: 'new process listens on port 3000', actualEffect: 'old process remained active', controllability: 0.32, responsibleActor: 'environment-supervisor',
  });
  assert.equal(record.controllability, 0.32);
  assert.equal(record.responsibleActor, 'environment-supervisor');
  assert.equal('command' in record, false);
});
