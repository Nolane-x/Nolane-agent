import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyRepositoryDiscovery } from '../src/release/repository-discovery-verifier.mjs';

async function put(root, relative, content) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

test('repository discovery release verifier writes an evidence-bound report', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-discovery-gate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'package.json', JSON.stringify({
    name: 'fixture', version: '1.7.0', main: 'src/index.mjs',
    scripts: { test: 'node --test', build: 'node scripts/build.mjs' },
  }));
  await put(root, 'src/index.mjs', 'export const ready = true;\n');
  await put(root, 'README.md', '# Fixture\nModular architecture.\n');
  const outputFile = path.join(root, 'release', 'repository-discovery-1.7.0.json');
  const report = await verifyRepositoryDiscovery({ rootDirectory: root, version: '1.7.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.equal(report.version, '1.7.0');
  assert.ok(report.snapshot.languages.length > 0);
  assert.ok(report.snapshot.packageManagers.some((item) => item.id === 'npm'));
  assert.equal(report.snapshot.commands.test.status, 'detected');
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  const persisted = JSON.parse(await readFile(outputFile, 'utf8'));
  assert.equal(persisted.receiptSha256, report.receiptSha256);
  assert.doesNotMatch(JSON.stringify(persisted), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('repository discovery release verifier fails when no language or test command can be evidenced', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-discovery-gate-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'README.md', '# Empty\n');
  await assert.rejects(
    () => verifyRepositoryDiscovery({ rootDirectory: root, version: '1.7.0', outputFile: path.join(root, 'report.json') }),
    /Repository discovery verification failed/,
  );
});
