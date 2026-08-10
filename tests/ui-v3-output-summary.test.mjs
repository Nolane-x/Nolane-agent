import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOutputSummary, createOutputSummaryController } from '../ui-v3/views/summary/output-summary.mjs';

test('output summary renders outputs background processes and sources with empty states', async () => {
  const api = { get: async () => ({ outputs:[{id:'workspace',path:'/repo',kind:'workspace'}], processes:[{id:'npm-test',label:'npm test',state:'running'}], sources:[{id:'context7',label:'Context7',state:'ready'}] }) };
  const controller = createOutputSummaryController({ api, setIntervalImpl: () => 1, clearIntervalImpl: () => {} });
  await controller.refresh();
  const html = renderOutputSummary(controller.snapshot());
  assert.match(html, /Outputs/);
  assert.match(html, /Background processes/);
  assert.match(html, /Sources/);
  assert.match(html, /npm test/);
});

test('output summary localizes its chrome when Vietnamese is active', () => {
  const html = renderOutputSummary({ language: 'vi', open: true, status: 'ready', value: { outputs: [], processes: [], terminals: [], sources: [], availability: {} } });
  assert.match(html, /Tóm tắt hoạt động/);
  assert.match(html, /Tiến trình nền/);
  assert.match(html, /Chưa có nguồn kết nối/);
  assert.doesNotMatch(html, />Activity summary</);
});
