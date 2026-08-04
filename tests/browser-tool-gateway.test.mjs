import test from 'node:test';
import assert from 'node:assert/strict';

import { BrowserToolGateway } from '../src/browser/browser-tool-gateway.mjs';

function service() {
  const calls = [];
  const api = { calls };
  for (const name of ['open', 'goto', 'snapshot', 'find', 'click', 'fill', 'press', 'tabs', 'screenshot', 'close', 'status']) api[name] = async (input) => { calls.push([name, structuredClone(input)]); return { output: `${name}:ok`, untrusted: true, artifactPath: name === 'screenshot' ? '/tmp/a.png' : null }; };
  return api;
}

test('BrowserToolGateway exposes only task-authorized schemas and creates governed receipts', async () => {
  const browser = service();
  const gateway = new BrowserToolGateway({ service: browser });
  const task = { id: 'task-1', projectId: 'project-1', missionId: 'm1', metadata: { browserAllowedActions: ['snapshot', 'click'] } };
  const schemas = gateway.schemasForTask(task);
  assert.deepEqual(schemas.map((item) => item.function.name), ['browser.snapshot', 'browser.click']);
  const result = await gateway.execute(task, 'browser.click', { target: 'e3' }, { refs: { missionId: 'm1' } });
  assert.equal(result.status, 'pass');
  assert.equal(result.output.untrusted, true);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(browser.calls[0], ['click', { projectId: 'project-1', target: 'e3', leaseContext: { missionId: 'm1', taskId: 'task-1', action: 'click' }, signal: null }]);
});

test('BrowserToolGateway is deny-by-default and blocks unknown or non-authorized actions', async () => {
  const gateway = new BrowserToolGateway({ service: service() });
  const task = { id: 'task-1', projectId: 'project-1', metadata: {} };
  assert.deepEqual(gateway.schemasForTask(task), []);
  await assert.rejects(() => gateway.execute(task, 'browser.open', { url: 'https://example.com' }), /not allowlisted/i);
  await assert.rejects(() => gateway.execute({ ...task, metadata: { browserAllowedActions: ['open'] } }, 'browser.shell', {}), /unsupported/i);
});
