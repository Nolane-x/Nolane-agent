import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NolaneSkillRegistry } from '../src/nolane-native/skill-registry.mjs';

test('discovers a standard local SKILL.md package without granting capabilities', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-local-skills-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'browser-audit');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'SKILL.md'), '---\nname: browser-audit\ndescription: Review browser flows without exposing credentials.\n---\n# Browser audit\n');

  const registry = new NolaneSkillRegistry({ roots: [root] });
  const skills = await registry.discover();

  assert.deepEqual(skills.map((skill) => skill.id), ['browser-audit']);
  assert.equal(skills[0].source, 'nolane');
  assert.equal(skills[0].catalog, 'local');
  assert.equal(skills[0].description, 'Review browser flows without exposing credentials.');
  assert.deepEqual(skills[0].capabilities, []);
  assert.equal((await registry.load('browser-audit')).contentLoaded, true);
});

test('keeps local provenance metadata declarative and carries it into the load receipt', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-local-skills-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'repo-review');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'SKILL.md'), '---\nname: repo-review\ndescription: Review a repository before changing it.\n---\n# Repository review\n');
  await writeFile(path.join(directory, 'nolane-skill.json'), JSON.stringify({
    schema: 'nolane.agent.skill-provenance.v1',
    sourceUrl: 'https://example.test/skills/repo-review',
    license: 'MIT',
    capabilities: ['repo:read'],
  }));

  const registry = new NolaneSkillRegistry({ roots: [root] });
  const [skill] = await registry.discover();

  assert.equal(skill.provenanceStatus, 'local-user-supplied');
  assert.equal(skill.sourceUrl, 'https://example.test/skills/repo-review');
  assert.equal(skill.license, 'MIT');
  assert.deepEqual(skill.capabilities, ['repo:read']);
  await assert.rejects(() => registry.load('repo-review'), /missing capability/i);
  const loaded = await registry.load('repo-review', { grantedCapabilities: ['repo:read'] });
  assert.equal(loaded.provenanceStatus, 'local-user-supplied');
  assert.equal(loaded.sourceUrl, 'https://example.test/skills/repo-review');
  assert.equal(loaded.license, 'MIT');
});

test('rejects malformed standard provenance instead of guessing metadata', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-local-skills-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'unsafe-skill');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'SKILL.md'), '---\nname: unsafe-skill\ndescription: A bounded test fixture.\n---\n# Fixture\n');
  await writeFile(path.join(directory, 'nolane-skill.json'), JSON.stringify({ schema: 'other.schema' }));

  await assert.rejects(() => new NolaneSkillRegistry({ roots: [root] }).discover(), /provenance/i);
});

test('rejects ForgeOS import provenance when the installed Skill content does not match its receipt', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-local-skills-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'inspect');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'SKILL.md'), '---\nname: inspect\ndescription: Inspect safely.\n---\n# Tampered\n');
  await writeFile(path.join(directory, 'nolane-skill.json'), JSON.stringify({
    schema: 'nolane.agent.skill-provenance.v1', sourceUrl: 'https://github.com/Nolane-x/forge-os', license: 'MIT', capabilities: [],
    import: { source: 'forge-os', sourceId: 'inspect', catalog: 'v2', contentSha256: 'a'.repeat(64), manifestSha256: null, catalogSha256: 'b'.repeat(64), sourceCommit: null, receiptSha256: 'c'.repeat(64) },
  }));

  await assert.rejects(() => new NolaneSkillRegistry({ roots: [root] }).discover(), /import.*content|content.*import/i);
});

test('preserves legacy packages while applying the local catalog trust boundary', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-local-skills-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'legacy-review');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'guide.md'), '# Legacy review\n');
  await writeFile(path.join(directory, 'skill.json'), JSON.stringify({
    schema: 'nolane.agent.skill.v1', id: 'legacy-review', title: 'Legacy review', entrypoint: 'guide.md', capabilities: ['repo:read'],
  }));

  const registry = new NolaneSkillRegistry({ roots: [root] });
  const [skill] = await registry.discover();
  assert.deepEqual({ source: skill.source, catalog: skill.catalog, provenanceStatus: skill.provenanceStatus, capabilities: skill.capabilities }, {
    source: 'nolane', catalog: 'local', provenanceStatus: 'local-user-supplied', capabilities: ['repo:read'],
  });
  await assert.rejects(() => registry.load('legacy-review'), /missing capability/i);
  assert.match((await registry.load('legacy-review', { grantedCapabilities: ['repo:read'] })).content, /Legacy review/);
});

test('rejects malformed standard packages and stale skill content', async (t) => {
  const malformedRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-local-skills-'));
  const staleRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-local-skills-'));
  t.after(() => Promise.all([rm(malformedRoot, { recursive: true, force: true }), rm(staleRoot, { recursive: true, force: true })]));
  await mkdir(path.join(malformedRoot, 'bad'), { recursive: true });
  await writeFile(path.join(malformedRoot, 'bad', 'SKILL.md'), '---\nname: Bad Name\ndescription: Invalid name.\n---\n# Bad\n');
  await assert.rejects(() => new NolaneSkillRegistry({ roots: [malformedRoot] }).discover(), /frontmatter/i);

  const directory = path.join(staleRoot, 'stale-skill');
  await mkdir(directory, { recursive: true });
  const skillPath = path.join(directory, 'SKILL.md');
  await writeFile(skillPath, '---\nname: stale-skill\ndescription: Check integrity after discovery.\n---\n# Original\n');
  const registry = new NolaneSkillRegistry({ roots: [staleRoot] });
  await registry.discover();
  await writeFile(skillPath, '---\nname: stale-skill\ndescription: Check integrity after discovery.\n---\n# Changed\n');
  await assert.rejects(() => registry.load('stale-skill'), /changed after discovery/i);
});

test('documents the no-execution Agent Skills supply-chain boundary', async () => {
  const policy = await readFile('SECURITY.md', 'utf8');
  assert.match(policy, /Agent Skills supply chain/i);
  assert.match(policy, /untrusted declarative guidance/i);
  assert.match(policy, /does not execute bundled scripts/i);
  assert.match(policy, /explicit capabilities/i);
  assert.match(policy, /governed tool or runtime boundary/i);
});
