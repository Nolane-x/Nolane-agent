import test from 'node:test';
import assert from 'node:assert/strict';
import { createControlPlaneModel } from '../ui-v3/control-plane/control-plane-shell.mjs';
test('Control Plane shell preserves healthy navigation after a route failure', async () => {
  const model = createControlPlaneModel({ loader: async (domain) => { if (domain === 'runtime') throw new Error('boom'); return { domain }; } });
  assert.equal((await model.navigateSafe('/control-plane/runtime')).status, 'error');
  assert.equal((await model.navigateSafe('/control-plane/overview')).status, 'ready');
});
