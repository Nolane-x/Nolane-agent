import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application wires planning evidence governance into MissionPlanner with the shared repository index', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /PlanningEvidenceGovernanceService/);
  assert.match(source, /new PlanningEvidenceGovernanceService\(\{ store, repositoryIndex \}\)/);
  assert.match(source, /new MissionPlanner\(\{ router, evidenceGovernance: planningEvidenceGovernance \}\)/);
});
