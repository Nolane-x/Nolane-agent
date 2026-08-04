import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const version = '5.0.0-beta.3';
const required = [
  `docs/RELEASE-${version}.md`,
  `docs/LIMITATIONS-${version}.md`,
  `docs/VERIFICATION-REPORT-${version}.md`,
  `docs/NOLANE-AGENT-${version.toUpperCase()}-STATUS.md`,
  `docs/NATIVE-CORE-PARITY-${version}.md`,
];

test('beta.3 release documents report native core evidence and preserve external non-claims', async () => {
  const text = (await Promise.all(required.map((file) => readFile(file, 'utf8')))).join('\n');
  for (const phrase of [
    'Master Acceptance Ledger',
    '2,110 upstream source/config candidate paths',
    '240 verified upstream paths',
    '61 behavioral contracts',
    '34 verified contracts',
    '27 external contracts',
    'completeParityClaimAllowed=false',
    'superiorityClaimAllowed=false',
    'The legacy external runtime and archive remain absent',
    'provider-real',
    'Windows',
  ]) assert.match(text, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), phrase);
  assert.doesNotMatch(text, /complete native parity (?:is )?(?:verified|proven)/i);
  assert.doesNotMatch(text, /Nolane (?:is|has been) superior/i);
});
