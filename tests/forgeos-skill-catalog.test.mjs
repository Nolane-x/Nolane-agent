import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ForgeOsSkillCatalog } from '../src/nolane-native/forgeos-skill-catalog.mjs';

test('ForgeOS skill catalog exposes versioned read-only skills with load receipts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-forgeos-skills-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'skills-v2', 'kernel', 'inspect'), { recursive: true });
  await mkdir(path.join(root, 'skills', 'core', 'kernel', 'legacy-inspect'), { recursive: true });
  await writeFile(path.join(root, 'skills-v2', 'kernel', 'inspect', 'SKILL.md'), '# Inspect v2\n');
  await writeFile(path.join(root, 'skills', 'core', 'kernel', 'legacy-inspect', 'SKILL.md'), '# Legacy inspect\n');
  await writeFile(path.join(root, 'skills-v2', 'catalog.json'), JSON.stringify([{
    id: 'inspect', path: 'skills-v2/kernel/inspect', maturity: 'stable', kernelLevel: 'L0', capabilityIds: ['repo:read'], targetTokens: 10,
  }]));
  await writeFile(path.join(root, 'skills', 'catalog.json'), JSON.stringify([{
    name: 'legacy-inspect', kind: 'core', pack: 'kernel', status: 'candidate', description: 'Legacy catalog skill',
  }]));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.6.1', license: 'MIT' }));
  await writeFile(path.join(root, 'project-manifest.json'), JSON.stringify({
    version: '0.6.1',
    source: { commit: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: true },
    verification: { sourceCommit: 'c'.repeat(40), sourceTree: 'd'.repeat(40) },
  }));

  const catalog = new ForgeOsSkillCatalog({ roots: [root] });
  const discovered = await catalog.discover();
  assert.deepEqual(discovered.map((skill) => skill.id), ['forgeos:v2:inspect', 'forgeos:legacy:legacy-inspect']);
  assert.equal(discovered[0].source, 'forge-os');
  assert.equal(discovered[0].sourceUrl, 'https://github.com/Nolane-x/forge-os');
  assert.equal(discovered[0].sourceCommit, 'a'.repeat(40));
  assert.equal(discovered[0].sourceTree, 'b'.repeat(40));
  assert.equal(discovered[0].releaseVersion, '0.6.1');
  assert.equal(discovered[0].license, 'MIT');
  assert.equal(discovered[0].sourceDirty, true);
  assert.equal(discovered[0].provenanceStatus, 'vendor-snapshot-dirty');
  assert.deepEqual(discovered[0].capabilityIds, ['repo:read']);
  assert.equal(discovered[1].relativePath, 'skills/core/kernel/legacy-inspect');

  const loaded = await catalog.load('forgeos:v2:inspect');
  assert.equal(loaded.content, '# Inspect v2\n');
  assert.equal(loaded.contentLoaded, true);
  assert.match(loaded.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(loaded.catalog, 'v2');
  assert.equal(loaded.provenanceStatus, 'vendor-snapshot-dirty');
  assert.equal(loaded.sourceCommit, 'a'.repeat(40));
});

test('ForgeOS catalog rejects entries that escape its repository root', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-forgeos-skills-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'skills-v2'), { recursive: true });
  await writeFile(path.join(root, 'skills-v2', 'catalog.json'), JSON.stringify([{ id: 'escape', path: '../outside' }]));
  const catalog = new ForgeOsSkillCatalog({ roots: [root] });
  assert.deepEqual(await catalog.discover(), []);
});
