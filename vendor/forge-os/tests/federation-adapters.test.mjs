import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverAgentSkills } from '../src/federation/adapters/agent-skills-repo.mjs';
import { discoverSkillsCli } from '../src/federation/adapters/skills-cli-repo.mjs';
import { discoverKnowledgeEntries } from '../src/federation/adapters/knowledge-index.mjs';

const snapshot = {
  source:{id:'repo',authority:'community',license:{spdx:'MIT',mode:'vendor-allowed'}},
  revision:'0123456789abcdef0123456789abcdef01234567',
  files:[
    {path:'LICENSE',content:'MIT License'},
    {path:'skills/ui-audit/SKILL.md',content:'---\nname: ui-audit\ndescription: Use when auditing a web interface\n---\n# UI Audit\nCheck layout and accessibility.'},
    {path:'skills/ui-audit/references/checklist.md',content:'# Checklist'},
    {path:'skills/ui-audit/scripts/check.mjs',content:'console.log("check")'},
  ],
};

test('Agent Skills adapter discovers frontmatter, references, scripts, license, and pinned revision', () => {
  const result = discoverAgentSkills(snapshot);
  assert.equal(result.providers.length, 1);
  const skill = result.providers[0];
  assert.equal(skill.name, 'ui-audit');
  assert.equal(skill.status, 'quarantined');
  assert.deepEqual(skill.references, ['skills/ui-audit/references/checklist.md']);
  assert.deepEqual(skill.executables, ['skills/ui-audit/scripts/check.mjs']);
  assert.equal(skill.revision, snapshot.revision);
  assert.equal(skill.license.spdx, 'MIT');
});

test('malformed repositories are quarantined with stable findings instead of partially imported', () => {
  const result = discoverAgentSkills({...snapshot,files:[{path:'skills/bad/SKILL.md',content:'# no frontmatter'}]});
  assert.equal(result.providers.length, 0);
  assert.ok(result.findings.some((f) => f.code === 'invalid-skill-frontmatter'));
});

test('skills CLI adapter accepts root and nested skill directories without duplicating them', () => {
  const result = discoverSkillsCli({...snapshot,files:[...snapshot.files,{path:'SKILL.md',content:'---\nname: root-skill\ndescription: Use when running root work\n---\n# Root'}]});
  assert.deepEqual(result.providers.map((item) => item.name).sort(), ['root-skill','ui-audit']);
});

test('knowledge adapter stores references and authority metadata without copying remote content', () => {
  const result = discoverKnowledgeEntries({source:{id:'w3c',authority:'standards-body'},entries:[{id:'wcag',title:'WCAG',url:'https://www.w3.org/WAI/standards-guidelines/wcag/',domains:['ui-design'],topics:['accessibility'],freshnessHours:720}]});
  assert.equal(result[0].kind, 'knowledge');
  assert.equal(result[0].content, undefined);
  assert.equal(result[0].authority, 'standards-body');
});
