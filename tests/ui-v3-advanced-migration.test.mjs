import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONTROL_PLANE_ROUTES } from '../ui-v3/control-plane/route-registry.mjs';

test('workroom contains development surfaces but no secrets update or plugin administration', async () => {
  const source = await readFile('ui-v3/views/workroom/workroom-view.mjs', 'utf8');
  assert.match(source, /Files/);
  assert.match(source, /Agent \/ Terminal/);
  assert.doesNotMatch(source, /secret|credential|signed update|plugin center/i);
});

test('advanced administration has dedicated Control Plane routes', () => {
  assert.equal(typeof CONTROL_PLANE_ROUTES['trust-security'], 'function');
  assert.equal(typeof CONTROL_PLANE_ROUTES.extensions, 'function');
  assert.equal(typeof CONTROL_PLANE_ROUTES.release, 'function');
  assert.equal(typeof CONTROL_PLANE_ROUTES.autonomy, 'function');
});
