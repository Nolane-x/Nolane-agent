import test from 'node:test';
import assert from 'node:assert/strict';
import { EphemeralCapabilityRegistry } from '../src/agent/ephemeral-capability-registry.mjs';

const schema = (name) => ({ type: 'function', function: { name, description: `${name} tool`, parameters: { type: 'object', additionalProperties: false, properties: {} } } });
const primitiveSchemas = new Map([['fs.search', schema('fs.search')], ['fs.read', schema('fs.read')], ['fs.write', schema('fs.write')]]);
const hash = (char) => char.repeat(64);

function definition(overrides = {}) {
  return {
    name: 'inspectSymbolUsage',
    description: 'Find references to a symbol and read the first matched file.',
    parameters: { type: 'object', additionalProperties: false, required: ['symbol'], properties: { symbol: { type: 'string', minLength: 1 } } },
    steps: [
      { id: 'search', tool: 'fs.search', args: { query: { $bind: { from: 'input', path: ['symbol'] } } } },
      { id: 'read', tool: 'fs.read', args: { path: { $bind: { from: 'step', stepId: 'search', path: ['output', 'matches', 0, 'path'] } } } },
    ],
    output: { $bind: { from: 'step', stepId: 'read', path: ['output'] } },
    ...overrides,
  };
}

test('register validates, namespaces, freezes, and signs a bounded composite definition', () => {
  const registry = new EphemeralCapabilityRegistry({ runId: 'run-1', taskId: 'task-1' });
  const registered = registry.register(definition(), { primitiveSchemas });
  assert.equal(registered.name, 'ephemeral.inspectSymbolUsage');
  assert.equal(registered.schema.function.name, registered.name);
  assert.equal(registered.definition.steps.length, 2);
  assert.equal(Object.isFrozen(registered.definition), true);
  assert.equal(Object.isFrozen(registered.definition.steps[0].args), true);
  assert.equal(registered.receipt.schema, 'forge.ephemeral-capability-definition.v1');
  assert.match(registered.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(registered.receipt.primitiveTools, ['fs.search', 'fs.read']);
  assert.equal(registry.snapshot().count, 1);
  assert.deepEqual(registry.snapshot().capabilities.map((item) => Object.keys(item).sort()), [['definitionReceiptSha256', 'name', 'schemaSha256'].sort()]);
});

test('register rejects authority expansion, meta/composite primitives, duplicate/forward steps, unsafe paths, bad schemas, and capacity overflow', () => {
  const registry = new EphemeralCapabilityRegistry({ runId: 'run-1', taskId: 'task-1', maxCapabilities: 1 });
  assert.throws(() => registry.register(definition({ steps: [{ id: 'x', tool: 'process.run', args: {} }] }), { primitiveSchemas }), /not authorized/i);
  assert.throws(() => registry.register(definition({ steps: [{ id: 'x', tool: 'tool.compose.create', args: {} }] }), { primitiveSchemas: new Map([['tool.compose.create', schema('tool.compose.create')]]) }), /primitive|meta/i);
  assert.throws(() => registry.register(definition({ steps: [{ id: 'x', tool: 'ephemeral.other', args: {} }] }), { primitiveSchemas: new Map([['ephemeral.other', schema('ephemeral.other')]]) }), /primitive|composite/i);
  assert.throws(() => registry.register(definition({ steps: [{ id: 'x', tool: 'fs.read', args: {} }, { id: 'x', tool: 'fs.search', args: {} }] }), { primitiveSchemas }), /duplicate/i);
  assert.throws(() => registry.register(definition({ steps: [{ id: 'a', tool: 'fs.read', args: { path: { $bind: { from: 'step', stepId: 'b', path: ['output'] } } } }, { id: 'b', tool: 'fs.search', args: {} }] }), { primitiveSchemas }), /earlier|forward/i);
  assert.throws(() => registry.register(definition({ steps: [{ id: 'x', tool: 'fs.read', args: { path: { $bind: { from: 'input', path: ['__proto__'] } } } }] }), { primitiveSchemas }), /unsafe|dangerous/i);
  assert.throws(() => registry.register(definition({ parameters: { type: 'object', additionalProperties: true, properties: {} } }), { primitiveSchemas }), /additionalProperties/i);
  assert.throws(() => registry.register(definition({ parameters: { type: 'object', additionalProperties: false, properties: { x: { $ref: '#/x' } } } }), { primitiveSchemas }), /keyword|\$ref/i);
  registry.register(definition(), { primitiveSchemas });
  assert.throws(() => registry.register(definition({ name: 'second' }), { primitiveSchemas }), /capacity/i);
});

test('register rejects oversized/deep definitions and excessive bindings', () => {
  const registry = new EphemeralCapabilityRegistry({ runId: 'run-1', taskId: 'task-1' });
  assert.throws(() => registry.register(definition({ description: 'x'.repeat(1001) }), { primitiveSchemas }), /description/i);
  assert.throws(() => registry.register(definition({ steps: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, tool: 'fs.read', args: {} })) }), { primitiveSchemas }), /8|steps/i);
  let deep = 'x';
  for (let i = 0; i < 25; i += 1) deep = { x: deep };
  assert.throws(() => registry.register(definition({ steps: [{ id: 'x', tool: 'fs.read', args: deep }] }), { primitiveSchemas }), /depth/i);
  const many = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`x${i}`, { $bind: { from: 'input', path: ['symbol'] } }]));
  assert.throws(() => registry.register(definition({ steps: [{ id: 'x', tool: 'fs.read', args: many }] }), { primitiveSchemas }), /binding/i);
});

