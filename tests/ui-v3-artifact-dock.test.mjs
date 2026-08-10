import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtifactDockModel, buildArtifactDockTabs, createPreviewArtifactModel, renderArtifactDock } from '../ui-v3/views/mission/artifact-dock.mjs';

test('Artifact Dock exposes only context-backed tabs in product priority order', () => {
  const tabs = buildArtifactDockTabs([
    { id: 't1', type: 'tests' }, { id: 'c1', type: 'changes' }, { id: 'p1', type: 'preview' }, { id: 'x1', type: 'unknown' },
  ]);
  assert.deepEqual(tabs.map((item) => item.id), ['preview', 'changes', 'tests']);
});

test('Artifact Dock preserves keyed artifacts and clamps user width', () => {
  const model = createArtifactDockModel({ missionId: 'm1' });
  model.update([{ id: 'p1', type: 'plan', title: 'Plan' }]);
  const first = model.snapshot();
  const identity = first.artifactKeys.get('p1');
  model.setWidth(9999); model.select('plan'); model.setPinned(true);
  model.update([{ id: 'p1', type: 'plan', title: 'Updated plan' }]);
  const second = model.snapshot();
  assert.equal(second.width, 720);
  assert.equal(second.activeTab, 'plan');
  assert.equal(second.pinned, true);
  assert.equal(second.artifactKeys.get('p1'), identity);
});

test('preview artifact records bounded before-after snapshots and annotations', () => {
  const preview = createPreviewArtifactModel({ artifactId: 'preview-1' });
  preview.setStatus('ready');
  preview.recordSnapshot({ phase: 'before', sha256: 'a'.repeat(64), capturedAt: '2026-08-01T00:00:00.000Z' });
  preview.recordSnapshot({ phase: 'after', sha256: 'b'.repeat(64), capturedAt: '2026-08-01T00:00:01.000Z' });
  preview.annotate({ selector: '#save', bounds: { x: 1, y: 2, width: 30, height: 20 }, note: 'Button is clipped' });
  const value = preview.snapshot();
  assert.equal(value.status, 'ready');
  assert.equal(value.snapshots.length, 2);
  assert.equal(value.annotations[0].selector, '#save');
  assert.throws(() => preview.recordSnapshot({ phase: 'after', sha256: 'bad' }), /sha256/i);
});

test('Artifact Dock localizes tab labels and accessible chrome', () => {
  const model = createArtifactDockModel({ missionId: 'm1' });
  model.update([{ id: 'p1', type: 'preview', title: 'Preview' }]);
  const html = renderArtifactDock(model.snapshot(), { language: 'vi' });
  assert.match(html, /Xem trước/);
  assert.match(html, /Artifact của nhiệm vụ/);
  assert.doesNotMatch(html, /Mission artifacts/);
});
