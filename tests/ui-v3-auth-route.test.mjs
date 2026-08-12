import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFromHash, scrubBootstrapToken } from '../ui-v3/core/route-auth.mjs';

test('hash routing retains user route state while removing the local bootstrap token', () => {
  assert.equal(routeFromHash('#/?token=local-secret'), '/');
  assert.equal(routeFromHash('#/workroom?project=p1&token=local-secret'), '/workroom?project=p1');
  assert.equal(routeFromHash('#/missions?id=m1'), '/missions?id=m1');
});

test('bootstrap cleanup removes a local token from both the page and route without losing route state', () => {
  let replaced = null;
  const changed = scrubBootstrapToken({
    locationObject: { href: 'http://127.0.0.1:4188/?token=page-secret#/workroom?project=demo&token=hash-secret' },
    historyObject: { state: { active: true }, replaceState: (_state, _title, value) => { replaced = value; } },
  });
  assert.equal(changed, true);
  assert.equal(replaced, '/#/workroom?project=demo');
});

test('bootstrap cleanup preserves a URL that never contained a local token', () => {
  assert.equal(scrubBootstrapToken({
    locationObject: { href: 'http://127.0.0.1:4188/#/workroom?project=demo' },
    historyObject: { replaceState() { assert.fail('must not replace clean URL'); } },
  }), false);
});
