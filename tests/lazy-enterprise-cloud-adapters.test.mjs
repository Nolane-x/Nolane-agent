import test from 'node:test';
import assert from 'node:assert/strict';

import { createLazyEnterpriseCloudAdapters } from '../src/runtime/lazy-enterprise-cloud-adapters.mjs';

test('local requests bypass enterprise activation while enterprise routes activate once', async () => {
  let activations = 0;
  const module = {
    enterpriseCloudRoutes: async () => true,
    requestAuthorizer: async () => ({ decision: 'allow', code: 'enterprise' }),
    enterpriseService: { authorize: () => ({ decision: 'allow' }) },
    oidcHttp: { handle: async () => true, authenticateRequest: async () => ({ subject: 's1' }) },
    scimHttp: { handle: async () => true, writeError() {} },
  };
  const adapters = createLazyEnterpriseCloudAdapters({ moduleManager: { async activate() { activations += 1; return module; } }, oidcConfigured: true, scimConfigured: true });
  assert.deepEqual(await adapters.requestAuthorizer({ principal: { kind: 'local-token' } }), { decision: 'allow', code: 'local-token' });
  assert.equal(activations, 0);
  assert.equal(await adapters.enterpriseCloudRoutes({}, {}, new URL('http://x/api/projects')), false);
  assert.equal(activations, 0);
  assert.equal(await adapters.enterpriseCloudRoutes({}, {}, new URL('http://x/api/enterprise/audit')), true);
  assert.equal(activations, 1);
  assert.equal((await adapters.oidcHttp.authenticateRequest({})).subject, 's1');
  assert.equal(await adapters.scimHttp.handle({}, {}, new URL('http://x/scim/v2/Users')), true);
  assert.equal(activations, 3);
});

test('enterprise adapters remain absent when OIDC and SCIM are not configured', () => {
  const adapters = createLazyEnterpriseCloudAdapters({ moduleManager: { activate() { throw new Error('unused'); } } });
  assert.equal(adapters.oidcHttp, null);
  assert.equal(adapters.scimHttp, null);
});
