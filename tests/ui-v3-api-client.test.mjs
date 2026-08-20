import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../ui-v3/core/api-client.mjs';

test('API client authenticates with a header and never appends the local token to request URLs', async () => {
  const requests = [];
  const api = createApiClient({
    token: 'local-secret',
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  });

  await api.get('/api/projects?view=recent');
  assert.equal(requests[0].url, '/api/projects?view=recent');
  assert.equal(requests[0].init.headers.authorization, 'Bearer local-secret');
  assert.doesNotMatch(requests[0].url, /token=/);
});
