import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { evidenceFileSha256 } from '../src/release/evidence-file-hash.mjs';

const rawSha256 = (value) => createHash('sha256').update(value).digest('hex');

test('evidence file hashes canonicalize text line endings across runners', () => {
  assert.equal(evidenceFileSha256(Buffer.from('alpha\r\nbeta\r\n')), evidenceFileSha256(Buffer.from('alpha\nbeta\n')));
  assert.equal(evidenceFileSha256(Buffer.from('alpha\nbeta\n')), rawSha256('alpha\nbeta\n'));
});

test('evidence file hashes preserve binary bytes', () => {
  const binary = Buffer.from([0x00, 0x0d, 0x0a, 0xff]);
  assert.equal(evidenceFileSha256(binary), rawSha256(binary));
});
