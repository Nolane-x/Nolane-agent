import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ForgeOsSkillCatalog } from '../src/nolane-native/forgeos-skill-catalog.mjs';
import { ForgeOsSkillInstaller } from '../src/nolane-native/forgeos-skill-installer.mjs';
import { NolaneSkillRegistry } from '../src/nolane-native/skill-registry.mjs';

async function forgeFixture(t) {
  const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-forgeos-install-source-'));
  const destinationRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-forgeos-install-destination-'));
  t.after(() => Promise.all([rm(sourceRoot, { recursive: true, force: true }), rm(destinationRoot, { recursive: true, force: true })]));
  const skillRoot = path.join(sourceRoot, 'skills-v2', 'stable', 'inspect');
  await mkdir(path.join(skillRoot, 'sections'), { recursive: true });
  await mkdir(path.join(skillRoot, 'scripts'), { recursive: true });
  await writeFile(path.join(skillRoot, 'SKILL.md'), '---\nname: inspect\ndescription: Inspect safely.\nlicense: MIT\n---\n# Inspect\n');
  await writeFile(path.join(skillRoot, 'manifest.json'), '{"id":"inspect"}\n');
  await writeFile(path.join(skillRoot, 'sections', 'procedure.md'), '# Procedure\n');
  await writeFile(path.join(skillRoot, 'scripts', 'run.mjs'), 'throw new Error("never copied");\n');
  await writeFile(path.join(sourceRoot, 'skills-v2', 'catalog.json'), JSON.stringify([{
    id: 'inspect', path: 'skills-v2/stable/inspect', maturity: 'stable', kernelLevel: 'L1', capabilityIds: [], targetTokens: 10,
  }]));
  await writeFile(path.join(sourceRoot, 'package.json'), JSON.stringify({ version: '0.6.1', license: 'MIT' }));
  await writeFile(path.join(sourceRoot, 'project-manifest.json'), JSON.stringify({ source: { commit: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: false } }));
  return { catalog: new ForgeOsSkillCatalog({ roots: [sourceRoot] }), destinationRoot };
}

test('install writes an origin-preserving local Skill with no capabilities', async (t) => {
  const { catalog, destinationRoot } = await forgeFixture(t);
  const result = await new ForgeOsSkillInstaller({ catalog, destinationRoot }).install('forgeos:v2:inspect');
  const skill = (await new NolaneSkillRegistry({ roots: [destinationRoot] }).discover()).find((entry) => entry.id === 'inspect');

  assert.equal(result.schema, 'nolane.agent.forgeos-skill-install.v1');
  assert.equal(result.provenanceStatus, 'forge-os-imported');
  assert.deepEqual(result.files, ['SKILL.md', 'manifest.json', 'sections/procedure.md']);
  assert.equal(skill.provenanceStatus, 'forge-os-imported');
  assert.deepEqual(skill.capabilities, []);
  assert.equal(skill.import.source, 'forge-os');
  assert.equal(skill.import.sourceId, 'inspect');
  await assert.rejects(() => import('node:fs/promises').then(({ access }) => access(path.join(destinationRoot, 'inspect', 'scripts', 'run.mjs'))));
});

test('install refuses to overwrite an existing local Skill', async (t) => {
  const { catalog, destinationRoot } = await forgeFixture(t);
  const installer = new ForgeOsSkillInstaller({ catalog, destinationRoot });
  await installer.install('forgeos:v2:inspect');
  await assert.rejects(() => installer.install('forgeos:v2:inspect'), /already installed/i);
});
