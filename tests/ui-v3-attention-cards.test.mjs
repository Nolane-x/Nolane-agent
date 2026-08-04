import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttentionCard } from '../ui-v3/views/mission/attention-card.mjs';

test('permission card exposes action, reason, impact, scope and reversibility without raw backend jargon', () => {
  const card = createAttentionCard({
    kind: 'permission', action: 'Run a command outside the project folder', why: 'Read the installed runtime version',
    impact: 'Reads system configuration; no files will be changed', scope: ['C:/Program Files/Nolane'], reversible: true,
    options: ['allow-once', 'allow-project', 'deny'], technical: { capabilityId: 'system:read' },
  });
  assert.equal(card.kind, 'permission');
  assert.equal(card.requiresAction, true);
  assert.equal(card.reversibility, 'reversible');
  assert.deepEqual(card.options.map((item) => item.id), ['allow-once', 'allow-project', 'deny']);
  assert.equal(card.technicalDetails.expanded, false);
  assert.doesNotMatch(card.summary, /lease|runtime fabric|receipt/i);
});

test('irreversible actions cannot omit impact or a safe denial option', () => {
  assert.throws(() => createAttentionCard({ kind: 'approval', action: 'Force push', why: 'Publish', impact: '', scope: ['origin/main'], reversible: false, options: ['approve'] }), /impact/i);
  assert.throws(() => createAttentionCard({ kind: 'approval', action: 'Force push', why: 'Publish', impact: 'Rewrites remote history', scope: ['origin/main'], reversible: false, options: ['approve'] }), /deny|cancel/i);
});
