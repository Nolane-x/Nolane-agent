import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

test('every package script references files that exist and VS Code builds reproducibly before validation', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    const matches = [...String(command).matchAll(/(?:^|\s)(scripts\/[\w.-]+\.(?:mjs|js|sh|ps1))/g)];
    for (const [, relative] of matches) {
      await assert.doesNotReject(access(path.resolve(relative)), `${name} references missing ${relative}`);
    }
  }
  assert.equal(pkg.scripts.test, 'node scripts/run-node-test-suite.mjs');
  assert.equal(pkg.scripts['build:vscode'], 'node scripts/build-vscode-extension.mjs && node scripts/validate-vscode-extension.mjs');
  assert.equal(pkg.scripts['audit:features'], 'node scripts/audit-feature-checklist.mjs docs/source-feature-checklist-vn.txt docs');
});
