import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

test('package scripts reference existing entrypoints and expose the clean 0.0.0 quality surface', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    const matches = [...String(command).matchAll(/(?:^|\s)(scripts\/[\w.-]+\.(?:mjs|js|sh|ps1))/g)];
    for (const [, relative] of matches) {
      await assert.doesNotReject(access(path.resolve(relative)), `${name} references missing ${relative}`);
    }
  }

  assert.equal(pkg.scripts.test, 'node scripts/run-node-test-suite.mjs');
  assert.equal(pkg.scripts.validate, 'npm run verify:version && npm run test:core && npm run test:release && node --check src/app.mjs');
  assert.equal(pkg.scripts['build:vscode'], 'node scripts/build-vscode-extension.mjs && node scripts/validate-vscode-extension.mjs');
  assert.equal(pkg.scripts['build:ui'], 'node scripts/build-ui-v3.mjs');
  assert.equal(pkg.scripts['release:manifest'], 'node scripts/create-release-manifest.mjs');

  for (const retired of ['program:nolane', 'audit:evidence-freshness', 'audit:features', 'verify:product-perfection']) {
    assert.equal(Object.hasOwn(pkg.scripts, retired), false, `${retired} must not re-enter the public 0.0.x script surface`);
  }
});
