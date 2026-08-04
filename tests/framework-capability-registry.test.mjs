import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameworkCapabilityRegistry } from '../src/repository/framework-capability-registry.mjs';

test('FrameworkCapabilityRegistry only reports frameworks with exact manifest evidence', () => {
  const r = new FrameworkCapabilityRegistry();
  const result = r.probe({ packageJson: { dependencies: { express: '^5.0.0' } }, files: ['src/server.mjs'] });
  assert.equal(result.frameworks.find((x) => x.id === 'express').status, 'detected');
  assert.equal(result.frameworks.find((x) => x.id === 'nextjs').status, 'unavailable');
  assert.equal(result.inferredSilently, false);
});
