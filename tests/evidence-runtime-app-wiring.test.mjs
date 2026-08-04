import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('application wires the shared evidence runtime into AgentLoop, subagents, HTTP, and shutdown', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  for (const name of ['EvidenceGraphRuntimeService','HybridEvidenceRetrievalService','ContextPacketRuntimeService','EvidenceContextRuntime']) assert.match(source, new RegExp(name));
  assert.match(source, /new EvidenceGraphRuntimeService\(/);
  assert.match(source, /new HybridEvidenceRetrievalService\(/);
  assert.match(source, /new ContextPacketRuntimeService\(/);
  assert.match(source, /new EvidenceContextRuntime\(/);
  assert.match(source, /new AgentLoop\([\s\S]*evidenceContextRuntime/);
  assert.match(source, /new SubagentOrchestrator\([\s\S]*resultValidator/);
  assert.match(source, /createHttpServer\([\s\S]*evidenceContextRuntime/);
  assert.match(source, /evidenceContextRuntime\.close\(\)/);
});
