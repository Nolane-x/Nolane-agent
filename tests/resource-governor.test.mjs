import test from 'node:test';
import assert from 'node:assert/strict';

import { ResourceGovernor } from '../src/runtime/resource-governor.mjs';

test('resource governor transitions with hysteresis and emits only state changes', () => {
  const events = [];
  const governor = new ResourceGovernor({
    limits: { rssPressureBytes: 100, rssBrownoutBytes: 150, eventLoopPressureMs: 20, eventLoopBrownoutMs: 50, websocketPressureBytes: 1000, websocketBrownoutBytes: 2000, maxActiveAgents: 2, maxActiveTerminals: 4, maxEditorModels: 8 },
    recoverSamples: 2,
    onTransition: (event) => events.push(event),
  });
  assert.equal(governor.sample({ rssBytes: 80, eventLoopDelayMs: 2 }).state, 'normal');
  assert.equal(governor.sample({ rssBytes: 110, eventLoopDelayMs: 2 }).state, 'pressure');
  assert.equal(governor.sample({ rssBytes: 120, eventLoopDelayMs: 2 }).state, 'pressure');
  assert.equal(governor.sample({ rssBytes: 160, eventLoopDelayMs: 2 }).state, 'brownout');
  assert.equal(governor.sample({ rssBytes: 70, eventLoopDelayMs: 2 }).state, 'brownout');
  assert.equal(governor.sample({ rssBytes: 70, eventLoopDelayMs: 2 }).state, 'normal');
  assert.deepEqual(events.map((item) => `${item.from}->${item.to}`), ['normal->pressure', 'pressure->brownout', 'brownout->normal']);
});

test('resource governor applies state-aware admission and optional-feature policy', () => {
  const governor = new ResourceGovernor({ limits: { rssPressureBytes: 100, rssBrownoutBytes: 150, eventLoopPressureMs: 20, eventLoopBrownoutMs: 50, websocketPressureBytes: 1000, websocketBrownoutBytes: 2000, maxActiveAgents: 2, maxActiveTerminals: 4, maxEditorModels: 8 } });
  assert.equal(governor.canAdmit('agent', { activeAgents: 1 }).allowed, true);
  assert.equal(governor.canAdmit('agent', { activeAgents: 2 }).allowed, false);
  assert.equal(governor.canAdmit('terminal', { activeTerminals: 4 }).allowed, false);
  governor.sample({ rssBytes: 120 });
  assert.equal(governor.policy().repositoryReindexDelayMs > 0, true);
  assert.equal(governor.policy().maxEditorModels < 8, true);
  governor.sample({ rssBytes: 180 });
  assert.equal(governor.canAdmit('agent', { activeAgents: 0 }).allowed, false);
  assert.equal(governor.policy().optionalPreviews, false);
  assert.equal(governor.policy().backgroundRefresh, false);
});

test('resource governor treats output-rate and queue pressure as bounded brownout signals', () => {
  const governor = new ResourceGovernor({ limits: { rssPressureBytes: 1_000_000, rssBrownoutBytes: 2_000_000, eventLoopPressureMs: 20, eventLoopBrownoutMs: 50, websocketPressureBytes: 1000, websocketBrownoutBytes: 2000, terminalOutputPressureBytesPerSecond: 5000, terminalOutputBrownoutBytesPerSecond: 10000, maxActiveAgents: 2, maxActiveTerminals: 4, maxEditorModels: 8 } });
  assert.equal(governor.sample({ websocketQueueBytes: 1200 }).state, 'pressure');
  assert.equal(governor.sample({ terminalOutputBytesPerSecond: 12_000 }).state, 'brownout');
  assert.equal(governor.policy().terminalFlushIntervalMs >= 80, true);
});

test('resource governor uses system available memory and enters emergency before the machine is exhausted', () => {
  const events = [];
  const governor = new ResourceGovernor({
    limits: {
      rssPressureBytes: 10_000,
      rssBrownoutBytes: 20_000,
      eventLoopPressureMs: 100,
      eventLoopBrownoutMs: 200,
      systemAvailablePressureBytes: 3_000,
      systemAvailableBrownoutBytes: 1_500,
      systemAvailableEmergencyBytes: 800,
      maxActiveAgents: 2,
      maxActiveTerminals: 4,
      maxEditorModels: 8,
      maxBrowserSessions: 1,
      maxToolOutputBytes: 1_000_000,
      maxEventHistory: 10_000,
    },
    onTransition: (event) => events.push(event),
  });
  assert.equal(governor.sample({ rssBytes: 100, systemTotalBytes: 8_000, systemAvailableBytes: 2_500 }).state, 'pressure');
  assert.equal(governor.sample({ rssBytes: 100, systemTotalBytes: 8_000, systemAvailableBytes: 1_200 }).state, 'brownout');
  assert.equal(governor.sample({ rssBytes: 100, systemTotalBytes: 8_000, systemAvailableBytes: 700 }).state, 'emergency');
  assert.equal(governor.policy().maxActiveAgents, 0);
  assert.equal(governor.policy().maxBrowserSessions, 0);
  assert.equal(governor.policy().unloadOptionalModules, true);
  assert.equal(governor.policy().semanticIndexing, 'suspended');
  assert.equal(governor.canAdmit('agent', { activeAgents: 0 }).allowed, false);
  assert.deepEqual(events.map((item) => item.to), ['pressure', 'brownout', 'emergency']);
});

test('missing system-memory metrics preserve legacy RSS behavior', () => {
  const governor = new ResourceGovernor({ limits: { rssPressureBytes: 100, rssBrownoutBytes: 150, systemAvailablePressureBytes: 3_000, systemAvailableBrownoutBytes: 1_500, systemAvailableEmergencyBytes: 800 } });
  assert.equal(governor.sample({ rssBytes: 80 }).state, 'normal');
  assert.equal(governor.sample({ rssBytes: 120 }).state, 'pressure');
});
