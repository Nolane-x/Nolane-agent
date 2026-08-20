import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JsonlRpcProcess } from '../src/protocol/jsonl-rpc-process.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(root, 'fixtures', 'mcp-server.mjs');

test('JsonlRpcProcess does not inherit undeclared parent variables by default', async (t) => {
  const inheritedName = 'NOLANE_TEST_PARENT_SECRET';
  const previous = process.env[inheritedName];
  process.env[inheritedName] = 'parent-only';
  t.after(() => {
    if (previous === undefined) delete process.env[inheritedName];
    else process.env[inheritedName] = previous;
  });

  const rpc = new JsonlRpcProcess({ executable: process.execPath, args: [fixture] });
  t.after(() => rpc.close());
  await rpc.start();
  const result = await rpc.request('test/environment', { names: [inheritedName] });

  assert.deepEqual(result.present, { [inheritedName]: false });
});
