import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ArchitectureStageGate, buildTaskGovernanceEnvelope } from '../src/orchestration/architecture-stage-gate.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-stage-'));
  await mkdir(path.join(root, 'src', 'orchestration'), { recursive: true });
  await mkdir(path.join(root, 'src', 'cloud'), { recursive: true });
  await mkdir(path.join(root, 'extensions', 'vscode'), { recursive: true });
  await mkdir(path.join(root, 'desktop'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '2.14.0' }));
  await writeFile(path.join(root, 'src', 'app.mjs'), 'export default true;');
  await writeFile(path.join(root, 'src', 'agent-loop.mjs'), 'export default true;');
  await writeFile(path.join(root, 'src', 'orchestration', 'task-graph.mjs'), 'export default true;');
  await writeFile(path.join(root, 'extensions', 'vscode', 'package.json'), JSON.stringify({ version: '2.14.0' }));
  await writeFile(path.join(root, 'desktop', 'electron-main.mjs'), 'export default true;');
  await writeFile(path.join(root, 'src', 'cloud', 'cloud-sandbox-service.mjs'), 'export default true;');
  return root;
}

test('architecture stages are ordered core -> IDE -> desktop -> cloud eligibility', async () => {
  const root = await fixture();
  const result = await new ArchitectureStageGate({ root }).inspect();
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.stages.map((item) => [item.id, item.ready]), [
    ['core', true], ['ide', true], ['desktop', true], ['cloud', true],
  ]);
  assert.equal(result.cloudOperational, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('later stages fail closed when an earlier stage is absent', async () => {
  const root = await fixture();
  await writeFile(path.join(root, 'extensions', 'vscode', 'package.json'), JSON.stringify({ version: '0.0.0' }));
  const result = await new ArchitectureStageGate({ root }).inspect();
  assert.equal(result.stages.find((item) => item.id === 'ide').ready, false);
  assert.equal(result.stages.find((item) => item.id === 'desktop').ready, false);
  assert.equal(result.stages.find((item) => item.id === 'cloud').ready, false);
});

test('task governance separates reasoning from execution and always supplies resource limits', () => {
  const scout = buildTaskGovernanceEnvelope({ role: 'scout' });
  const builder = buildTaskGovernanceEnvelope({ role: 'builder', resourceLimits: { maxTurns: 8 } });
  assert.equal(scout.executionClass, 'reasoning');
  assert.equal(scout.mutationAllowed, false);
  assert.equal(builder.executionClass, 'execution');
  assert.equal(builder.mutationAllowed, true);
  assert.equal(builder.resourceLimits.maxTurns, 8);
  for (const key of ['maxTurns', 'maxToolCalls', 'maxEstimatedTokens', 'maxElapsedMs']) assert.ok(builder.resourceLimits[key] > 0);
  assert.match(builder.receiptSha256, /^[a-f0-9]{64}$/);
});

test('task governance clamps planner resource requests to hard system ceilings', () => {
  const governed = buildTaskGovernanceEnvelope({
    role: 'builder',
    resourceLimits: { maxTurns: 1_000_000, maxToolCalls: 1_000_000, maxEstimatedTokens: 1_000_000_000, maxElapsedMs: 1_000_000_000 },
  });
  assert.deepEqual(governed.resourceLimits, { maxTurns: 96, maxToolCalls: 256, maxEstimatedTokens: 960_000, maxElapsedMs: 120 * 60_000 });
});
