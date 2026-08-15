import test from 'node:test';
import assert from 'node:assert/strict';

import { createSkillsLibraryController, renderSkillsLibrary } from '../ui-v3/views/skills/skills-view.mjs';

const makeSkills = (count = 180) => Array.from({ length: count }, (_, index) => ({
  id: `skill-${String(index).padStart(3, '0')}`,
  title: index === count - 1 ? 'Deep catalog target' : `Skill ${index}`,
  catalog: 'native',
  description: `Capability ${index}`,
}));

test('Skills progressively renders a large catalog without hiding deep search results', async () => {
  const api = {
    async get() { return makeSkills(); },
    async post() { return {}; },
  };
  const controller = createSkillsLibraryController({ api, language: 'en' });
  await controller.load();

  const initial = controller.snapshot();
  assert.equal(initial.visibleLimit, 72);
  let html = renderSkillsLibrary(initial);
  assert.equal((html.match(/data-skill-library-select=/g) ?? []).length, 72);
  assert.match(html, /data-skills-show-more/);
  assert.match(html, /108/);
  assert.doesNotMatch(html, /Deep catalog target/);

  controller.showMore();
  html = renderSkillsLibrary(controller.snapshot());
  assert.equal((html.match(/data-skill-library-select=/g) ?? []).length, 144);
  assert.match(html, /36/);

  controller.setQuery('Deep catalog target');
  const filtered = controller.snapshot();
  assert.equal(filtered.visibleLimit, 72);
  html = renderSkillsLibrary(filtered);
  assert.equal((html.match(/data-skill-library-select=/g) ?? []).length, 1);
  assert.match(html, /Deep catalog target/);
  assert.doesNotMatch(html, /data-skills-show-more/);
});

test('Skills route wiring handles progressive catalog expansion without navigation', async () => {
  const app = await import('node:fs/promises').then(({ readFile }) => readFile('ui-v3/app.mjs', 'utf8'));
  assert.match(app, /data-skills-show-more/);
  assert.match(app, /controller\.showMore\(\)/);
});
