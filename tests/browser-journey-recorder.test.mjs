import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { BrowserJourneyRecorder } from '../src/browser/browser-journey-recorder.mjs';

test('BrowserJourneyRecorder emits bounded DOM, accessibility, console, network and artifact evidence', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-journey-'));
  const artifacts = path.join(root, 'artifacts'); await mkdir(artifacts);
  const screenshot = path.join(artifacts, 'page.png'); const video = path.join(artifacts, 'run.webm');
  await writeFile(screenshot, Buffer.from('png-bytes')); await writeFile(video, Buffer.from('video-bytes'));
  const recorder = new BrowserJourneyRecorder({ projectRootResolver: () => root });
  const receipt = await recorder.record({
    projectId: 'p1', missionId: 'm1', taskId: 't1', url: 'https://example.com/path?secret=1',
    domSnapshot: '<main><button>Pay now</button></main>',
    accessibility: { nodes: [{ role: 'main' }, { role: 'button', name: 'Pay now' }], violations: [{ rule: 'button-name', count: 1 }] },
    consoleEntries: [{ level: 'error', message: 'ReferenceError at app.js:1' }, { level: 'log', message: 'ignored' }],
    networkEntries: [{ method: 'GET', url: 'https://api.example.com/private?token=x', status: 500 }, { method: 'GET', url: 'https://ok.example.com', status: 200 }],
    assertions: [{ id: 'checkout-visible', passed: true }, { id: 'no-console-errors', passed: false, message: 'one error' }],
    artifacts: [{ kind: 'screenshot', path: screenshot }, { kind: 'video', path: video }],
  });
  assert.equal(receipt.url.origin, 'https://example.com');
  assert.equal(receipt.url.pathname, '/path');
  assert.match(receipt.dom.sha256, /^[a-f0-9]{64}$/);
  assert.equal(receipt.accessibility.roles.button, 1);
  assert.equal(receipt.console.errors, 1);
  assert.equal(receipt.network.failures, 1);
  assert.equal(receipt.assertions.failed, 1);
  assert.equal(receipt.artifacts.find((item) => item.kind === 'screenshot').status, 'available');
  assert.equal(receipt.artifacts.find((item) => item.kind === 'video').bytes, 11);
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes('Pay now</button>'), false);
  assert.equal(serialized.includes('secret=1'), false);
  assert.equal(serialized.includes('token=x'), false);
});

test('BrowserJourneyRecorder rejects artifacts outside the project and marks absent video explicitly', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-journey-root-'));
  const recorder = new BrowserJourneyRecorder({ projectRootResolver: () => root });
  await assert.rejects(() => recorder.record({ projectId: 'p1', url: 'https://example.com', artifacts: [{ kind: 'screenshot', path: '/tmp/outside.png' }] }), /outside project/i);
  const receipt = await recorder.record({ projectId: 'p1', url: 'https://example.com', domSnapshot: '<main/>', artifacts: [{ kind: 'video', path: null }] });
  assert.equal(receipt.artifacts[0].status, 'unavailable');
  assert.equal(receipt.artifacts[0].reason, 'not-captured');
});

test('BrowserJourneyRecorder compares journeys without claiming visual correctness', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-journey-compare-'));
  const recorder = new BrowserJourneyRecorder({ projectRootResolver: () => root });
  const before = await recorder.record({ projectId: 'p1', url: 'https://example.com', domSnapshot: '<main>A</main>', assertions: [{ id: 'ready', passed: true }] });
  const after = await recorder.record({ projectId: 'p1', url: 'https://example.com', domSnapshot: '<main>B</main>', assertions: [{ id: 'ready', passed: false }] });
  const comparison = recorder.compare(before, after);
  assert.equal(comparison.domChanged, true);
  assert.deepEqual(comparison.regressedAssertions, ['ready']);
  assert.equal(comparison.visualCorrectnessClaimed, false);
});
