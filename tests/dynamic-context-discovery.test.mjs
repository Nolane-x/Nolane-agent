import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DynamicContextStore } from '../src/agent/dynamic-context-store.mjs';
import { DynamicToolCatalog } from '../src/agent/dynamic-tool-catalog.mjs';
import { ContextPlannerV2 } from '../src/agent/context-planner-v2.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

test('DynamicContextStore preserves complete long output as a redacted immutable artifact with paging and search', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-dynamic-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new DynamicContextStore({ root, previewBytes: 80, maxArtifactBytes: 200_000 });
  const content = `${'first line\n'.repeat(30)}API_KEY=super-secret-value\nneedle-at-the-end\n`;
  const record = await store.artifactize({ kind: 'terminal', content }, { projectId: 'p1', taskId: 't1', runId: 'r1', secretValues: ['super-secret-value'] });

  assert.equal(record.schema, 'forge.context-artifact.v1');
  assert.ok(record.bytes > record.preview.length);
  assert.match(record.sha256, /^[a-f0-9]{64}$/);
  assert.equal(record.preview.includes('super-secret-value'), false);
  assert.equal(record.preview.includes('[REDACTED]'), false, 'secret is beyond preview but must still be redacted on disk');

  const page = await store.read(record.id, { startByte: record.bytes - 100, maxBytes: 100 });
  assert.match(page.content, /needle-at-the-end/);
  assert.equal(page.content.includes('super-secret-value'), false);
  const matches = await store.search(record.id, 'needle-at-the-end');
  assert.equal(matches.items.length, 1);
  assert.equal(matches.items[0].line > 20, true);

  const disk = await readFile(record.filePath, 'utf8');
  assert.equal(disk.includes('super-secret-value'), false);
  await assert.rejects(() => store.artifactize({ kind: 'terminal', content: 'x'.repeat(200_001) }, { projectId: 'p1', taskId: 't1' }), /size limit/i);
});

test('ToolBroker artifactizes oversized normalized output instead of truncating or flooding model context', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tool-artifact-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const contextStore = new DynamicContextStore({ root: path.join(root, 'artifacts'), previewBytes: 64, maxArtifactBytes: 100_000 });
  const broker = new ToolBroker({ workspaceRoot: root, allowedPaths: ['**'], allowedCommands: [process.execPath], maxOutputBytes: 20_000, dynamicContextStore: contextStore, artifactThresholdBytes: 200 });
  const result = await broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', `process.stdout.write('line\\n'.repeat(200))`] } }, { refs: { projectId: 'p', taskId: 't', runId: 'r' } });
  assert.equal(result.status, 'pass');
  assert.equal(result.output.artifact.schema, 'forge.context-artifact.v1');
  assert.ok(result.output.preview.length <= 64);
  const restored = await contextStore.read(result.output.artifact.id, { startByte: 0, maxBytes: 2_000 });
  assert.match(restored.content, /line/);
});

test('DynamicToolCatalog progressively discloses uncommon schemas while pinning core tools', () => {
  const catalog = new DynamicToolCatalog({ pinnedTools: ['fs.read', 'fs.search'] });
  catalog.register({ type: 'function', function: { name: 'fs.read', description: 'Read a file', parameters: { type: 'object', properties: { path: { type: 'string' } } } } }, { source: 'core', tags: ['file'] });
  catalog.register({ type: 'function', function: { name: 'jira.search', description: 'Search project issues with a long description that should not be copied into the base prompt', parameters: { type: 'object', properties: { query: { type: 'string' }, project: { type: 'string' } }, required: ['query'] } } }, { source: 'mcp:jira', tags: ['issue', 'project'] });

  const base = catalog.baseSchemas();
  assert.deepEqual(base.map((schema) => schema.function.name), ['fs.read']);
  const summaries = catalog.summaries();
  assert.equal(summaries.find((item) => item.name === 'jira.search').hasFullSchema, false);
  assert.equal(JSON.stringify(summaries).includes('properties'), false);
  const loaded = catalog.loadSchema('jira.search');
  assert.equal(loaded.function.parameters.required[0], 'query');
  assert.deepEqual(catalog.search('issue project').map((item) => item.name), ['jira.search']);
});

test('ContextPlannerV2 applies separate role budgets and records selection reasons', () => {
  const planner = new ContextPlannerV2({ budgets: { planner: 120, executor: 60, reviewer: 80, debugger: 100 } });
  const items = [
    { id: 'task', category: 'task', text: 'objective'.repeat(5), priority: 1000, roles: ['planner', 'executor', 'reviewer', 'debugger'] },
    { id: 'code', category: 'code', text: 'implementation'.repeat(6), priority: 800, roles: ['executor', 'reviewer'] },
    { id: 'logs', category: 'toolOutput', text: 'stacktrace'.repeat(8), priority: 900, roles: ['debugger'] },
    { id: 'old', category: 'memory', text: 'stale'.repeat(30), priority: 10, roles: ['planner', 'executor'] },
  ];
  const executor = planner.plan({ role: 'executor', items });
  assert.equal(executor.selected.some((item) => item.id === 'task'), true);
  assert.ok(executor.usedChars <= 60);
  assert.equal(executor.omissions.some((item) => item.id === 'old'), true);
  const debuggerPlan = planner.plan({ role: 'debugger', items });
  assert.equal(debuggerPlan.selected.some((item) => item.id === 'logs'), true);
  assert.equal(debuggerPlan.selected.some((item) => item.id === 'code'), false);
});
