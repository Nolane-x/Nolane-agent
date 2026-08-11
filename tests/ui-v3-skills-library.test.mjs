import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createSkillsLibraryController, renderSkillsLibrary } from '../ui-v3/views/skills/skills-view.mjs';

test('catalogue filters locally and previews only the selected safe catalog entry', async () => {
  const calls = [];
  const api = {
    async get(path) {
      assert.equal(path, '/api/skills/catalog?limit=500');
      return [
        { id: 'v2:browser', title: 'Browser control', catalog: 'v2', maturity: 'candidate', source: 'ForgeOS v2' },
        { id: 'legacy:git', title: 'Git review', catalog: 'legacy', source: 'ForgeOS legacy' },
        { id: 'native:review', title: 'Native review' },
      ];
    },
    async post(path) {
      calls.push(path);
      return { id: 'unexpected:skill', title: 'Browser control', catalog: 'v2', content: 'Inspect pages safely.' };
    },
  };
  const controller = createSkillsLibraryController({ api, language: 'en' });
  await controller.load();
  controller.setQuery('browser');
  await controller.selectSkill('v2:browser');
  const html = renderSkillsLibrary(controller.snapshot());
  assert.match(html, /Browser control/);
  assert.doesNotMatch(html, /Git review/);
  assert.match(html, /Inspect pages safely\./);
  assert.match(html, /aria-pressed="true"/);
  assert.deepEqual(calls, ['/api/skills/catalog/v2%3Abrowser/load']);
  controller.setQuery('');
  controller.setCatalog('native');
  const nativeHtml = renderSkillsLibrary(controller.snapshot());
  assert.match(nativeHtml, /Native review/);
  assert.doesNotMatch(nativeHtml, /Browser control/);
  assert.match(nativeHtml, /aria-pressed="false"/);
});

test('library renders translated empty and failure states without unescaped catalog content', async () => {
  const empty = renderSkillsLibrary({ status: 'ready', language: 'vi', query: '', catalog: '', skills: [], preview: null, error: null });
  assert.match(empty, /Chưa có skill phù hợp/);
  const failure = renderSkillsLibrary({ status: 'error', language: 'en', query: '', catalog: '', skills: [], preview: null, error: '<unsafe>' });
  assert.match(failure, /&lt;unsafe&gt;/);
  assert.doesNotMatch(failure, /<unsafe>/);
});

test('skill library is visible at Workspace level and has a mounted application route', async () => {
  const [rail, app] = await Promise.all([
    readFile('ui-v3/shell/global-rail.mjs', 'utf8'),
    readFile('ui-v3/app.mjs', 'utf8'),
  ]);
  assert.match(rail, /id: 'skills', path: '\/skills'.*minExperience: 'workspace'/);
  assert.ok(app.includes("router.register({ id: 'skills', pattern: /^\\/skills"));
  assert.match(app, /views\/skills\/skills-view\.mjs/);
});

test('skill library CSS uses semantic tokens and collapses the catalogue split on narrow screens', async () => {
  const [styles, responsive] = await Promise.all([
    readFile('ui-v3/styles/pages/skills.css', 'utf8'),
    readFile('ui-v3/styles/responsive.css', 'utf8'),
  ]);
  assert.match(styles, /var\(--surface-panel\)/);
  assert.match(styles, /var\(--text-primary\)/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i);
  assert.match(responsive, /\.skills-library__body\{grid-template-columns:1fr/);
});
