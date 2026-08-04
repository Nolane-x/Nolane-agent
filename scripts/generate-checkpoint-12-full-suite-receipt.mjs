import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkpoint12SourceFingerprint } from './checkpoint-12-source-fingerprint.mjs';

const root = path.resolve('.');
const logPath = path.resolve(process.argv[2] ?? 'release/checkpoint-12/FULL-NODE-SUITE.log');
const outputPath = path.resolve(process.argv[3] ?? 'release/checkpoint-12/FULL-NODE-SUITE-RECEIPT.json');
const log = await readFile(logPath, 'utf8');
const match = log.match(/Node test suite complete:\s+(\d+) tests across (\d+)\/(\d+) files passed\./);
if (!match) throw new Error('full Node suite success line was not found');
const [, tests, passedFiles, totalFiles] = match;
if (passedFiles !== totalFiles) throw new Error('full Node suite did not cover every test file');
const source = await checkpoint12SourceFingerprint(root);
let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch {}
const base = {
  schema: 'nolane.checkpoint-12.full-node-suite-receipt.v1',
  status: 'pass', tests: Number(tests), passedFiles: Number(passedFiles), totalFiles: Number(totalFiles),
  node: process.version, platform: process.platform, arch: process.arch, commit,
  sourceFingerprintSha256: source.sha256, sourceFiles: source.files,
  log: path.relative(root, logPath).replaceAll(path.sep, '/'),
  logSha256: createHash('sha256').update(log).digest('hex'),
  generatedAt: new Date().toISOString(),
};
const receiptSha256 = createHash('sha256').update(JSON.stringify(base)).digest('hex');
await writeFile(outputPath, `${JSON.stringify({ ...base, receiptSha256 }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: path.relative(root, outputPath), tests: Number(tests), files: Number(totalFiles), receiptSha256 })}\n`);
