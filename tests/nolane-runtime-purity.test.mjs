import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyNolaneRuntimePurity } from '../scripts/lib/nolane-runtime-purity-verifier.mjs';

const forbidden = String.fromCharCode(104, 101, 114, 109, 101, 115);
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();
const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};
const u16 = (value) => { const output = Buffer.alloc(2); output.writeUInt16LE(value); return output; };
const u32 = (value) => { const output = Buffer.alloc(4); output.writeUInt32LE(value); return output; };

async function writeStoredZip(target, entries) {
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  for (const { path: entryPath, content } of entries) {
    const name = Buffer.from(entryPath);
    const data = Buffer.from(content);
    const checksum = crc32(data);
    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    localRecords.push(local);
    centralRecords.push(Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += local.length;
  }
  const central = Buffer.concat(centralRecords);
  const end = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)]);
  await writeFile(target, Buffer.concat([...localRecords, central, end]));
}

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
  await writeStoredZip(path.join(root, 'artifact.zip'), [{ path: 'readme.txt', content: `external ${forbidden} residue` }]);
  const report = await verifyNolaneRuntimePurity({ rootDirectory: root });
  assert.equal(report.status, 'fail');
  assert.ok(report.archiveFindings.some((item) => item.includes('#content')));
});


test('purity verifier accepts a release archive as the direct target', async () => {
  const root = await tempRoot();
  const archive = path.join(root, 'artifact.vsix');
  await writeStoredZip(archive, [{ path: 'readme.txt', content: 'Nolane Agent release' }]);
  const cleanReport = await verifyNolaneRuntimePurity({ rootDirectory: archive });
  assert.equal(cleanReport.status, 'pass');
  assert.equal(cleanReport.scannedFiles, 1);

  await writeStoredZip(archive, [{ path: 'readme.txt', content: 'Nolane Agent release' }, { path: 'residue.txt', content: `external ${forbidden} residue` }]);
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
  await writeStoredZip(archive, [{ path: '.cache/module.pyc', content: `cached ${forbidden} mutation fixture` }]);
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
  await writeStoredZip(archive, [{ path: 'status.md', content: misleadingOwnership }]);
  const archiveReport = await verifyNolaneRuntimePurity({ rootDirectory: archive });
  assert.equal(archiveReport.status, 'fail');
  assert.ok(archiveReport.archiveOwnershipFindings.some((item) => item.includes('owned-runtime-described-as-absent')));
});
