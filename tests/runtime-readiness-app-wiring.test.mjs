import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application wires architecture stage, mission completion, and container preflight services', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  for (const pattern of [
    /ArchitectureStageGate/,
    /MissionCompletionOrchestrator/,
    /LocalContainerPreflightService/,
    /architectureStageGate/,
    /missionCompletion/,
    /localContainerPreflight/,
  ]) assert.match(source, pattern);
  assert.match(source, /capabilityGrantLedger\.authorize/);
});
