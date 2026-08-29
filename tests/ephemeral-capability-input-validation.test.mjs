import test from 'node:test';
import assert from 'node:assert/strict';

import { EphemeralCapabilityRegistry } from '../src/agent/ephemeral-capability-registry.mjs';

const hash = 'a'.repeat(64);
const primitiveSchemas = new Map([
  ['fs.read', { type: 'function', function: { name: 'fs.read', description: 'read', parameters: { type: 'object', additionalProperties: false, properties: {} } } }],
]);

function registryWithCapability(parameters) {
  const registry = new EphemeralCapabilityRegistry({ runId: 'run-input-validation', taskId: 'task-input-validation' });
  const capability = registry.register({
    name: 'validateInput',
    description: 'Validate model-supplied input before any primitive effect.',
    parameters,
    steps: [{ id: 'read', tool: 'fs.read', args: {} }],
    output: { $bind: { from: 'step', stepId: 'read', path: ['output'] } },
  }, { primitiveSchemas });
  let executions = 0;
  const options = {
    isPrimitiveActive: () => true,
    async executePrimitive() {
      executions += 1;
      return { status: 'pass', output: { ok: true }, receipt: { receiptSha256: hash } };
    },
  };
  return { registry, capability, options, executions: () => executions };
}

const richSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'count', 'mode', 'nested', 'tags'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 8 },
    count: { type: 'integer', minimum: 1, maximum: 3 },
    mode: { type: 'string', enum: ['safe', 'strict'] },
    enabled: { type: 'boolean', const: true },
    nested: {
      type: 'object', additionalProperties: false, required: ['ratio'],
      properties: { ratio: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 } },
    },
    tags: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', minLength: 1 } },
  },
};

test('invoke validates the registered parameter schema before any primitive effect', async () => {
  const { registry, capability, options, executions } = registryWithCapability(richSchema);
  const invalid = [
    {},
    { name: 'ok', count: 1, mode: 'safe', nested: { ratio: 0.5 }, tags: ['x'], extra: true },
    { name: 'x', count: 1, mode: 'safe', nested: { ratio: 0.5 }, tags: ['x'] },
    { name: 'valid', count: 1.5, mode: 'safe', nested: { ratio: 0.5 }, tags: ['x'] },
    { name: 'valid', count: 0, mode: 'safe', nested: { ratio: 0.5 }, tags: ['x'] },
    { name: 'valid', count: 1, mode: 'unsafe', nested: { ratio: 0.5 }, tags: ['x'] },
    { name: 'valid', count: 1, mode: 'safe', enabled: false, nested: { ratio: 0.5 }, tags: ['x'] },
    { name: 'valid', count: 1, mode: 'safe', nested: { ratio: 1 }, tags: ['x'] },
    { name: 'valid', count: 1, mode: 'safe', nested: { ratio: 0.5, extra: 1 }, tags: ['x'] },
    { name: 'valid', count: 1, mode: 'safe', nested: { ratio: 0.5 }, tags: [] },
  ];
  for (const input of invalid) {
    await assert.rejects(
      () => registry.invoke(capability.name, input, options),
      (error) => error?.code === 'EPHEMERAL_CAPABILITY_INPUT_SCHEMA',
    );
  }
  assert.equal(executions(), 0, 'invalid model input must be rejected before the first primitive effect');

  const result = await registry.invoke(capability.name, {
    name: 'valid', count: 2, mode: 'strict', enabled: true, nested: { ratio: 0.5 }, tags: ['a', 'b'],
  }, options);
  assert.equal(result.status, 'pass');
  assert.equal(executions(), 1);
});

test('register rejects non-object step args and dangerous schema property names', () => {
  const registry = new EphemeralCapabilityRegistry({ runId: 'run-registration-hardening', taskId: 'task-registration-hardening' });
  assert.throws(() => registry.register({
    name: 'badArgs', description: 'bad args',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    steps: [{ id: 'read', tool: 'fs.read', args: ['not-an-object'] }],
    output: null,
  }, { primitiveSchemas }), (error) => error?.code === 'EPHEMERAL_CAPABILITY_STEP_ARGS');

  const dangerousProperties = Object.create(null);
  dangerousProperties.constructor = { type: 'string' };
  assert.throws(() => registry.register({
    name: 'dangerousProperty', description: 'dangerous property',
    parameters: { type: 'object', additionalProperties: false, properties: dangerousProperties },
    steps: [{ id: 'read', tool: 'fs.read', args: {} }],
    output: null,
  }, { primitiveSchemas }), (error) => error?.code === 'EPHEMERAL_CAPABILITY_SCHEMA_PROPERTY');
});
