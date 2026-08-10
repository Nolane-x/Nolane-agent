import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { verifyNolaneRuntimePurity } from '../scripts/lib/nolane-runtime-purity-verifier.mjs';

const forbidden = String.fromCharCode(104, 101, 114, 109, 101, 115);

async function tempRoot() { return mkdtemp(path.join(os.tmpdir(), 'nolane-runtime-purity-')); }

test('current repository contains only Nolane-owned runtime branding', async () => {
  const report = await verifyNolaneRuntimePurity({ rootDirectory: process.cwd() });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.pathFindings, []);
  assert.deepEqual(report.contentFindings, []);
  assert.deepEqual(report.archiveFindings, []);
});

test('purity verifier detects forbidden branding in paths and content', async () => {
  const root = await tempRoot();
  await mkdir(path.join(root, `old-${forbidden}-runtime`), { recursive: true });
  await writeFile(path.join(root, `old-${forbidden}-runtime`, 'marker.txt'), `retired ${forbidden} marker`, 'utf8');
  const report = await verifyNolaneRuntimePurity({ rootDirectory: root });
  assert.equal(report.status, 'fail');
  assert.ok(report.pathFindings.length > 0);
  assert.ok(report.contentFindings.length > 0);
});

test('purity verifier excludes research-only planning documents from runtime claims', async () => {
  const root = await tempRoot();
  const research = path.join(root, 'docs', 'superpowers');
  await mkdir(research, { recursive: true });
  await writeFile(path.join(research, 'plan.md'), `research note ${forbidden}`, 'utf8');
  const report = await verifyNolaneRuntimePurity({ rootDirectory: root });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.contentFindings, []);
});

test('purity verifier detects forbidden branding inside release archives', async () => {
  const root = await tempRoot();
  const staging = path.join(root, 'staging');
  await mkdir(staging, { recursive: true });
  await writeFile(path.join(staging, 'readme.txt'), `external ${forbidden} residue`, 'utf8');
  execFileSync('zip', ['-q', '-r', path.join(root, 'artifact.zip'), '.'], { cwd: staging });
  const report = await verifyNolaneRuntimePurity({ rootDirectory: root });
  assert.equal(report.status, 'fail');
  assert.ok(report.archiveFindings.some((item) => item.includes('#content')));
});


test('purity verifier accepts a release archive as the direct target', async () => {
  const root = await tempRoot();
  const clean = path.join(root, 'clean');
  await mkdir(clean, { recursive: true });
  await writeFile(path.join(clean, 'readme.txt'), 'Nolane Agent release', 'utf8');
  const archive = path.join(root, 'artifact.vsix');
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: clean });
  const cleanReport = await verifyNolaneRuntimePurity({ rootDirectory: archive });
  assert.equal(cleanReport.status, 'pass');
  assert.equal(cleanReport.scannedFiles, 1);

  await writeFile(path.join(clean, 'residue.txt'), `external ${forbidden} residue`, 'utf8');
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: clean });
  const dirtyReport = await verifyNolaneRuntimePurity({ rootDirectory: archive });
  assert.equal(dirtyReport.status, 'fail');
  assert.ok(dirtyReport.archiveFindings.some((item) => item.includes('#content')));
});


test('purity verifier ignores disposable source caches but still rejects them inside archives', async () => {
  const root = await tempRoot();
  const cache = path.join(root, '.cache');
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, 'module.pyc'), `cached ${forbidden} mutation fixture`, 'utf8');
  const sourceReport = await verifyNolaneRuntimePurity({ rootDirectory: root });
  assert.equal(sourceReport.status, 'pass');

  const archive = path.join(root, 'artifact.zip');
  execFileSync('zip', ['-q', '-r', archive, '.cache'], { cwd: root });
  const archiveReport = await verifyNolaneRuntimePurity({ rootDirectory: archive });
  assert.equal(archiveReport.status, 'fail');
  assert.ok(archiveReport.archiveFindings.some((item) => item.includes('#content')));
});


test('purity verifier rejects terminology that misrepresents Nolane Native ownership', async () => {
  const root = await tempRoot();
  const misleadingOwnership = ['NolaneNative', 'runtime and archive remain absent.'].join(' ');
  await writeFile(path.join(root, 'status.md'), misleadingOwnership, 'utf8');
  const report = await verifyNolaneRuntimePurity({ rootDirectory: root });
  assert.equal(report.status, 'fail');
  assert.ok(report.ownershipFindings.some((item) => item.includes('owned-runtime-described-as-absent')));

  const archive = path.join(root, 'artifact.zip');
  execFileSync('zip', ['-q', '-r', archive, 'status.md'], { cwd: root });
  const archiveReport = await verifyNolaneRuntimePurity({ rootDirectory: archive });
  assert.equal(archiveReport.status, 'fail');
  assert.ok(archiveReport.archiveOwnershipFindings.some((item) => item.includes('owned-runtime-described-as-absent')));
});
