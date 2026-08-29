import test from 'node:test';
import assert from 'node:assert/strict';

import { EphemeralCapabilityRegistry } from '../src/agent/ephemeral-capability-registry.mjs';

const primitiveSchemas = new Map([
  ['fs.read', { type: 'function', function: { name: 'fs.read', description: 'read', parameters: { type: 'object', additionalProperties: false, properties: {} } } }],
]);

function definition(parameters) {
  return {
    name: 'schemaValidation',
    description: 'Exercise bounded parameter-schema definition validation.',
    parameters,
    steps: [{ id: 'read', tool: 'fs.read', args: {} }],
    output: null,
  };
}

function rejects(parameters, expectedCode = 'EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT') {
  const registry = new EphemeralCapabilityRegistry({ runId: 'schema-run', taskId: 'schema-task' });
  assert.throws(
    () => registry.register(definition(parameters), { primitiveSchemas }),
    (error) => error?.code === expectedCode,
  );
}

test('register rejects malformed numeric, string, and array constraint values', () => {
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'string', minLength: '1' } } });
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'string', maxLength: -1 } } });
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'number', minimum: '0' } } });
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'integer', exclusiveMaximum: null } } });
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'array', minItems: 1.5, items: { type: 'string' } } } });
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'array', maxItems: -1, items: { type: 'string' } } } });
});

test('register rejects type-inapplicable constraint keywords and contradictory simple ranges', () => {
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'string', minimum: 1 } } }, 'EPHEMERAL_CAPABILITY_SCHEMA_SHAPE');
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'number', minLength: 1 } } }, 'EPHEMERAL_CAPABILITY_SCHEMA_SHAPE');
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'boolean', minItems: 1 } } }, 'EPHEMERAL_CAPABILITY_SCHEMA_SHAPE');
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'string', minLength: 5, maxLength: 2 } } });
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'array', minItems: 3, maxItems: 1, items: { type: 'string' } } } });
  rejects({ type: 'object', additionalProperties: false, properties: { value: { type: 'number', minimum: 5, maximum: 2 } } });
});

test('register rejects duplicate required entries but accepts well-formed bounded constraints', () => {
  rejects({ type: 'object', additionalProperties: false, required: ['value', 'value'], properties: { value: { type: 'string' } } }, 'EPHEMERAL_CAPABILITY_SCHEMA_REQUIRED');

  const registry = new EphemeralCapabilityRegistry({ runId: 'schema-run-ok', taskId: 'schema-task-ok' });
  const registered = registry.register(definition({
    type: 'object', additionalProperties: false, required: ['name', 'count', 'tags'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 8 },
      count: { type: 'integer', minimum: 0, maximum: 10, exclusiveMaximum: 11 },
      tags: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', minLength: 1 } },
    },
  }), { primitiveSchemas });
  assert.equal(registered.name, 'ephemeral.schemaValidation');
});
