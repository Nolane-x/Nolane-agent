import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { buildVsCodeExtension } from '../scripts/build-vscode-extension.mjs';
const require = createRequire(import.meta.url);

test('VS Code mission state bridge projects bounded collaboration state and rejects private fields', async () => {
  await buildVsCodeExtension();
  const modulePath = path.resolve('extensions/vscode/extension/dist/mission-state.js');
  delete require.cache[modulePath];
  const { projectCollaborationMissionState } = require(modulePath);
  const projected = projectCollaborationMissionState({
    schema: 'forge.collaboration-experience-plane.v1', receiptSha256: 'f'.repeat(64),
    reviewQueue: { items: [{ itemId: 'r1', kind: 'hunk', target: 'src/app.mjs', risk: 'high', state: 'pending', receiptSha256: 'a'.repeat(64) }] },
    playback: { checkpoints: [{ checkpointId: 'cp1', gitCommit: 'abc', verificationReceiptSha256: 'b'.repeat(64) }], events: Array.from({ length: 150 }, (_, i) => ({ type: 'read', summary: `event ${i}`, artifactSha256: 'c'.repeat(64) })) },
    steering: { missions: [{ missionId: 'm1', revision: 2, state: 'paused', commands: [{ action: 'pause', reason: 'review', evidenceReceiptSha256: 'd'.repeat(64) }] }] },
    blackboard: { entries: [{ key: 'fact-1' }] }, commitments: { commitments: [{ commitmentId: 'c1' }] },
  });
  assert.equal(projected.schema, 'nolane.agent.vscode-collaboration-state.v1');
  assert.equal(projected.reviews[0].itemId, 'r1');
  assert.equal(projected.playback.events.length, 100);
  assert.equal(projected.missions[0].state, 'paused');
  assert.doesNotMatch(JSON.stringify(projected), /\"rawDiff\"|not exported/);
  assert.throws(() => projectCollaborationMissionState({ reviewQueue: { items: [{ rawDiff: 'secret' }] } }), /private/i);
  assert.throws(() => projectCollaborationMissionState({ rawPrompt: 'secret' }), /private/i);
});
