import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DecisionPlane } from '../src/decision/decision-plane.mjs';

test('DecisionPlane loads Construction Control Plane lazily', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-decision-construction-'));
  const plane = new DecisionPlane({ construction: { capsuleRoot: root } });
  assert.equal(plane.snapshot().lifecycle.constructionLoaded, false);
  const spec = plane.compileConstructionSpecification({ specificationId: 's1', goal: 'Safe change', criteria: [{ criterionId: 'c1', statement: 'Works', weight: 1 }], verificationPlan: [{ verificationId: 'v1', criterionIds: ['c1'], kind: 'test' }] });
  assert.equal(spec.status, 'ready');
  const snapshot = plane.snapshot();
  assert.equal(snapshot.lifecycle.constructionLoaded, true);
  assert.equal(snapshot.construction.lifecycle.specifications, 1);
  assert.equal(snapshot.construction.claims.privateReasoningStored, false);
  plane.close();
});
