import test from 'node:test';
import assert from 'node:assert/strict';

import { renderUpdateNotice } from '../ui-v3/components/update-notice/update-notice.mjs';

test('Everyday staged update presents preservation promise and update-and-restart action', () => {
  const html = renderUpdateNotice({ state: 'staged', version: '5.0.0-beta.7', ready: true }, { experience: 'everyday', language: 'en' });
  assert.match(html, /role="status"/);
  assert.match(html, /Update and restart/);
  assert.match(html, /conversations, settings, projects, and missions will be kept/i);
  assert.doesNotMatch(html, /Release evidence/);
});

test('Workspace and Expert progressively disclose release metadata without changing the action contract', () => {
  const state = {
    state: 'staged', version: '5.0.0-beta.7', releaseTag: 'v5.0.0-beta.7',
    releaseCommit: 'a'.repeat(40), packageName: 'NolaneAgent-Setup-5.0.0-beta.7-x64.exe',
    packageBytes: 10485760, signatureVerified: true
  };
  const workspace = renderUpdateNotice(state, { experience: 'workspace', language: 'en' });
  const expert = renderUpdateNotice(state, { experience: 'expert', language: 'en' });
  assert.match(workspace, /10 MB/);
  assert.match(workspace, /Signature verified/);
  assert.doesNotMatch(workspace, /Release evidence/);
  assert.match(expert, /Release evidence/);
  assert.match(expert, /NolaneAgent-Setup-5\.0\.0-beta\.7-x64\.exe/);
  assert.match(expert, new RegExp('a'.repeat(40)));
  const availableExpert = renderUpdateNotice({ ...state, state: 'available' }, { experience: 'expert', language: 'en' });
  assert.match(availableExpert, /Ignore this version/);
});

test('available update offers safe download, later, and release-notes actions in Vietnamese', () => {
  const html = renderUpdateNotice({
    state: 'available', version: '5.0.0-beta.7', releaseNotesUrl: 'https://example.test/release'
  }, { experience: 'everyday', language: 'vi' });
  assert.match(html, /Tải bản cập nhật/);
  assert.match(html, /Để sau/);
  assert.match(html, /Có gì mới/);
  assert.match(html, /sẽ được giữ nguyên/);
  const unsafe = renderUpdateNotice({ state: 'available', releaseNotesUrl: 'javascript:alert(1)' }, { experience: 'everyday', language: 'vi' });
  assert.doesNotMatch(unsafe, /href=/);
});

test('idle, checking, up-to-date, deferred, and ignored states do not create persistent UI noise', () => {
  for (const state of ['idle', 'checking', 'upToDate', 'deferred', 'ignored']) {
    assert.equal(renderUpdateNotice({ state }, { experience: 'everyday', language: 'en' }), '');
  }
});
