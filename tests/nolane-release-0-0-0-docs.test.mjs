import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCT_IDENTITY } from '../src/product-identity.mjs';

const version = PRODUCT_IDENTITY.version;
const files = [
  `README.md`,
  `docs/RELEASE-${version}.md`,
  `docs/LIMITATIONS-${version}.md`,
  `docs/VERIFICATION-REPORT-${version}.md`,
  `docs/REMAINING-GAPS-${version}.md`,
];

test('current release documents describe GitHub-only desktop delivery and preserve current non-claims', async () => {
  const documents = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  for (const document of documents) {
    assert.ok(document.includes(`Nolane Agent ${version}`));
    assert.doesNotMatch(document, /Forge Studio/);
  }
  const text = documents.join('\n');
  assert.ok(text.includes(`Nolane Agent ${version}`));
  assert.match(text, /GitHub Actions is the only release packaging environment/i);
  assert.match(text, /Windows NSIS/i);
  assert.match(text, /macOS DMG and ZIP/i);
  assert.match(text, /Linux AppImage and DEB/i);
  assert.match(text, /Download update/i);
  assert.match(text, /Update and restart/i);
  assert.match(text, /external gates/i);
  assert.match(text, /completeParityClaimAllowed=false/);
  assert.match(text, /superiorityClaimAllowed=false/);
});
