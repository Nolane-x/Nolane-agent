import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildHomeViewModel, renderHomeView } from '../ui-v3/views/home/home-view.mjs';
import { renderProjectsView } from '../ui-v3/views/projects/project-view.mjs';

test('Home converts missing project/provider blockers into explicit recovery paths', () => {
  const html = renderHomeView(buildHomeViewModel());
  assert.match(html, /class="home-readiness"/);
  assert.match(html, /href="#\/projects"[^>]*>[\s\S]*?Add project/);
  assert.match(html, /href="#\/settings\?section=models"[^>]*>[\s\S]*?Set up provider/);
});

test('Home runtime failure offers a bounded retry action', () => {
  const html = renderHomeView(buildHomeViewModel({ error: 'Runtime unavailable' }));
  assert.match(html, /data-home-action="retry"/);
});

test('Projects distinguish no search matches from a truly empty registry', () => {
  const noMatches = renderProjectsView({ status: 'ready', language: 'en', query: 'atlas', projects: [], view: 'grid' });
  assert.match(noMatches, /No matching projects/);
  assert.match(noMatches, /data-project-action="clear-search"/);
  const empty = renderProjectsView({ status: 'ready', language: 'en', query: '', projects: [], view: 'grid' });
  assert.match(empty, /No projects yet/);
  assert.doesNotMatch(empty, /data-project-action="clear-search"/);
});

test('Projects runtime failure offers retry and trust labels localize', () => {
  const error = renderProjectsView({ status: 'ready', language: 'en', error: 'offline' });
  assert.match(error, /data-project-action="retry"/);
  const vi = renderProjectsView({ status: 'ready', language: 'vi', query: '', view: 'grid', projects: [{ id: 'p1', name: 'A', path: '/tmp/a', trust: 'trusted', activeMissions: 0, completedMissions: 0, openIntelligenceRoute: '/control-plane/intelligence/repository?project=p1' }] });
  assert.match(vi, />TIN CẬY</);
});

test('Projects search uses shared rerender preservation for focus and caret, and clear/retry are wired', async () => {
  const [app, projectView] = await Promise.all([
    readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../ui-v3/views/projects/project-view.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(projectView, /data-preserve-key="projects-search"/);
  assert.match(app, /rerenderView\(root,view,\{preserve:e\.target\}\)/);
  assert.match(app, /setSelectionRange/);
  assert.match(app, /action==='clear-search'/);
  assert.match(app, /action==='retry'/);
});
