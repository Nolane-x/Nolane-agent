import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('dashboard demo project is generated through authenticated current APIs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forgeos-demo-test-'));
  try {
    const run = spawnSync(process.execPath, ['scripts/create-demo-project.mjs', root], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const projectId = run.stdout.trim();
    assert.match(projectId, /^forge_[A-Za-z0-9_-]+$/);
    const project = JSON.parse(await readFile(path.join(root, `${projectId}.json`), 'utf8'));
    assert.equal(project.stage, 'architecture');
    assert.equal(project.ideas.length, 5);
    assert.equal(project.scores.length, 5);
    assert.ok(project.selectedIdeaId);
    assert.ok(project.artifacts.some((item) => item.type === 'product-thesis'));
    assert.ok(project.evidence.every((item) => item.producer?.id && item.subject?.semanticRevision));
    assert.ok(project.routes.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
