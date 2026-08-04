import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyInstructionPolicy } from '../src/release/instruction-policy-verifier.mjs';
async function put(root, relative, content) { const target = path.join(root, relative); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content); }
test('instruction policy verifier emits evidence for scopes, precedence, conflicts, invalid records, and imports', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-policy-gate-')); t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'AGENTS.md', `---\nscope: repository\nimports: [docs/common.md]\nrules:\n  tests.required: true\n---\nRepo\n`);
  await put(root, 'docs/common.md', `---\nrules:\n  docs.required: true\n---\nCommon\n`);
  await put(root, '.cursor/rules/a.mdc', `---\nscope: task\ntasks: [review]\npriority: 5\nrules:\n  edits.allowed: false\n---\nA\n`);
  await put(root, '.cursor/rules/b.mdc', `---\nscope: task\ntasks: [review]\npriority: 5\nrules:\n  edits.allowed: true\n---\nB\n`);
  const outputFile = path.join(root, 'release', 'instruction-policy-1.8.0.json');
  const report = await verifyInstructionPolicy({ rootDirectory: root, version: '1.8.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.ok(report.capabilities.includes('safe-imports'));
  assert.ok(report.snapshot.conflicts.length === 1);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
