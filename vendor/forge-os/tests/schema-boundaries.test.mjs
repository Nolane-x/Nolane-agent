import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { validateRuntimeSchema } from '../src/core/runtime-schemas.mjs';
import { loadSkillCatalog } from '../src/skills/catalog.mjs';
import { agentCard } from '../src/server/a2a.mjs';

test('runtime schemas accept real project, skill, and A2A card instances', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-schema-'));
  const project = await new ProjectStore(root).create({ name: 'Schema boundary' });
  assert.equal(validateRuntimeSchema('project', project), project);
  const skill = (await loadSkillCatalog())[0].contract;
  assert.equal(validateRuntimeSchema('skill', skill), skill);
  const card = agentCard('https://forge.example');
  assert.equal(validateRuntimeSchema('a2aAgentCard', card), card);
});

test('runtime schemas reject stale protocol shapes and permissive proof labels', async () => {
  assert.throws(() => validateRuntimeSchema('evidence', { id:'evidence_x', type:'security-review', title:'Review', status:'pass', summary:'' }), /Invalid evidence/);
  assert.throws(() => validateRuntimeSchema('a2aAgentCard', { name:'ForgeOS', description:'x', url:'https://old.example', version:'1', capabilities:{}, skills:[] }), /Invalid a2aAgentCard/);
  const schema = JSON.parse(await readFile('schemas/project.schema.json','utf8'));
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.properties.stage.enum.includes('release-readiness'));
});