test('invoke resolves only explicit bindings, rechecks active authority, sequences child receipts, and signs aggregate output', async () => {
  const registry = new EphemeralCapabilityRegistry({ runId: 'run-1', taskId: 'task-1' });
  const registered = registry.register(definition(), { primitiveSchemas });
  const calls = [];
  const result = await registry.invoke(registered.name, { symbol: 'AgentLoop' }, {
    isPrimitiveActive: (name) => primitiveSchemas.has(name),
    async executePrimitive({ name, args, parentCompositeId, childStepId }) {
      calls.push({ name, args, parentCompositeId, childStepId });
      if (name === 'fs.search') return { status: 'pass', output: { matches: [{ path: 'src/agent/agent-loop.mjs' }] }, receipt: { receiptSha256: hash('a') } };
      return { status: 'pass', output: { content: 'source' }, receipt: { receiptSha256: hash('b') } };
    },
  });
  assert.deepEqual(calls.map((item) => [item.name, item.args]), [['fs.search', { query: 'AgentLoop' }], ['fs.read', { path: 'src/agent/agent-loop.mjs' }]]);
  assert.deepEqual(result.output, { content: 'source' });
  assert.deepEqual(result.childReceipts, [hash('a'), hash('b')]);
  assert.equal(result.status, 'pass');
  assert.equal(result.receipt.schema, 'forge.ephemeral-capability-execution.v1');
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(calls.every((item) => item.parentCompositeId === registered.name), true);
});

test('invoke treats non-binding objects as literals and fails closed on stale authority, missing binding, child failure, or invalid receipts', async () => {
  const registry = new EphemeralCapabilityRegistry({ runId: 'run-1', taskId: 'task-1' });
  const literal = registry.register(definition({ name: 'literal', steps: [{ id: 'x', tool: 'fs.read', args: { payload: { from: 'input', path: ['literal'] } } }], output: { $bind: { from: 'step', stepId: 'x', path: ['output'] } } }), { primitiveSchemas });
  let observed;
  await registry.invoke(literal.name, { symbol: 'unused' }, { isPrimitiveActive: () => true, async executePrimitive({ args }) { observed = args; return { status: 'pass', output: 'ok', receipt: { receiptSha256: hash('c') } }; } });
  assert.deepEqual(observed.payload, { from: 'input', path: ['literal'] });

  const registered = registry.register(definition({ name: 'failures' }), { primitiveSchemas });
  await assert.rejects(() => registry.invoke(registered.name, { symbol: 'x' }, { isPrimitiveActive: () => false, executePrimitive: async () => assert.fail('must not execute') }), /active|authorized/i);
  await assert.rejects(() => registry.invoke(registered.name, {}, { isPrimitiveActive: () => true, executePrimitive: async () => assert.fail('must not execute') }), /binding|missing/i);
  await assert.rejects(() => registry.invoke(registered.name, { symbol: 'x' }, { isPrimitiveActive: () => true, async executePrimitive() { return { status: 'fail', output: {}, receipt: { receiptSha256: hash('d') } }; } }), /child|fail/i);
  await assert.rejects(() => registry.invoke(registered.name, { symbol: 'x' }, { isPrimitiveActive: () => true, async executePrimitive() { return { status: 'pass', output: {}, receipt: { receiptSha256: 'bad' } }; } }), /receipt/i);
});

test('aggregate receipt changes when definition, input, child receipt, or output changes', async () => {
  const execute = async ({ name }, child = 'a', content = 'source') => name === 'fs.search'
    ? { status: 'pass', output: { matches: [{ path: 'x' }] }, receipt: { receiptSha256: hash(child) } }
    : { status: 'pass', output: { content }, receipt: { receiptSha256: hash('b') } };
  const make = (name = 'one') => { const r = new EphemeralCapabilityRegistry({ runId: 'r', taskId: 't' }); return { r, c: r.register(definition({ name }), { primitiveSchemas }) }; };
  const first = make();
  const a = await first.r.invoke(first.c.name, { symbol: 'x' }, { isPrimitiveActive: () => true, executePrimitive: (x) => execute(x, 'a', 'source') });
  const b = await first.r.invoke(first.c.name, { symbol: 'y' }, { isPrimitiveActive: () => true, executePrimitive: (x) => execute(x, 'a', 'source') });
  const c = await first.r.invoke(first.c.name, { symbol: 'x' }, { isPrimitiveActive: () => true, executePrimitive: (x) => execute(x, 'c', 'source') });
  const d = await first.r.invoke(first.c.name, { symbol: 'x' }, { isPrimitiveActive: () => true, executePrimitive: (x) => execute(x, 'a', 'changed') });
  const second = make('two');
  const e = await second.r.invoke(second.c.name, { symbol: 'x' }, { isPrimitiveActive: () => true, executePrimitive: (x) => execute(x, 'a', 'source') });
  assert.equal(new Set([a.receipt.receiptSha256, b.receipt.receiptSha256, c.receipt.receiptSha256, d.receipt.receiptSha256, e.receipt.receiptSha256]).size, 5);
});
