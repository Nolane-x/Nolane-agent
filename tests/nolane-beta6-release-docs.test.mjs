import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const version = '5.0.0-beta.6';
const files = [
  `docs/RELEASE-${version}.md`,
  `docs/LIMITATIONS-${version}.md`,
  `docs/VERIFICATION-REPORT-${version}.md`,
  `docs/NOLANE-AGENT-${version.toUpperCase()}-STATUS.md`,
  `docs/NATIVE-CORE-PARITY-${version}.md`,
];

test('beta.6 release documents report runtime wave6 evidence and preserve non-claims', async () => {
  const text = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.match(text, /5\.0\.0-beta\.6/);
  assert.match(text, /75[^\n]*contract/i);
  assert.match(text, /52[^\n]*verified/i);
  assert.match(text, /23[^\n]*external/i);
  assert.match(text, /413[^\n]*path/i);
  assert.match(text, /completeParityClaimAllowed=false/);
  assert.match(text, /superiorityClaimAllowed=false/);
});
