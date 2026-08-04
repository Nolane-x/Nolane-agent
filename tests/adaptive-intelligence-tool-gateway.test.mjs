import assert from 'node:assert/strict';
import test from 'node:test';

import { AdaptiveIntelligenceToolGateway } from '../src/agent/adaptive-intelligence-tool-gateway.mjs';

test('AdaptiveIntelligenceToolGateway exposes bounded project-scoped tools and receipt evidence', async () => {
  const calls = [];
  const plane = {
    async repository(op, input) { calls.push(['repository', op, input]); return op === 'map' ? { files: [{ path: 'src/core.mjs' }] } : { items: [{ path: 'src/auth.mjs' }] }; },
    async context(op, input) { calls.push(['context', op, input]); if (op === 'get') return { id: input.id, refs: { projectId: 'project-1' } }; return { id: input.id, content: 'bounded page' }; },
    async memory(op, input, principal) { calls.push(['memory', op, input, principal]); return { id: 'memory-1', status: 'candidate' }; },
    async review(op, input) { calls.push(['review', op, input]); return { reviewId: 'review-1' }; },
    async automation(op, input) { calls.push(['automation', op, input]); return [{ id: 'automation-1' }]; },
    async design(op, input) { calls.push(['design', op, input]); return { id: input.id, projectId: 'project-1' }; },
    diagnostics(op, input) { calls.push(['diagnostics', op, input]); return { summary: { new: 1 } }; },
    providers(op, input) { calls.push(['providers', op, input]); return { selectedProviderId: 'p1' }; },
    async environment(op, input) { calls.push(['environment', op, input]); return { id: input.id, projectId: 'project-1', state: 'healthy' }; },
  };
  const gateway = new AdaptiveIntelligenceToolGateway({ planeResolver: () => plane });
  const task = { id: 'task-1', projectId: 'project-1', metadata: { agentProfileId: 'builder' } };
  const names = gateway.schemasForTask(task).map((schema) => schema.function.name);
  assert.ok(names.includes('repository.semanticSearch'));
  assert.ok(names.includes('repository.map'));
  assert.ok(names.includes('context.artifactRead'));
  assert.ok(names.includes('memory.propose'));
  assert.ok(names.includes('review.independent'));
  assert.ok(names.includes('diagnostics.compare'));
  assert.ok(names.includes('environment.status'));
  assert.equal(names.includes('automation.createDraft'), false);

  const repositoryMap = await gateway.execute(task, 'repository.map', { maxFiles: 10 });
  assert.equal(repositoryMap.output.files[0].path, 'src/core.mjs');
  const search = await gateway.execute(task, 'repository.semanticSearch', { query: 'login', projectId: 'other' }, { refs: { runId: 'run-1' } });
  assert.equal(search.output.items[0].path, 'src/auth.mjs');
  assert.equal(calls[0][2].projectId, 'project-1');
  assert.match(search.receipt.receiptSha256, /^[a-f0-9]{64}$/);

  await gateway.execute(task, 'context.artifactRead', { id: 'ctx_aaaaaaaaaaaaaaaaaaaa_aaaaaaaa', maxBytes: 100 });
  const memory = await gateway.execute(task, 'memory.propose', { title: 'Build command', content: 'Use npm test', citations: [] });
  assert.equal(memory.output.status, 'candidate');
  assert.equal(calls.find((item) => item[0] === 'memory')[3].subject, 'agent:task-1');

  assert.equal((await gateway.execute(task, 'diagnostics.compare', { baseline: '', current: 'Error: new' })).output.summary.new, 1);
  assert.equal((await gateway.execute(task, 'environment.status', { id: 'web' })).output.state, 'healthy');
  await gateway.execute(task, 'review.independent', { diff: 'diff --git a/a b/a\n+x\n', reviewerId: 'critic' });
  const reviewCall = calls.find((item) => item[0] === 'review');
  assert.equal(reviewCall[2].projectId, 'project-1');
  assert.equal(reviewCall[2].executorId, 'builder');
});

test('AdaptiveIntelligenceToolGateway rejects cross-project context artifacts and unauthorized tools', async () => {
  const plane = {
    async context(op, input) { return op === 'get' ? { id: input.id, refs: { projectId: 'other-project' } } : { content: 'secret' }; },
  };
  const gateway = new AdaptiveIntelligenceToolGateway({ planeResolver: () => plane });
  const task = { id: 'task-1', projectId: 'project-1', metadata: {} };
  await assert.rejects(() => gateway.execute(task, 'context.artifactRead', { id: 'ctx_aaaaaaaaaaaaaaaaaaaa_aaaaaaaa' }), (error) => error.code === 'ADAPTIVE_CONTEXT_SCOPE_DENIED');
  await assert.rejects(() => gateway.execute(task, 'automation.createDraft', { name: 'Nope', objective: 'Nope' }), (error) => error.code === 'ADAPTIVE_TOOL_DENIED');
});

test('AdaptiveIntelligenceToolGateway lets agents list and search only current-project history archives', async () => {
  const calls = [];
  const plane = {
    async history(op, input) { calls.push([op, input]); return op === 'list' ? [{ id: 'h1', projectId: input.projectId }] : { items: [{ archiveId: 'h1' }] }; },
  };
  const gateway = new AdaptiveIntelligenceToolGateway({ planeResolver: () => plane });
  const task = { id: 'task-history', projectId: 'project-1', metadata: {} };
  const listed = await gateway.execute(task, 'context.historyList', { kind: 'conversation' });
  const searched = await gateway.execute(task, 'context.historySearch', { query: 'login', kind: 'conversation' });
  assert.equal(listed.output[0].projectId, 'project-1');
  assert.equal(searched.output.items[0].archiveId, 'h1');
  assert.equal(calls.every((item) => item[1].projectId === 'project-1'), true);
});
