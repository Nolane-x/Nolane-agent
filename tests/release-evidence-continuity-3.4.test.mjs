import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8');
}

test('3.4 limitations retain the complete 3.3 boundary corpus verbatim', async () => {
  const previous = await read('docs/LIMITATIONS-3.3.0.md');
  const current = await read('docs/LIMITATIONS-3.4.0.md');
  const retainedBody = previous.split('\n').slice(1).join('\n').trim();

  assert.ok(
    current.includes(retainedBody),
    'LIMITATIONS-3.4.0.md must retain every 3.3 non-claim and platform boundary verbatim',
  );
});

test('3.4 limitations retain current audit references and construction safety non-claims', async () => {
  const current = await read('docs/LIMITATIONS-3.4.0.md');

  for (const required of [
    'docs/feature-audit-3.4.0.json',
    'docs/REMAINING-GAPS-3.4.0.md',
    'Candidate worktree không tự động merge',
    'Mutation probe chỉ chứng minh mutation cụ thể',
    'không tuyên bố vượt',
  ]) {
    assert.match(current, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
});
