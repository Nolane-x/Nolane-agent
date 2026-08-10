import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { classifyArchiveEntry } from '../src/forensics/archive-classifier.mjs';
import { decomposeArchive } from '../src/forensics/archive-decomposer.mjs';

const execFileAsync = promisify(execFile);
const pythonCommand = process.env.NOLANE_AGENT_PYTHON || process.env.FORGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

async function createFixtureArchive() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-archive-'));
  const nested = path.join(root, 'nested.zip');
  await execFileAsync(pythonCommand, ['-c', [
    'import zipfile,sys',
    'with zipfile.ZipFile(sys.argv[1],"w") as z:',
    ' z.writestr("inner.txt",b"same")',
  ].join('\n'), nested]);
  const archive = path.join(root, 'fixture.zip');
  await execFileAsync(pythonCommand, ['-c', [
    'import zipfile,sys,pathlib',
    'nested=pathlib.Path(sys.argv[2]).read_bytes()',
    'with zipfile.ZipFile(sys.argv[1],"w",compression=zipfile.ZIP_DEFLATED) as z:',
    ' z.writestr("src/a.mjs",b"export const a=1;\\n")',
    ' z.writestr("tests/a.test.mjs",b"same")',
    ' z.writestr("docs/readme.md",b"docs")',
    ' z.writestr("assets/logo.png",b"\\x89PNG\\r\\n\\x1a\\n")',
    ' z.writestr("dist/app.exe",b"MZbinary")',
    ' z.writestr("data/report.json",b"{\\"generatedAt\\":\\"now\\"}")',
    ' z.writestr("duplicate.bin",b"same")',
    ' z.writestr("nested.zip",nested)',
  ].join('\n'), archive, nested]);
  return archive;
}

test('archive classifier uses explicit path and binary reasons', () => {
  assert.equal(classifyArchiveEntry({ path: 'src/a.mjs', bytes: 10 }).category, 'production-source');
  assert.equal(classifyArchiveEntry({ path: 'tests/a.test.mjs', bytes: 10 }).category, 'test');
  assert.equal(classifyArchiveEntry({ path: 'dist/app.exe', bytes: 10, magic: '4d5a' }).category, 'binary-build-output');
  assert.equal(classifyArchiveEntry({ path: 'nested.zip', bytes: 10 }).category, 'nested-archive');
  assert.equal(classifyArchiveEntry({ path: '.gitignore', bytes: 10 }).category, 'production-source');
  assert.equal(classifyArchiveEntry({ path: 'extension.vsixmanifest', bytes: 10 }).category, 'production-source');
  assert.equal(classifyArchiveEntry({ path: 'LICENSE', bytes: 10 }).category, 'documentation');
  assert.equal(classifyArchiveEntry({ path: 'recovered/ForgePty', bytes: 10, magic: '7f454c46' }).category, 'binary-build-output');
});

test('archive decomposition classifies every fixture entry and detects duplicate content', async () => {
  const archivePath = await createFixtureArchive();
  const report = await decomposeArchive({ archivePath });
  assert.equal(report.archiveType, 'zip');
  assert.equal(report.entries.length, 8);
  assert.equal(report.unknownEntries.length, 0);
  assert.equal(report.nestedArchives.length, 1);
  assert.equal(report.duplicateGroups.length, 1);
  assert.deepEqual([...report.duplicateGroups[0].paths].sort(), ['duplicate.bin', 'tests/a.test.mjs']);
  assert.ok(report.totals.uncompressedBytes > 0);
  assert.ok(report.totals.compressedBytes > 0);
  assert.equal(Object.values(report.categoryTotals).reduce((sum, item) => sum + item.entries, 0), 8);
});

test('archive decomposition rejects traversal entries', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-archive-'));
  const archive = path.join(root, 'unsafe.zip');
  await execFileAsync(pythonCommand, ['-c', 'import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],"w") as z:z.writestr("../escape.txt",b"x")', archive]);
  await assert.rejects(() => decomposeArchive({ archivePath: archive }), /unsafe archive path/i);
});
