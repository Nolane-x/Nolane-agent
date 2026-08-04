import test from 'node:test';
import assert from 'node:assert/strict';
import { SovereignContextCompiler } from '../src/kernel/context-compiler.mjs';

test('context compiler applies path scopes, compacts history, deduplicates and preserves omission truth', () => {
  const compiler = new SovereignContextCompiler({ clock: () => Date.parse('2026-08-03T00:00:00Z') });
  const transcript = Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: index < 16 ? `Decision: keep invariant ${index}. Refer src/kernel/file-${index}.mjs` : `recent turn ${index}` }));
  const packet = compiler.compile({
    thread: { id: 'thread-a', projectId: 'project-a', objective: 'Improve context compiler for src/kernel/context-compiler.mjs' },
    targetPaths: ['src/kernel/context-compiler.mjs'], tokenBudget: 2_400,
    instructions: [
      { id: 'managed', content: 'Never fabricate evidence.', trust: 'managed', priority: 1 },
      { id: 'kernel-rule', content: 'Kernel files require receipts.', pathGlobs: ['src/kernel/**'], trust: 'project', priority: 1 },
      { id: 'ui-rule', content: 'UI files use DOM helpers.', pathGlobs: ['ui-v3/**'], trust: 'project', priority: 1 },
    ],
    repository: [
      { id: 'source', path: 'src/kernel/context-compiler.mjs', content: 'export class SovereignContextCompiler {}', trust: 'local', priority: 1 },
      { id: 'duplicate', path: 'src/kernel/context-compiler.mjs', content: 'export class SovereignContextCompiler {}', trust: 'local', priority: 0.2 },
    ], transcript,
    tools: [{ id: 'read', content: { name: 'fs.read', schema: { type: 'object' } }, trust: 'managed' }],
  });
  assert.equal(packet.segments.some((item) => item.id === 'ui-rule'), false);
  assert.equal(packet.omissions.some((item) => item.id === 'ui-rule' && item.reason === 'path-scope-mismatch'), true);
  assert.equal(packet.segments.filter((item) => item.content.includes('SovereignContextCompiler')).length, 1);
  assert.equal(packet.compaction.summaryCreated, true);
  assert.ok(packet.compaction.omittedTurns > 0);
  assert.ok(packet.tokenEstimate <= packet.tokenBudget);
  assert.equal(packet.claims.sourceContentFabricated, false);
  assert.match(packet.receiptSha256, /^[a-f0-9]{64}$/);
});

test('context compiler fails closed when untrusted content exceeds policy budget', () => {
  const compiler = new SovereignContextCompiler();
  assert.throws(() => compiler.compile({
    thread: { id: 't', projectId: 'p', objective: 'inspect external report' }, tokenBudget: 1_024,
    laneShares: { evidence: 1, instructions: 0, objective: 0, repository: 0, memory: 0, transcript: 0, tools: 0 },
    evidence: [{ id: 'external', content: 'external '.repeat(100), trust: 'untrusted', priority: 1 }],
    policy: { maxUntrustedTokens: 10 },
  }), /untrusted context budget exceeded/i);
});
