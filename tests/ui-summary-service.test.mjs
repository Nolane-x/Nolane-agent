import test from 'node:test';
import assert from 'node:assert/strict';
import { UiSummaryService } from '../src/ui/ui-summary-service.mjs';

test('UI summary combines bounded outputs processes terminals and sources', async () => {
  const service = new UiSummaryService({
    getWorkspace: () => ({ id: 'p1', root: '/repo' }),
    managedProcesses: { list: () => [{ id: 'test', command: 'npm', args: ['test'], state: 'running', stdout: 'x'.repeat(5000), stderr: '' }] },
    terminalManager: { list: () => [{ id: 'term-1', shell: 'pwsh', state: 'running' }] },
    mcpRegistry: { publicView: () => [{ id: 'context7', state: 'ready', tools: 10 }] },
    maxText: 120,
  });
  const view = await service.snapshot({ projectId: 'p1' });
  assert.equal(view.outputs[0].path, '/repo');
  assert.equal(view.processes.length, 2);
  assert.equal(view.sources[0].id, 'context7');
  assert.deepEqual(view.availability, { outputs: true, processes: true, terminals: true, sources: true });
  assert.ok(view.processes[0].stdout.length <= 120);
  assert.equal(JSON.stringify(view).includes('undefined'), false);
});
