import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { OperationsSecurityFabric } from '../src/native-core/operations-security-fabric.mjs';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';

const hex64 = /^[a-f0-9]{64}$/;
async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ops-'));
  const workspaceRoot = path.join(root, 'workspace');
  const dataDir = path.join(root, 'data');
  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(path.join(workspaceRoot, 'state.txt'), 'v1');
  let tick = 1000;
  const fabric = new OperationsSecurityFabric({ dataDir, workspaceRoot, allowedHosts: ['api.example.com'], clock: () => ++tick });
  await fabric.open();
  return { root, workspaceRoot, dataDir, fabric };
}

test('operations fabric redacts scoped secrets and records a tamper-evident persistent audit chain', async () => {
  const { dataDir, workspaceRoot, fabric } = await setup();
  const entry = await fabric.recordAudit({ actorId: 'user:1', scope: 'project:1', eventType: 'provider.request', payload: { token: 'sk-abcdefghijklmnopqrst', nested: 'Bearer abcdefghijklmnop' }, secretValues: ['abcdefghijklmnopqrst'] });
  assert.match(entry.receiptSha256, hex64);
  assert.equal(JSON.stringify(entry).includes('abcdefghijklmnopqrst'), false);
  assert.equal(fabric.verifyAudit().status, 'pass');

  const reopened = new OperationsSecurityFabric({ dataDir, workspaceRoot, allowedHosts: ['api.example.com'] });
  await reopened.open();
  assert.equal(reopened.verifyAudit().entries, 1);
  const tampered = structuredClone(reopened.auditEntries());
  tampered[0].event.digest = '0'.repeat(64);
  assert.equal(reopened.verifyAudit(tampered).status, 'tampered');
});

test('egress policy is HTTPS-only, strips credentials and binds exact allowed hosts', async () => {
  const { fabric } = await setup();
  const allowed = fabric.authorizeEgress({ url: 'https://api.example.com/v1/models?x=1' });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.origin, 'https://api.example.com');
  assert.throws(() => fabric.authorizeEgress({ url: 'http://api.example.com/v1' }), /https/i);
  assert.throws(() => fabric.authorizeEgress({ url: 'https://evil.example/v1' }), /allowlist/i);
  assert.throws(() => fabric.authorizeEgress({ url: 'https://user:pass@api.example.com/v1' }), /credential/i);
});

test('backup and restore use content hashes, atomic writes and survive restart', async () => {
  const { dataDir, workspaceRoot, fabric } = await setup();
  const backup = await fabric.createBackup({ paths: ['state.txt'] });
  assert.match(backup.manifestSha256, hex64);
  assert.equal(backup.files[0].bytes, 2);
  await writeFile(path.join(workspaceRoot, 'state.txt'), 'changed');

  const reopened = new OperationsSecurityFabric({ dataDir, workspaceRoot, allowedHosts: ['api.example.com'] });
  await reopened.open();
  const restored = await reopened.restoreBackup({ backupId: backup.backupId });
  assert.equal(restored.restored, 1);
  assert.equal(await readFile(path.join(workspaceRoot, 'state.txt'), 'utf8'), 'v1');
  assert.match(restored.receiptSha256, hex64);
});

test('backup rejects symlink escape and recovery removes abandoned atomic staging directories', async (t) => {
  const { dataDir, workspaceRoot, fabric } = await setup();
  const outside = path.join(path.dirname(workspaceRoot), 'outside.txt');
  await writeFile(outside, 'secret');
  try { await symlink(outside, path.join(workspaceRoot, 'escape.txt')); }
  catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('symlink privilege unavailable'); return; } throw error; }
  await assert.rejects(() => fabric.createBackup({ paths: ['escape.txt'] }), /symlink|escape/i);
  const abandoned = path.join(dataDir, 'backups', '.tmp-abandoned');
  await mkdir(abandoned, { recursive: true });
  await writeFile(path.join(abandoned, 'partial'), 'x');
  const recovered = await fabric.recoverIncomplete();
  assert.equal(recovered.removed, 1);
});

test('dependency provenance and device diagnosis are signed and reject unverifiable inputs', async () => {
  const { fabric } = await setup();
  const dependency = await fabric.recordDependency({ name: 'electron', version: '37.2.3', integrity: `sha256-${'a'.repeat(64)}`, source: 'npm-lock' });
  assert.match(dependency.receiptSha256, hex64);
  await assert.rejects(() => fabric.recordDependency({ name: 'bad', version: '1', integrity: 'latest', source: 'network' }), /integrity/i);
  const diagnosis = fabric.diagnoseDevice({ totalRamMb: 8192, availableRamMb: 4096, cpuCores: 4, diskFreeMb: 50_000, gpuAvailable: false });
  assert.equal(diagnosis.profile, 'Lite');
  assert.match(diagnosis.receiptSha256, hex64);
});

test('orchestration production-wires operations security status and backup APIs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-orchestration-ops-'));
  const workspaceRoot = path.join(root, 'workspace');
  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(path.join(workspaceRoot, 'a.txt'), 'a');
  const service = new NolaneNativeOrchestrationService({ dataDir: path.join(root, 'data'), workspaceRoot, egressHosts: ['api.example.com'] });
  await service.open();
  const backup = await service.createNativeBackup({ paths: ['a.txt'] });
  assert.match(backup.manifestSha256, hex64);
  const status = service.status();
  assert.equal(status.operations.ready, true);
  assert.equal(status.operations.backups, 1);
  assert.equal(service.authorizeNativeEgress({ url: 'https://api.example.com/v1' }).allowed, true);
});
