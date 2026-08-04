import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { CORE_TOOL_SCHEMAS } from '../src/agent/agent-loop.mjs';
import { RunActivityTracker } from '../src/agent/run-activity-tracker.mjs';
import { AutonomyPolicy } from '../src/security/autonomy-policy.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

const patch = `--- a/src/a.txt\n+++ b/src/a.txt\n@@ -1,1 +1,1 @@\n-old\n+new\n`;

test('ToolBroker exposes fs.patchSet with a standard receipt and bounded transaction output', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-patch-set-tool-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.txt'), 'old\n');
  const broker = new ToolBroker({ workspaceRoot: root, allowedCommands: [process.execPath] });
  const result = await broker.execute({ tool: 'fs.patchSet', input: { patches: [{ patch, expectedSha256: canonicalSha256('old\n') }], maxFiles: 2, maxChangedLines: 10 } });
  assert.equal(result.status, 'pass');
  assert.equal(result.output.status, 'committed');
  assert.equal(result.output.metrics.filesChanged, 1);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(await readFile(path.join(root, 'src', 'a.txt'), 'utf8'), 'new\n');
});

test('agent schema, autonomy policy, and activity tracker treat fs.patchSet as a bounded reversible edit', () => {
  const schema = CORE_TOOL_SCHEMAS.find((item) => item.function.name === 'fs.patchSet');
  assert.ok(schema);
  assert.equal(schema.function.parameters.properties.patches.maxItems, 32);
  assert.equal(schema.function.parameters.properties.maxChangedLines.maximum, 20000);
  const decision = new AutonomyPolicy().evaluate({ kind: 'fs.patchSet', reversible: true }, { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true });
  assert.equal(decision.decision, 'allow');
  const tracker = new RunActivityTracker();
  tracker.recordTool({ tool: 'fs.patchSet', input: { patches: [{ patch }] }, status: 'pass', output: { files: [{ path: 'src/a.txt' }], metrics: { filesChanged: 1 } } });
  assert.deepEqual(tracker.snapshot().filesWritten, ['src/a.txt']);
});
