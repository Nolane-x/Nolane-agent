import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyThirdPartyProvenance } from '../src/release/third-party-provenance.mjs';

test('third party provenance preserves MIT attribution and clean-room transformation accounting', async () => {
  const noticeText = await readFile('THIRD_PARTY_NOTICES.md', 'utf8');
  const receipt = verifyThirdPartyProvenance({ noticeText });
  assert.equal(receipt.valid, true);
  assert.equal(receipt.historicalResearchAttribution.upstream, 'Nous Research');
  assert.equal(receipt.historicalResearchAttribution.license, 'MIT');
  assert.equal(receipt.historicalResearchAttribution.runtimeDistributed, false);
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('third party provenance rejects missing attribution, ownership inflation and distributed external runtime claims', async () => {
  const noticeText = await readFile('THIRD_PARTY_NOTICES.md', 'utf8');
  assert.throws(() => verifyThirdPartyProvenance({ noticeText: noticeText.replaceAll('Nous Research', 'Unknown') }), /Nous Research attribution/);
  assert.throws(() => verifyThirdPartyProvenance({ noticeText: `${noticeText}\nNolane owns upstream source code.` }), /ownership claim/);
  assert.throws(() => verifyThirdPartyProvenance({ noticeText: noticeText.replace('No upstream archive, runtime, API route, executable integration, model profile, adapter, or package is distributed by Nolane Agent.', 'An upstream runtime package is distributed by Nolane Agent.') }), /runtime purity statement/);
});
