import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Evidence shell exposes collaboration review, playback and steering with progressive disclosure', async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL('../ui/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../ui/collaboration-experience-center.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/collaboration-experience-center.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /collaboration-experience-center\.css/);
  assert.match(html, /id="collaboration-experience-center"/);
  assert.match(js, /\/api\/collaboration-experience\/snapshot/);
  assert.match(js, /review\/decisions/);
  assert.match(js, /playback\/rewind/);
  assert.match(js, /collaboration-experience\/steering/);
  assert.match(js, /aria-label/);
  assert.match(js, /setView\('collaborationExperience'\)/);
  assert.match(css, /content-visibility\s*:\s*auto/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /backdrop-filter|filter:\s*blur/i);
});

test('primary navigation remains Mission, Work and Evidence while collaboration is embedded in Evidence', async () => {
  const [html, app] = await Promise.all([readFile(new URL('../ui/index.html', import.meta.url), 'utf8'), readFile(new URL('../ui/app.js', import.meta.url), 'utf8')]);
  const primary = [...html.matchAll(/class="rail-button primary-shell-button[^"]*"[^>]+data-shell="([^"]+)"[^>]+title="([^"]+)"/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(primary, [['mission', 'Mission'], ['work', 'Work'], ['evidence', 'Evidence']]);
  assert.match(app, /collaborationExperience/);
  assert.match(app, /initCollaborationExperienceCenter/);
});
