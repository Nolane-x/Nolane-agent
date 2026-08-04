import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('repository intelligence fabric owns one lazy polyglot plane and app closes CodeIntelligenceService', () => {
  const fabric = fs.readFileSync(new URL('../src/repository/repository-intelligence-fabric.mjs', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(fabric, /PolyglotIntelligencePlane/);
  assert.match(fabric, /polyglotStatus/);
  assert.match(app, /await codeIntelligence\.close\(\)/);
});
