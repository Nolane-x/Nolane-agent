import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_PLANE_DOMAINS, createControlPlaneModel, renderControlPlaneShell } from '../ui-v3/control-plane/control-plane-shell.mjs';
import { buildCapabilitiesViewModel, renderCapabilitiesView } from '../ui-v3/control-plane/domains/capabilities.mjs';

test('Control Plane uses textual domain navigation and preserves mission deep-link context', async () => {
  const loads = new Map(); const suspends = [];
  const loader = async (domain) => { loads.set(domain, (loads.get(domain) ?? 0) + 1); return { domain, suspend: () => suspends.push(domain) }; };
  const model = createControlPlaneModel({ missionContext: { missionId: 'm1', stepId: 's2', returnPath: '/missions/m1' }, loader });
  await model.navigate('/control-plane/runtime/processes');
  await model.navigate('/control-plane/evidence/receipts');
  await model.navigate('/control-plane/runtime/processes');
  const value = model.snapshot();
  assert.equal(loads.get('runtime'), 1);
  assert.equal(loads.get('evidence'), 1);
  assert.ok(suspends.includes('runtime'));
  assert.equal(value.missionContext.returnPath, '/missions/m1');
  assert.equal(CONTROL_PLANE_DOMAINS.length >= 10, true);
  const html = renderControlPlaneShell(value);
  assert.match(html, /Back to Mission/);
  assert.doesNotMatch(html, /aria-label="icon-only"/);
});

test('Control Plane rejects unknown domains instead of silently loading a drawer', async () => {
  const model = createControlPlaneModel({ loader: async (domain) => ({ domain }) });
  await assert.rejects(() => model.navigate('/control-plane/not-real'), /unknown control plane domain/i);
});

test('Control Plane localizes expert navigation and capability atlas without leaking its English chrome', () => {
  const snapshot = { domains: CONTROL_PLANE_DOMAINS, activeDomain: 'capabilities', activePath: '/control-plane/capabilities', missionContext: null };
  const shell = renderControlPlaneShell(snapshot, { language: 'vi' });
  assert.match(shell, /Tổng quan/);
  assert.match(shell, /Bản đồ khả năng/);
  assert.doesNotMatch(shell, />Overview</);
  const atlas = renderCapabilitiesView(buildCapabilitiesViewModel({ language: 'vi' }));
  assert.match(atlas, /Bản đồ sự thật backend/);
  assert.match(atlas, /Lọc route/);
  assert.doesNotMatch(atlas, />Backend truth map</);
});
