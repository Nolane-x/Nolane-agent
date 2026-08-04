import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CodexAppServerClient } from '../src/providers/codex-app-server.mjs';
import { ProviderSessionHost } from '../src/providers/provider-session-host.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(root, 'fixtures', 'codex-app-server.mjs');

test('Codex App Server reuses one thread through ProviderSessionHost', async (t) => {
  const provider = new CodexAppServerClient({ executable: process.execPath, args: [fixture], timeoutMs: 1_000, approvalHandler: async () => ({ decision: 'accept' }) });
  const host = new ProviderSessionHost({ governor: { snapshot: () => ({ state: 'normal' }) } });
  t.after(async () => { await host.close(); await provider.close(); });
  const common = { provider, scope: { projectId: 'p1', missionId: 'm1', repositoryId: 'repo1' }, fingerprint: 'repo-head:harness:tools' };
  const first = await host.complete({ ...common, request: { messages: [{ role: 'user', content: 'first' }] } });
  const second = await host.complete({ ...common, request: { messages: [{ role: 'user', content: 'second' }] } });
  assert.equal(first.raw.threadId, second.raw.threadId);
  assert.equal(second.sessionHost.reused, true);
  assert.equal(provider.processDescriptor().rootPid > 0, true);
});
