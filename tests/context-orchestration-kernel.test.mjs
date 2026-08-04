import assert from 'node:assert/strict';
import test from 'node:test';

import { ContextOrchestrationKernel } from '../src/agent/context-orchestration-kernel.mjs';

const DAY = 86_400_000;
const now = Date.parse('2026-07-29T09:00:00.000Z');

function item(id, sourceType, text, extra = {}) {
  return { id, projectId: 'p1', sourceType, text, createdAt: new Date(now - (extra.ageDays ?? 0) * DAY).toISOString(), updatedAt: new Date(now - (extra.ageDays ?? 0) * DAY).toISOString(), ...extra };
}

test('kernel prioritizes current errors and pinned evidence while decaying old logs', () => {
  const kernel = new ContextOrchestrationKernel({ clock: () => now, budgets: { debugger: 1_000 } });
  const plan = kernel.plan({ projectId: 'p1', principalId: 'user-1', role: 'debugger', items: [
    item('old-log', 'log', 'old historical output '.repeat(120), { ageDays: 30 }),
    item('current-error', 'diagnostics', 'TypeError: login is undefined', { current: true, severity: 'error' }),
    item('pinned-test', 'test', 'authentication regression test failed', { pinned: true }),
  ] });
  assert.deepEqual(plan.selected.map((entry) => entry.id).slice(0, 2), ['current-error', 'pinned-test']);
  assert.equal(plan.items.find((entry) => entry.id === 'old-log').ageBand, 'old');
  assert.ok(plan.items.find((entry) => entry.id === 'old-log').priorityScore < plan.items.find((entry) => entry.id === 'current-error').priorityScore);
  assert.match(plan.receiptSha256, /^[a-f0-9]{64}$/);
});

test('kernel deterministically compacts old conversation and long files but keeps original references', () => {
  const kernel = new ContextOrchestrationKernel({ clock: () => now, budgets: { planner: 10_000 }, compaction: { conversationChars: 300, fileChars: 500 } });
  const conversation = ['Objective: migrate authentication.', ...Array.from({ length: 40 }, (_, i) => `Turn ${i}: detail ${'x'.repeat(30)}`), 'Decision: preserve password login.', 'Result: tests pending.'].join('\n');
  const source = ['export function login() {', ...Array.from({ length: 100 }, (_, i) => `  const value${i} = ${i};`), '}', 'export function logout() {}'].join('\n');
  const input = [
    item('conversation', 'conversation', conversation, { ageDays: 12, artifactId: 'ctx_conversation', sourceHash: 'a'.repeat(64) }),
    item('long-file', 'file', source, { relativePath: 'src/auth.mjs', artifactId: 'ctx_file', sourceHash: 'b'.repeat(64), currentHash: 'b'.repeat(64) }),
  ];
  const first = kernel.plan({ projectId: 'p1', principalId: 'user-1', role: 'planner', items: input });
  const second = kernel.plan({ projectId: 'p1', principalId: 'user-1', role: 'planner', items: input });
  for (const id of ['conversation', 'long-file']) {
    const compacted = first.items.find((entry) => entry.id === id);
    assert.equal(compacted.compacted, true);
    assert.ok(compacted.text.length < input.find((entry) => entry.id === id).text.length);
    assert.match(compacted.originalRef.sha256, /^[a-f0-9]{64}$/);
    assert.ok(compacted.originalRef.artifactId);
  }
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.match(first.items.find((entry) => entry.id === 'conversation').text, /Objective:|Decision:|Result:/);
  assert.match(first.items.find((entry) => entry.id === 'long-file').text, /login|logout/);
});

test('kernel labels freshness, accounts tokens by source, and enforces role-specific budgets', () => {
  const kernel = new ContextOrchestrationKernel({ clock: () => now, budgets: { planner: 120, executor: 80, reviewer: 100, debugger: 140, subagent: 60 } });
  const items = [
    item('fresh-code', 'code', 'export const current = true; '.repeat(8), { sourceHash: 'c'.repeat(64), currentHash: 'c'.repeat(64) }),
    item('stale-code', 'code', 'export const stale = true; '.repeat(8), { sourceHash: 'd'.repeat(64), currentHash: 'e'.repeat(64) }),
    item('tests', 'test', 'test result '.repeat(20)),
  ];
  const planner = kernel.plan({ projectId: 'p1', principalId: 'user-1', role: 'planner', items });
  const executor = kernel.plan({ projectId: 'p1', principalId: 'user-1', role: 'executor', items });
  assert.equal(planner.budgetTokens, 120);
  assert.equal(executor.budgetTokens, 80);
  assert.ok(planner.usedTokens <= planner.budgetTokens);
  assert.ok(executor.usedTokens <= executor.budgetTokens);
  assert.equal(planner.items.find((entry) => entry.id === 'fresh-code').freshness, 'fresh');
  assert.equal(planner.items.find((entry) => entry.id === 'stale-code').freshness, 'stale');
  assert.ok(planner.sourceUsage.code.estimatedTokens > 0);
  assert.ok(planner.sourceUsage.test.estimatedTokens > 0);
  assert.throws(() => kernel.plan({ projectId: 'p1', principalId: 'user-1', role: 'executor', budgetTokens: 81, items }), /may only lower/i);
});

test('kernel omits unauthorized and cross-project context with explicit reasons', () => {
  const kernel = new ContextOrchestrationKernel({ clock: () => now });
  const plan = kernel.plan({ projectId: 'p1', principalId: 'user-1', role: 'reviewer', items: [
    item('allowed', 'diff', 'safe diff', { allowedRoles: ['reviewer'] }),
    item('wrong-role', 'memory', 'executor only', { allowedRoles: ['executor'] }),
    item('wrong-user', 'memory', 'private note', { allowedPrincipals: ['other-user'] }),
    { ...item('other-project', 'code', 'foreign code'), projectId: 'p2' },
    item('secret', 'log', 'token=sk-secret-1234567890'),
  ] });
  assert.deepEqual(plan.selected.map((entry) => entry.id), ['allowed', 'secret']);
  assert.deepEqual(plan.omissions.filter((entry) => entry.reason.includes('denied')).map((entry) => entry.id).sort(), ['other-project', 'wrong-role', 'wrong-user']);
  assert.doesNotMatch(JSON.stringify(plan), /sk-secret-1234567890/);
});

test('kernel utility mode selects marginal value and reserves counter evidence under the role budget', () => {
  const kernel = new ContextOrchestrationKernel({ clock: () => now, budgets: { executor: 100 }, selectionMode: 'utility', counterEvidenceRatio: 0.2 });
  const plan = kernel.plan({ projectId: 'p1', principalId: 'user-1', role: 'executor', items: [
    item('long-low', 'code', 'low value '.repeat(35), { relevance: 0.4, trust: 0.8, decisionImpact: 0.4, coverage: 0.5 }),
    item('small-high', 'diagnostics', 'TypeError validateSession', { relevance: 1, trust: 0.95, decisionImpact: 1, coverage: 0.9, symbol: 'validateSession' }),
    item('counter', 'test', 'Cache disabled but failure remains', { relevance: 0.7, trust: 0.95, decisionImpact: 0.9, coverage: 0.8, polarity: 'counter', contradicts: ['h1'] }),
  ] });
  assert.equal(plan.selectionMode, 'utility');
  assert.equal(plan.selected[0].id, 'small-high');
  assert.equal(plan.selected.some((entry) => entry.id === 'counter'), true);
  assert.ok(plan.usedTokens <= 100);
  assert.ok(plan.counterEvidenceTokens > 0);
});
