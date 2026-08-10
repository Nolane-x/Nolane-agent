import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { classifyHttpError, createHttpServer } from '../src/server/http-server.mjs';

test('HTTP error classification maps invalid input and workspace boundaries without leaking internal details', () => {
  const missing = classifyHttpError(new TypeError('file is required'));
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.body, { error: 'bad-request', code: 'INVALID_INPUT' });

  const outside = classifyHttpError(Object.assign(new Error('Path escapes workspace through symlink'), { code: 'PATH_SYMLINK_ESCAPE' }));
  assert.equal(outside.status, 403);
  assert.deepEqual(outside.body, { error: 'forbidden', code: 'PATH_SYMLINK_ESCAPE' });

  const internal = classifyHttpError(new Error('database password=super-secret-value'));
  assert.equal(internal.status, 500);
  assert.deepEqual(internal.body, { error: 'internal-error' });
  assert.doesNotMatch(JSON.stringify(internal), /super-secret|password|detail|stack/i);

  const providerTrust = classifyHttpError(new Error('OpenAI Codex CLI exited with 1: Not inside a trusted directory'));
  assert.equal(providerTrust.status, 409);
  assert.deepEqual(providerTrust.body, { error: 'provider-workspace-trust-required', code: 'PROVIDER_WORKSPACE_TRUST_REQUIRED' });

  const providerFailure = classifyHttpError(new Error('Anthropic Claude Code timed out'));
  assert.equal(providerFailure.status, 502);
  assert.deepEqual(providerFailure.body, { error: 'provider-error', code: 'PROVIDER_EXECUTION_FAILED' });

  const runtimeAdmission = classifyHttpError(Object.assign(new Error('provider admission blocked in brownout state'), { code: 'RUNTIME_LEASE_ADMISSION_BLOCKED' }));
  assert.equal(runtimeAdmission.status, 503);
  assert.deepEqual(runtimeAdmission.body, { error: 'Runtime is temporarily conserving resources. Try again shortly.', code: 'RUNTIME_ADMISSION_BLOCKED', retryable: true });
});

test('workroom API returns 403 for path escape and sanitized 500 for unexpected failures', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-http-boundary-'));
  await mkdir(path.join(root, 'ui'));
  await writeFile(path.join(root, 'ui', 'index.html'), '<!doctype html>');
  const fileService = {
    async read({ file }) {
      if (file === 'escape') throw Object.assign(new Error('Path escapes workspace through symlink: /private/target'), { code: 'PATH_SYMLINK_ESCAPE' });
      throw new Error('database password=super-secret-value');
    },
  };
  const http = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'test-token' },
    store: {}, providers: {}, missionRunner: {}, fileService,
    uiRoot: path.join(root, 'ui'),
  });
  t.after(async () => {
    await http.close();
    await rm(root, { recursive: true, force: true });
  });
  const request = async (file) => {
    const response = await fetch(`${http.url}/api/workroom/file?projectId=p&file=${file}`, { headers: { authorization: 'Bearer test-token' } });
    return { status: response.status, body: await response.json() };
  };
  const forbidden = await request('escape');
  assert.equal(forbidden.status, 403);
  assert.deepEqual(forbidden.body, { error: 'forbidden', code: 'PATH_SYMLINK_ESCAPE' });
  assert.doesNotMatch(JSON.stringify(forbidden.body), /private|target|detail/i);

  const internal = await request('crash');
  assert.equal(internal.status, 500);
  assert.deepEqual(internal.body, { error: 'internal-error' });
  assert.doesNotMatch(JSON.stringify(internal.body), /super-secret|password|detail|stack/i);
});
