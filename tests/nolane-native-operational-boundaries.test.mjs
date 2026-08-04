import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneOperationalBoundaryService } from '../src/nolane-native/operational-boundary-service.mjs';
import { DependencyPreflightService } from '../src/release/dependency-preflight-service.mjs';

test('NolaneOperationalBoundaryService publishes canonical configuration and migration rules', () => {
  const service = new NolaneOperationalBoundaryService();
  const contract = service.configurationContract();
  assert.equal(contract.canonicalEnvironmentPrefix, 'NOLANE_AGENT_');
  assert.equal(contract.legacyEnvironmentPrefix, 'FORGE_STUDIO_');
  assert.equal(contract.defaults.runtime, 'nolane-native');
  assert.equal(contract.defaults.legacySidecarExecutionEnabled, false);
  assert.equal(JSON.stringify(contract).toLowerCase().includes('nolane_native'), false);
  assert.equal(contract.migration.dataDirectory, '.forge-studio -> .nolane-agent');
});

test('NolaneOperationalBoundaryService stores credential references without secret values', () => {
  const service = new NolaneOperationalBoundaryService();
  assert.throws(() => service.registerCredential({ provider: 'openai', account: 'main', secretRef: { env: 'OPENAI_API_KEY' }, value: 'sk-secret' }), /secret values/i);
  const record = service.registerCredential({ provider: 'openai', account: 'main', secretRef: { env: 'OPENAI_API_KEY' } });
  assert.equal(record.provider, 'openai');
  assert.equal(JSON.stringify(service.snapshot()).includes('sk-secret'), false);
  assert.equal(JSON.stringify(record).includes('value'), false);
});

test('NolaneOperationalBoundaryService resolves paths inside the workspace and rejects traversal and symlink escape', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-boundary-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'nolane-outside-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.txt'), 'a');
  await writeFile(path.join(outside, 'secret.txt'), 'secret');
  await symlink(outside, path.join(root, 'escape'));
  const service = new NolaneOperationalBoundaryService();
  assert.equal(await service.resolveWorkspacePath({ workspaceRoot: root, relativePath: 'src/a.txt' }), path.join(root, 'src', 'a.txt'));
  await assert.rejects(() => service.resolveWorkspacePath({ workspaceRoot: root, relativePath: '../outside' }), /outside workspace/i);
  await assert.rejects(() => service.resolveWorkspacePath({ workspaceRoot: root, relativePath: 'escape/secret.txt' }), /outside workspace/i);
});

test('NolaneOperationalBoundaryService requires approval for irreversible actions', () => {
  const service = new NolaneOperationalBoundaryService();
  assert.equal(service.authorizeAction({ kind: 'read', reversible: true }).allowed, true);
  assert.throws(() => service.authorizeAction({ kind: 'delete', reversible: false }), /approval/i);
  const approved = service.authorizeAction({ kind: 'delete', reversible: false, approvalReceiptSha256: 'a'.repeat(64) });
  assert.equal(approved.allowed, true);
  assert.equal(approved.approvalRequired, true);
});

test('DependencyPreflightService reports missing dependencies with deterministic remediation and locks', async () => {
  const service = new DependencyPreflightService({
    projectRoot: process.cwd(),
    probeExecutable: async (name) => name === 'node' ? { available: true, version: '22.16.0' } : { available: false, reason: 'not-found' },
  });
  const report = await service.run({ dependencies: [
    { id: 'node', kind: 'executable', name: 'node', required: true, remediation: 'Install Node.js 22 or newer' },
    { id: 'docker', kind: 'executable', name: 'docker', required: false, remediation: 'Install Docker only for container tests' },
    { id: 'lock', kind: 'file', path: 'package-lock.json', required: true, remediation: 'Restore package-lock.json' },
  ] });
  assert.equal(report.ready, true);
  assert.equal(report.degraded, true);
  assert.deepEqual(report.missingOptional, ['docker']);
  assert.equal(report.checks.find((x) => x.id === 'docker').remediation, 'Install Docker only for container tests');
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('Nolane operational boundary source does not import NolaneNative runtime code', async () => {
  const source = await readFile(new URL('../src/nolane-native/operational-boundary-service.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"].*nolane_native|nolane_native-runtime-service|nolane_native-vendor-service/i);
});

test('application wires Nolane operational and dependency preflight services', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /new NolaneOperationalBoundaryService\(/);
  assert.match(source, /new DependencyPreflightService\(/);
  assert.match(source, /operationalBoundary, dependencyPreflight/);
});
