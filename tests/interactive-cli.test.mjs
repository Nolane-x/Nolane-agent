import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';

import { runInteractiveCli } from '../cli/interactive.mjs';

test('interactive CLI supports health, project, run, control, review, logs, help, and exit without exposing secrets', async () => {
  const calls = [];
  const client = {
    async health() { calls.push(['health']); return { status: 'ok' }; },
    async listProjects() { calls.push(['projects']); return [{ id: 'p1' }]; },
    async listRuns(projectId) { calls.push(['runs', projectId]); return [{ id: 'r1' }]; },
    async createRun(input) { calls.push(['create', input]); return { id: 'r2' }; },
    async getRun(id) { calls.push(['get', id]); return { id, state: 'running' }; },
    async controlRun(id, action) { calls.push(['control', id, action]); return { id, state: action }; },
    async reviewRun(id) { calls.push(['review', id]); return { id, verdict: 'candidate' }; },
    async listActivities(id) { calls.push(['logs', id]); return [{ type: 'agent.started' }]; },
    async sendMessage(id, content) { calls.push(['message', id, content]); return { id, accepted: true }; },
  };
  const input = new PassThrough();
  const output = new PassThrough();
  let text = '';
  output.on('data', (chunk) => { text += chunk; });
  input.end([
    'health',
    'projects',
    'runs p1',
    'run p1 Fix the failing tests',
    'get r2',
    'pause r2',
    'review r2',
    'logs r2',
    'message r2 Continue carefully',
    'help',
    'exit',
  ].join('\n'));
  const result = await runInteractiveCli({ client, input, output, prompt: '' });
  assert.equal(result.reason, 'exit');
  assert.deepEqual(calls[0], ['health']);
  assert.ok(calls.some((call) => call[0] === 'create' && call[1].objective === 'Fix the failing tests'));
  assert.ok(calls.some((call) => call[0] === 'control' && call[2] === 'pause'));
  assert.ok(calls.some((call) => call[0] === 'message' && call[2] === 'Continue carefully'));
  assert.match(text, /"status": "ok"/);
  assert.match(text, /Commands:/);
  assert.doesNotMatch(text, /authorization|Bearer|token/i);
});

test('interactive CLI reports command errors and continues until EOF', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let text = '';
  output.on('data', (chunk) => { text += chunk; });
  input.end('unknown\nget\n');
  const result = await runInteractiveCli({ client: {}, input, output, prompt: '' });
  assert.equal(result.reason, 'eof');
  assert.match(text, /Unknown command/i);
  assert.match(text, /get requires/i);
});
