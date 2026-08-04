import test from 'node:test';
import assert from 'node:assert/strict';

import { createEnterpriseRequestAuthorizer } from '../src/enterprise/enterprise-request-authorizer.mjs';

function fixture() {
  const calls = [];
  const authorize = createEnterpriseRequestAuthorizer({
    enterpriseService: {
      async authorize(input) {
        calls.push(input);
        return Object.freeze({ decision: 'allow', code: 'allowed' });
      },
    },
  });
  return { authorize, calls };
}

test('enterprise authorizer accepts canonical Nolane tenant header and rejects mismatches', async () => {
  const { authorize, calls } = fixture();
  const principal = { subject: 'user-1', organizationId: 'org-1', mfa: true };
  const allowed = await authorize({
    req: { method: 'GET', headers: { 'x-nolane-organization': 'org-1' } },
    url: new URL('http://127.0.0.1/api/projects'),
    principal,
  });
  assert.equal(allowed.decision, 'allow');
  assert.equal(calls.length, 1);

  const denied = await authorize({
    req: { method: 'GET', headers: { 'x-nolane-organization': 'org-other' } },
    url: new URL('http://127.0.0.1/api/projects'),
    principal,
  });
  assert.deepEqual(denied, {
    decision: 'deny',
    code: 'tenant-header-mismatch',
    reason: 'The requested organization differs from the authenticated tenant.',
  });
  assert.equal(calls.length, 1);
});

test('legacy Forge tenant header remains a bounded migration fallback', async () => {
  const { authorize, calls } = fixture();
  const result = await authorize({
    req: { method: 'GET', headers: { 'x-forge-organization': 'org-1' } },
    url: new URL('http://127.0.0.1/api/projects'),
    principal: { subject: 'user-1', organizationId: 'org-1' },
  });
  assert.equal(result.decision, 'allow');
  assert.equal(calls.length, 1);
});
