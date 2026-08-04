import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DesignContextService } from '../src/design/design-context-service.mjs';

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-design-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new DesignContextService({ file: path.join(root, 'design.sqlite'), artifactRoot: path.join(root, 'artifacts'), ...options });
  t.after(() => service.close());
  return { root, service };
}

test('DesignContextService captures a sanitized element with source and screenshot evidence', async (t) => {
  const f = await fixture(t);
  const record = await f.service.capture({
    projectId: 'p', sessionId: 's', url: 'http://127.0.0.1:3000/settings', revision: 4,
    screenshot: Buffer.from('fake-png'),
    elements: [{
      selector: '#save', tagName: 'button', text: 'Save', html: '<button id="save" data-token="secret">Save</button>',
      attributes: { id: 'save', class: 'primary', 'data-token': 'secret', value: 'password-value' },
      rect: { x: 10, y: 20, width: 100, height: 32 },
      computedStyle: { display: 'flex', color: 'rgb(0,0,0)', backgroundImage: 'url(https://evil.invalid/a)', position: 'relative' },
      source: { path: 'src/Settings.tsx', line: 42, column: 7, component: 'Settings' },
    }],
    voiceTranscript: 'Make this button match the primary action.',
  }, { secretValues: ['secret', 'password-value'] });
  assert.equal(record.elements[0].attributes.id, 'save');
  assert.equal(Object.hasOwn(record.elements[0].attributes, 'data-token'), false);
  assert.equal(Object.hasOwn(record.elements[0].attributes, 'value'), false);
  assert.equal(record.elements[0].html.includes('secret'), false);
  assert.equal(Object.hasOwn(record.elements[0].computedStyle, 'backgroundImage'), false);
  assert.equal(record.elements[0].source.path, 'src/Settings.tsx');
  assert.match(record.screenshot.sha256, /^[a-f0-9]{64}$/);
  assert.match(record.contextSha256, /^[a-f0-9]{64}$/);
});

test('DesignContextService records multi-select relations, annotations, and parallel edit queue keys', async (t) => {
  const f = await fixture(t);
  const record = await f.service.capture({
    projectId: 'p', sessionId: 's', url: 'http://localhost:3000', revision: 1,
    elements: [
      { selector: '#left', tagName: 'div', text: 'Left', rect: { x: 0, y: 0, width: 100, height: 100 } },
      { selector: '#right', tagName: 'div', text: 'Right', rect: { x: 200, y: 0, width: 100, height: 100 } },
    ],
    relations: [{ fromSelector: '#left', toSelector: '#right', kind: 'match-style' }],
    annotations: [{ kind: 'arrow', from: { x: 50, y: 50 }, to: { x: 250, y: 50 }, label: 'same spacing' }],
  });
  const left = f.service.enqueueEdit(record.id, { selector: '#left', instruction: 'Increase padding' });
  const right = f.service.enqueueEdit(record.id, { selector: '#right', instruction: 'Change icon' });
  assert.notEqual(left.concurrencyKey, right.concurrencyKey);
  assert.equal(record.relations[0].kind, 'match-style');
  assert.equal(record.annotations[0].label, 'same spacing');
  assert.equal(f.service.listEdits(record.id).length, 2);
});

test('DesignContextService provides expiring human takeover leases and hot-reload revisions', async (t) => {
  let now = 10_000;
  const f = await fixture(t, { clock: () => now });
  const lease = f.service.requestTakeover({ sessionId: 'browser-1', actor: 'user:alice', ttlMs: 1_000 });
  assert.equal(f.service.assertAgentControl('browser-1').allowed, false);
  assert.throws(() => f.service.releaseTakeover(lease.leaseId, { actor: 'user:bob' }), /owner/i);
  f.service.releaseTakeover(lease.leaseId, { actor: 'user:alice' });
  assert.equal(f.service.assertAgentControl('browser-1').allowed, true);
  const second = f.service.requestTakeover({ sessionId: 'browser-1', actor: 'user:alice', ttlMs: 1_000 });
  now += 1_001;
  assert.equal(f.service.assertAgentControl('browser-1').allowed, true);
  const revision = f.service.recordHotReload({ sessionId: 'browser-1', url: 'http://localhost:3000', changedFiles: ['src/App.tsx'], previousRevision: 7 });
  assert.equal(revision.revision, 8);
  assert.match(second.leaseSha256, /^[a-f0-9]{64}$/);
});
