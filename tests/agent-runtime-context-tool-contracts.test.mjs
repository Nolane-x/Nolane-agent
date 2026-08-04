import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { CORE_TOOL_SCHEMAS } from '../src/agent/agent-loop.mjs';

function contextPack() {
  return {
    contextPackSha256: 'a'.repeat(64),
    compiled: {
      omissions: [],
      context: {
        system: [{ id: 'system', text: 'Follow repository policy.' }], task: [{ id: 'task', text: 'Inspect src/app.mjs.' }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [],
      },
    },
  };
}

test('context builder emits structured execution instructions and closed tool schemas', () => {
  const built = new ContextBuilder().build(contextPack(), { task: { objective: 'Inspect src/app.mjs.' } });
  assert.equal(built.messages.length, 2);
  assert.match(built.messages[0].content, /structured tool calls/i);
  const names = CORE_TOOL_SCHEMAS.map((item) => item.function.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(CORE_TOOL_SCHEMAS.every((item) => item.function.parameters.additionalProperties === false));
  assert.ok(CORE_TOOL_SCHEMAS.some((item) => item.function.name === 'process.run' && item.function.parameters.required.includes('args')));
});

test('context builder rejects missing compiled context and tool schemas reject shell-string ambiguity', () => {
  assert.throws(() => new ContextBuilder().build({}, { task: 'x' }), /compiled ContextPack/i);
  const processSchema = CORE_TOOL_SCHEMAS.find((item) => item.function.name === 'process.run').function.parameters;
  assert.equal(Object.hasOwn(processSchema.properties, 'shell'), false);
  assert.equal(processSchema.properties.args.type, 'array');
  assert.equal(processSchema.additionalProperties, false);
});
