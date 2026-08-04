import assert from 'node:assert/strict';
import test from 'node:test';

import { HarnessProfileRegistry, createBuiltInHarnessProfiles } from '../src/providers/harness-profile-registry.mjs';
import { HarnessRequestComposer } from '../src/providers/harness-request-composer.mjs';

const tools = Object.freeze([
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'process.run', description: 'Run an executable.', parameters: Object.freeze({ type: 'object', required: ['command'], properties: { command: { type: 'string' } } }) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'fs.patchSet', description: 'Apply bounded patches.', parameters: Object.freeze({ type: 'object', required: ['patches'], properties: { patches: { type: 'array' } } }) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'fs.read', description: 'Read a file.', parameters: Object.freeze({ type: 'object', required: ['path'], properties: { path: { type: 'string' } } }) }) }),
]);
const messages = Object.freeze([
  Object.freeze({ role: 'system', content: 'Base Forge policy.' }),
  Object.freeze({ role: 'user', content: 'Fix the parser regression.' }),
]);

function composer() {
  return new HarnessRequestComposer({ registry: new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() }) });
}

test('composer creates distinct provider-specific messages while preserving task text and tool schemas', () => {
  const value = composer();
  const codex = value.compose({ provider: { id: 'codex', harnessFamily: 'codex-cli' }, messages, tools, task: { role: 'executor', metadata: { taskKind: 'bugfix' } } });
  const claude = value.compose({ provider: { id: 'claude', harnessFamily: 'claude-code' }, messages, tools, task: { role: 'executor', metadata: { taskKind: 'bugfix' } } });

  assert.equal(codex.profileId, 'codex-cli-v1');
  assert.equal(claude.profileId, 'claude-code-v1');
  assert.notEqual(codex.messages[0].content, claude.messages[0].content);
  assert.match(codex.messages[0].content, /Forge action contract/i);
  assert.match(claude.messages[0].content, /explicit plan/i);
  assert.equal(codex.messages[1].content, 'Fix the parser regression.');
  assert.deepEqual(codex.tools.find((tool) => tool.function.name === 'fs.read').function.parameters, tools[2].function.parameters);
  assert.match(codex.receiptSha256, /^[a-f0-9]{64}$/);
  assert.match(codex.profileSha256, /^[a-f0-9]{64}$/);
});

test('composer reorders tools by harness strategy and limits schemas without mutating inputs', () => {
  const value = composer();
  const codex = value.compose({ provider: { harnessFamily: 'codex-cli' }, messages, tools, task: {} });
  const claude = value.compose({ provider: { harnessFamily: 'claude-code' }, messages, tools, task: {} });
  assert.equal(codex.tools[0].function.name, 'fs.patchSet');
  assert.equal(claude.tools[0].function.name, 'fs.read');
  assert.equal(tools[0].function.name, 'process.run');
  assert.throws(() => { codex.tools.push(tools[0]); }, TypeError);
});

test('classified retry guidance is bounded and category specific', () => {
  const result = composer().compose({
    provider: { harnessFamily: 'codex-cli' }, messages, tools, task: {},
    failure: { class: 'sandbox-denied', retryable: false, fingerprint: 'f'.repeat(64) },
  });
  assert.match(result.messages[0].content, /sandbox boundary/i);
  assert.doesNotMatch(result.messages[0].content, /f{64}/);
});

test('unknown providers use generic profile and a missing system message is created safely', () => {
  const result = composer().compose({ provider: { id: 'custom' }, messages: [{ role: 'user', content: 'Hello' }], tools: [], task: {} });
  assert.equal(result.profileId, 'generic-local-v1');
  assert.equal(result.messages[0].role, 'system');
  assert.equal(result.messages[1].content, 'Hello');
});
