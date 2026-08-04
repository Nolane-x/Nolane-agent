import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { RouteSecurityTelemetry } from '../src/security/route-security-telemetry.mjs';

test('route security telemetry records auth, authorization, and handler stages without request secrets', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-route-telemetry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'ui'));
  await writeFile(path.join(root, 'ui', 'index.html'), '<!doctype html>');
  const events = [];
  const telemetry = new RouteSecurityTelemetry({ eventSink: (event) => events.push(event), clock: () => '2026-08-01T00:00:00.000Z' });
  const fileService = { async read() { return { path: 'README.md', content: 'safe' }; } };
  const http = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'right-token' },
    store: {}, providers: {}, missionRunner: {}, fileService,
    requestAuthorizer: async () => ({ decision: 'allow' }),
    routeSecurityTelemetry: telemetry,
    uiRoot: path.join(root, 'ui'),
  });
  t.after(() => http.close());

  const denied = await fetch(`${http.url}/api/workroom/file?projectId=p&file=README.md&token=query-secret`, { headers: { authorization: 'Bearer wrong-secret' } });
  assert.equal(denied.status, 401);
  const allowed = await fetch(`${http.url}/api/workroom/file?projectId=p&file=README.md&token=query-secret`, { headers: { authorization: 'Bearer right-token', 'x-private-note': 'body-secret' } });
  assert.equal(allowed.status, 200);

  const deniedEvents = events.filter((event) => event.outcome === 'deny');
  assert.deepEqual(deniedEvents.map((event) => event.stage), ['authentication']);
  const allowedRequestId = events.find((event) => event.stage === 'route-handler' && event.outcome === 'pass')?.requestId;
  assert.ok(allowedRequestId);
  assert.deepEqual(events.filter((event) => event.requestId === allowedRequestId).map((event) => `${event.stage}:${event.outcome}`), [
    'authentication:allow',
    'organization-authorization:allow',
    'route-handler:pass',
  ]);
  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /right-token|wrong-secret|query-secret|body-secret|bearer|x-private-note/i);
  assert.ok(events.every((event) => /^[a-f0-9]{64}$/.test(event.receiptSha256)));
});


test('application wires route security telemetry into the production HTTP server', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /new RouteSecurityTelemetry\(/);
  assert.match(source, /createHttpServer\(\{[\s\S]*routeSecurityTelemetry/);
});
