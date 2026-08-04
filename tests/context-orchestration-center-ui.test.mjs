import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleSource = await readFile(new URL('../ui/context-memory-center.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../ui/context-memory-center.css', import.meta.url), 'utf8');

test('Context & Memory Center exposes orchestration planning, accounting, omissions, checkpoints, and paging', () => {
  assert.match(moduleSource, /orchestration:'Orchestration'/);
  assert.match(moduleSource, /\/api\/context-orchestration\/plan/);
  assert.match(moduleSource, /\/api\/context-orchestration\/checkpoints/);
  for (const label of ['Current errors','Freshness','Staleness','Tokens by source','Compaction','Permission omissions','Create checkpoint','Read checkpoint page']) assert.match(moduleSource, new RegExp(label));
  assert.match(css, /cm-orchestration-grid/);
  assert.match(css, /cm-token-ledger/);
});
