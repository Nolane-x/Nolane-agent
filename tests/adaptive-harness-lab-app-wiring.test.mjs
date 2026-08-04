import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../src/app.mjs', import.meta.url);

test('application constructs one adaptive harness lifecycle facade and exposes bounded status', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /import \{ createAdaptiveHarnessLab \} from '\.\/providers\/adaptive-harness-lab\.mjs';/);
  assert.match(source, /const adaptiveHarness = createAdaptiveHarnessLab\(\{/);
  assert.match(source, /dataDir: config\.dataDir/);
  assert.match(source, /eventSink: \(event\) => store\.appendEvent\(createEvent\(event\.type, event\)\)/);
  assert.match(source, /adaptiveHarness: adaptiveHarness\.publicView\(\)/);
});

test('agent and evaluation paths use the governed harness composer', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /new AgentLoop\(\{[^}]*harnessComposer: adaptiveHarness\.composer, harnessFailureStore: adaptiveHarness\.failureStore, harnessFailureClassifier: adaptiveHarness\.failureClassifier/s);
  assert.match(source, /const composed = adaptiveHarness\.composer\.compose\(\{ provider, messages, tools: \[\], task: \{ role: 'evaluation'/);
  assert.match(source, /provider\.complete\(\{ messages: composed\.messages, tools: composed\.tools, signal \}\)/);
});

test('application closes the adaptive harness lifecycle during shutdown', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /outcomeMetricsStore\.close\(\);\s*adaptiveHarness\.close\(\);/s);
});
