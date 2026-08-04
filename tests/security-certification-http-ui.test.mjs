import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createRoutes } from '../src/server/routes.mjs';
import { ForgeStudioClient } from '../src/client/forge-studio-client.mjs';

function response() { return { statusCode: null, body: '', writeHead(status) { this.statusCode = status; }, end(body = '') { this.body = String(body); } }; }
function request(method, body = null, principal = { subject: 'operator-1', roles: ['operator'] }) { const req = new EventEmitter(); req.method = method; req.headers = {}; req.forgePrincipal = principal; req[Symbol.asyncIterator] = async function* () { if (body !== null) yield Buffer.from(JSON.stringify(body)); }; return req; }
function parse(res) { return JSON.parse(res.body || '{}'); }

function fixture() {
  const calls = [];
  const decision = {
    securityCertificationSnapshot() { calls.push(['snapshot']); return { schema: 'forge.security-certification-plane-snapshot.v1', lifecycle: {}, auditEntries: 2, benchmarkEvidenceEntries: 3, claims: { comparativeSuperiorityProven: false } }; },
    assessDependencySecurity(input) { calls.push(['dependency', input]); return { schema: 'forge.dependency-risk.v1', status: 'pass' }; },
    authorizeProtectedSecurityBoundary(input) { calls.push(['boundary', input]); return { schema: 'forge.protected-boundary-decision.v1', allowed: input.actor.type === 'human' }; },
    certifyBenchmarkComparison(input) { calls.push(['certify', input]); return { schema: 'forge.comparative-certification.v1', claimAllowed: false }; },
  };
  return { calls, routes: createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {}, missionResourceFabric: { decision } }) };
}

test('security certification HTTP API exposes bounded snapshot and principal-bound decisions', async () => {
  const { calls, routes } = fixture();
  const snapshot = response();
  await routes(request('GET'), snapshot, new URL('/api/security-certification/snapshot', 'http://localhost'));
  assert.equal(snapshot.statusCode, 200);
  assert.equal(parse(snapshot).auditEntries, 2);

  const dependency = response();
  await routes(request('POST', { dependency: { name: 'pkg', currentVersion: '1', candidateVersion: '2' }, evidence: {}, compatibility: { status: 'verified' }, rawPrompt: 'do not forward' }), dependency, new URL('/api/security-certification/dependency/assess', 'http://localhost'));
  assert.equal(dependency.statusCode, 200);

  const boundary = response();
  await routes(request('POST', { paths: ['src/security/policy.mjs'], actor: { id: 'attacker', type: 'human' }, overrideReceipt: { status: 'approved', receiptSha256: 'a'.repeat(64) } }), boundary, new URL('/api/security-certification/boundary/authorize', 'http://localhost'));
  assert.equal(parse(boundary).allowed, true);

  const certify = response();
  await routes(request('POST', { suite: { id: 's', version: 1 }, runs: [], contracts: [], attestation: null, rawOutput: 'secret' }), certify, new URL('/api/security-certification/benchmark/certify', 'http://localhost'));
  assert.equal(certify.statusCode, 200);

  assert.deepEqual(calls, [
    ['snapshot'],
    ['dependency', { dependency: { name: 'pkg', currentVersion: '1', candidateVersion: '2' }, evidence: {}, compatibility: { status: 'verified' } }],
    ['boundary', { paths: ['src/security/policy.mjs'], actor: { id: 'operator-1', type: 'human' }, overrideReceipt: { status: 'approved', receiptSha256: 'a'.repeat(64) } }],
    ['certify', { suite: { id: 's', version: 1 }, runs: [], contracts: [], attestation: null }],
  ]);
});

test('ForgeStudioClient exposes security snapshot without execution controls', async () => {
  const calls = [];
  const client = new ForgeStudioClient({ baseUrl: 'http://127.0.0.1:8787', token: 'token', fetch: async (url, init) => { calls.push([new URL(url).pathname, init.method ?? 'GET']); return { ok: true, status: 200, headers: { get: () => 'application/json' }, async json() { return { ok: true }; } }; } });
  await client.getSecurityCertification();
  assert.deepEqual(calls, [['/api/security-certification/snapshot', 'GET']]);
});

test('Evidence UI renders security certification state without new primary navigation or heavy blur', async () => {
  const [js, css, html] = await Promise.all([
    readFile(new URL('../ui/collaboration-experience-center.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/collaboration-experience-center.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(js, /\/api\/security-certification\/snapshot/);
  assert.match(js, /Security & Certification/);
  assert.match(js, /comparativeSuperiorityProven/);
  assert.match(css, /security-certification/);
  assert.match(css, /content-visibility\s*:\s*auto/);
  assert.doesNotMatch(css, /backdrop-filter|filter:\s*blur/i);
  const primary = [...html.matchAll(/class="rail-button primary-shell-button[^"]*"[^>]+data-shell="([^"]+)"[^>]+title="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(primary, ['mission', 'work', 'evidence']);
});
