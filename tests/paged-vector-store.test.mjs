import test from 'node:test';
import assert from 'node:assert/strict';
import { PagedVectorStore } from '../src/intelligence-completion/paged-vector-store.mjs';

const H = (c) => c.repeat(64);
const records = Array.from({ length: 6 }, (_, index) => ({
  id: `r${index + 1}`,
  vector: [index + 1, 0, index % 2 ? 1 : -1, 2],
  metadata: { path: `src/f${index + 1}.mjs` },
  contentSha256: H(String((index + 1) % 10)),
}));

test('stores quantized vectors in checksummed pages and reads only selected pages', async () => {
  const store = new PagedVectorStore({ pageSize: 2, maxLoadedBytes: 4096 });
  const built = await store.build({ indexId: 'repo-main', records });
  assert.equal(built.manifest.pages.length, 3);
  assert.ok(built.manifest.pages.every((page) => /^[a-f0-9]{64}$/.test(page.pageSha256)));
  const selected = built.manifest.pages[1].pageId;
  const result = await store.search({ indexId: 'repo-main', queryVector: [3, 0, 1, 2], pageIds: [selected], limit: 5 });
  assert.equal(result.telemetry.pagesRead, 1);
  assert.equal(result.telemetry.pageIds[0], selected);
  assert.ok(result.telemetry.peakLoadedBytes < result.telemetry.totalVectorBytes);
  assert.ok(result.items.every((item) => ['r3', 'r4'].includes(item.id)));
});

test('fails closed on corruption, dimension mismatch, duplicate ids, and page budget overflow', async () => {
  const store = new PagedVectorStore({ pageSize: 2, maxLoadedBytes: 4096 });
  const built = await store.build({ indexId: 'repo-main', records });
  await assert.rejects(() => store.search({ indexId: 'repo-main', queryVector: [1, 2], limit: 2 }), /dimension/);
  await assert.rejects(() => store.build({ indexId: 'duplicates', records: [records[0], records[0]] }), /duplicate/i);
  store.__testCorruptPage(built.manifest.pages[0].pageId);
  await assert.rejects(() => store.readPage({ indexId: 'repo-main', pageId: built.manifest.pages[0].pageId }), /checksum/i);

  const tiny = new PagedVectorStore({ pageSize: 2, maxLoadedBytes: 16 });
  await assert.rejects(() => tiny.build({ indexId: 'tiny', records: records.slice(0, 2) }), /page budget/i);
});

test('automatic page selection remains bounded', async () => {
  const store = new PagedVectorStore({ pageSize: 2, maxLoadedBytes: 4096, defaultMaxPages: 1 });
  await store.build({ indexId: 'repo-main', records });
  const result = await store.search({ indexId: 'repo-main', queryVector: [6, 0, 1, 2], limit: 2 });
  assert.equal(result.telemetry.pagesRead, 1);
  assert.equal(result.claims.fullIndexLoadedIntoMemory, false);
});
