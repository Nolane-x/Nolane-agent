import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('app composes MissionResourceFabric once and keeps the composition budget bounded', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ RuntimeLeasePool, createMissionResourceFabric \} from '\.\/runtime\/mission-resource-fabric\.mjs';/);
  assert.equal((source.match(/createMissionResourceFabric\(/g) ?? []).length, 1);
  assert.equal((source.match(/new MissionResourceFabric\(/g) ?? []).length, 0);
  assert.match(source, /new ProviderRegistry\(\{ executionPool: providerRuntimePool, sessionHost: missionResourceFabric\.sessionHost \}\)/);
  assert.match(source, /journal: missionResourceFabric\.journal/);
  assert.match(source, /journeyRecorder: missionResourceFabric\.journeys/);
  assert.match(source, /missionResourceFabric: missionResourceFabric\.publicView\(\)/);
  assert.match(source, /await missionResourceFabric\.close\(\)/);
  const imports = (source.match(/^import\s/mg) ?? []).length;
  const constructors = (source.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*\s*\(/g) ?? []).length;
  assert.ok(imports <= 160, `app.mjs imports ${imports} exceed budget 160`);
  assert.ok(constructors <= 180, `app.mjs constructors ${constructors} exceed budget 180`);
});
