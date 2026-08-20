import test from 'node:test';
import assert from 'node:assert/strict';

import { localRequestToken, sameLocalSecret } from '../src/server/local-session-auth.mjs';

test('local session authentication ignores URL query values and compares secrets consistently', () => {
  assert.equal(localRequestToken({ url: '/terminal?token=not-accepted', headers: {} }), null);
  assert.equal(sameLocalSecret('same-secret', 'same-secret'), true);
  assert.equal(sameLocalSecret('same-secret', 'different-secret'), false);
  assert.equal(sameLocalSecret('short', 'longer-secret'), false);
});
