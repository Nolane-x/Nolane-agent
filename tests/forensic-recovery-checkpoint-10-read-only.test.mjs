import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watched = [
  'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-10.json',
  'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-10.md',
  'models/checkpoint-10/pipeline-evidence.json',
  'requirements/forensic-source-custody.json',
];
async function snapshot() {
  return Object.fromEntries(await Promise.all(watched.map(async (relative) => {
    const body = await readFile(path.join(root, relative));
    return [relative, createHash('sha256').update(body).digest('hex')];
  })));
}
test('checkpoint 10 verifier is read-only without requiring Git metadata', async () => {
  const before = await snapshot();
  execFileSync(process.execPath, ['scripts/verify-forensic-recovery-checkpoint-10.mjs'], { cwd: root, stdio: 'pipe' });
  assert.deepEqual(await snapshot(), before);
});
