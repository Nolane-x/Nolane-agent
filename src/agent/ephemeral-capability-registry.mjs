import { canonicalSha256, canonicalStringify } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const HASH = /^[a-f0-9]{64}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const STEP_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const DANGEROUS_PATH_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const META_PREFIXES = ['tool.catalog.', 'tool.compose.', 'ephemeral.'];
const ALLOWED_SCHEMA_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object', 'null']);
const ALLOWED_SCHEMA_KEYS = new Set([
  'type', 'additionalProperties', 'properties', 'required', 'enum', 'const',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'minItems', 'maxItems', 'items',
]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneJson(value, label = 'value') {
  try {
    return JSON.parse(canonicalStringify(value));
  } catch (error) {
    fail('EPHEMERAL_CAPABILITY_NON_JSON', `${label} must be bounded plain JSON: ${error.message}`);
  }
}

function assertText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim()) fail('EPHEMERAL_CAPABILITY_INVALID_TEXT', `${label} must be a non-empty string`);
  if (value.length > maxLength) fail('EPHEMERAL_CAPABILITY_LIMIT', `${label} exceeds ${maxLength} characters`);
  return value.trim();
}

function assertSchema(schema, { root = false, depth = 0 } = {}) {
  if (depth > 24) fail('EPHEMERAL_CAPABILITY_SCHEMA_DEPTH', 'parameter schema depth exceeds 24');
  if (!plainObject(schema)) fail('EPHEMERAL_CAPABILITY_SCHEMA_INVALID', 'parameter schema must be an object');
  for (const key of Object.keys(schema)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) fail('EPHEMERAL_CAPABILITY_SCHEMA_KEYWORD', `unsupported parameter schema keyword: ${key}`);
  }
  if (!ALLOWED_SCHEMA_TYPES.has(schema.type)) fail('EPHEMERAL_CAPABILITY_SCHEMA_TYPE', `unsupported parameter schema type: ${schema.type}`);
  if (root && schema.type !== 'object') fail('EPHEMERAL_CAPABILITY_SCHEMA_ROOT', 'root parameter schema type must be object');

  const numericKeys = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'];
  const stringKeys = ['minLength', 'maxLength'];
  const arrayKeys = ['minItems', 'maxItems'];
  const present = (keys) => keys.filter((key) => schema[key] !== undefined);
  const numericPresent = present(numericKeys);
  const stringPresent = present(stringKeys);
  const arrayPresent = present(arrayKeys);

  if (numericPresent.length && !['number', 'integer'].includes(schema.type)) fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', `${schema.type} schema cannot declare numeric constraints`);
  if (stringPresent.length && schema.type !== 'string') fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', `${schema.type} schema cannot declare string-length constraints`);
  if (arrayPresent.length && schema.type !== 'array') fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', `${schema.type} schema cannot declare array-length constraints`);

  for (const key of numericPresent) {
    if (typeof schema[key] !== 'number' || !Number.isFinite(schema[key])) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', `${key} must be a finite number`);
  }
  for (const key of [...stringPresent, ...arrayPresent]) {
    if (!Number.isSafeInteger(schema[key]) || schema[key] < 0) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', `${key} must be a non-negative safe integer`);
  }
  if (schema.minLength !== undefined && schema.maxLength !== undefined && schema.minLength > schema.maxLength) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', 'minLength cannot exceed maxLength');
  if (schema.minItems !== undefined && schema.maxItems !== undefined && schema.minItems > schema.maxItems) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', 'minItems cannot exceed maxItems');
  if (schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', 'minimum cannot exceed maximum');
  if (schema.exclusiveMinimum !== undefined && schema.exclusiveMaximum !== undefined && schema.exclusiveMinimum >= schema.exclusiveMaximum) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', 'exclusiveMinimum must be below exclusiveMaximum');
  if (schema.minimum !== undefined && schema.exclusiveMaximum !== undefined && schema.minimum >= schema.exclusiveMaximum) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', 'minimum must be below exclusiveMaximum');
  if (schema.exclusiveMinimum !== undefined && schema.maximum !== undefined && schema.exclusiveMinimum >= schema.maximum) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', 'exclusiveMinimum must be below maximum');

  if (schema.type === 'object') {
    if (schema.additionalProperties !== false) fail('EPHEMERAL_CAPABILITY_SCHEMA_ADDITIONAL', 'object parameter schemas require additionalProperties:false');
    if (schema.properties !== undefined && !plainObject(schema.properties)) fail('EPHEMERAL_CAPABILITY_SCHEMA_PROPERTIES', 'properties must be an object');
    const properties = schema.properties ?? {};
    if (root && Object.keys(properties).length > 32) fail('EPHEMERAL_CAPABILITY_PARAMETER_LIMIT', 'composite input parameters exceed 32');
    for (const [name, child] of Object.entries(properties)) {
      if (!name || DANGEROUS_PATH_KEYS.has(name)) fail('EPHEMERAL_CAPABILITY_SCHEMA_PROPERTY', `unsafe or empty parameter property name: ${name}`);
      assertSchema(child, { depth: depth + 1 });
    }
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required) || schema.required.some((item) => typeof item !== 'string' || !Object.hasOwn(properties, item)) || new Set(schema.required).size !== schema.required.length) {
        fail('EPHEMERAL_CAPABILITY_SCHEMA_REQUIRED', 'required must contain unique declared property names');
      }
    }
  } else if (schema.additionalProperties !== undefined || schema.properties !== undefined || schema.required !== undefined) {
    fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', `${schema.type} schema cannot declare object-only keywords`);
  }

  if (schema.type === 'array') {
    if (!schema.items) fail('EPHEMERAL_CAPABILITY_SCHEMA_ITEMS', 'array parameter schema requires items');
    assertSchema(schema.items, { depth: depth + 1 });
  } else if (schema.items !== undefined) {
    fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', `${schema.type} schema cannot declare items`);
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length === 0)) fail('EPHEMERAL_CAPABILITY_SCHEMA_ENUM', 'enum must be a non-empty array');
  return schema;
}

function schemaValueEqual(left, right) {
  try { return canonicalStringify(left) === canonicalStringify(right); }
  catch { return false; }
}

function inputSchemaFailure(path, message) {
  fail('EPHEMERAL_CAPABILITY_INPUT_SCHEMA', `invalid composite input at ${path}: ${message}`);
}

function validateInputValue(value, schema, path = '$', depth = 0) {
  if (depth > 24) inputSchemaFailure(path, 'schema validation depth exceeds 24');
  const type = schema.type;
  const typeValid = type === 'null' ? value === null
    : type === 'object' ? plainObject(value)
      : type === 'array' ? Array.isArray(value)
        : type === 'integer' ? Number.isSafeInteger(value)
          : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
            : type === 'string' ? typeof value === 'string'
              : type === 'boolean' ? typeof value === 'boolean'
                : false;
  if (!typeValid) inputSchemaFailure(path, `expected ${type}`);

  if (schema.const !== undefined && !schemaValueEqual(value, schema.const)) inputSchemaFailure(path, 'const constraint failed');
  if (schema.enum !== undefined && !schema.enum.some((candidate) => schemaValueEqual(value, candidate))) inputSchemaFailure(path, 'enum constraint failed');

  if (type === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) inputSchemaFailure(path, `minLength ${schema.minLength} not met`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) inputSchemaFailure(path, `maxLength ${schema.maxLength} exceeded`);
  }
  if (type === 'number' || type === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) inputSchemaFailure(path, `minimum ${schema.minimum} not met`);
    if (schema.maximum !== undefined && value > schema.maximum) inputSchemaFailure(path, `maximum ${schema.maximum} exceeded`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) inputSchemaFailure(path, `exclusiveMinimum ${schema.exclusiveMinimum} not met`);
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) inputSchemaFailure(path, `exclusiveMaximum ${schema.exclusiveMaximum} exceeded`);
  }
  if (type === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) inputSchemaFailure(path, `minItems ${schema.minItems} not met`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) inputSchemaFailure(path, `maxItems ${schema.maxItems} exceeded`);
    for (let index = 0; index < value.length; index += 1) validateInputValue(value[index], schema.items, `${path}[${index}]`, depth + 1);
  }
  if (type === 'object') {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) inputSchemaFailure(path, `missing required property ${required}`);
    for (const key of Object.keys(value)) {
      if (DANGEROUS_PATH_KEYS.has(key)) inputSchemaFailure(path, `unsafe property ${key}`);
      if (!Object.hasOwn(properties, key)) inputSchemaFailure(path, `additional property ${key} is not allowed`);
      validateInputValue(value[key], properties[key], `${path}.${key}`, depth + 1);
    }
  }
  return true;
}

function bindingNode(value) {
  return plainObject(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$bind');
}

function normalizePath(path) {
  if (!Array.isArray(path) || path.length > 16) fail('EPHEMERAL_CAPABILITY_BINDING_PATH', 'binding path must be an array with depth at most 16');
  return path.map((segment) => {
    if (typeof segment === 'string') {
      if (DANGEROUS_PATH_KEYS.has(segment)) fail('EPHEMERAL_CAPABILITY_BINDING_UNSAFE', `unsafe binding path segment: ${segment}`);
      return segment;
    }
    if (Number.isSafeInteger(segment) && segment >= 0) return segment;
    fail('EPHEMERAL_CAPABILITY_BINDING_PATH', 'binding path segments must be strings or non-negative safe integers');
  });
}

function normalizeBinding(value, earlierStepIds) {
  if (!plainObject(value) || !plainObject(value.$bind)) fail('EPHEMERAL_CAPABILITY_BINDING_INVALID', 'binding must contain an object $bind instruction');
  const bind = value.$bind;
  const keys = Object.keys(bind).sort();
  const from = bind.from;
  if (from === 'input') {
    if (keys.some((key) => !['from', 'path'].includes(key))) fail('EPHEMERAL_CAPABILITY_BINDING_INVALID', 'input binding has unsupported fields');
    return { $bind: { from: 'input', path: normalizePath(bind.path ?? []) } };
  }
  if (from === 'step') {
    if (keys.some((key) => !['from', 'path', 'stepId'].includes(key))) fail('EPHEMERAL_CAPABILITY_BINDING_INVALID', 'step binding has unsupported fields');
    const stepId = assertText(bind.stepId, 'binding stepId', 64);
    if (!earlierStepIds.has(stepId)) fail('EPHEMERAL_CAPABILITY_BINDING_FORWARD', `binding step ${stepId} must reference an earlier step`);
    return { $bind: { from: 'step', stepId, path: normalizePath(bind.path ?? []) } };
  }
  fail('EPHEMERAL_CAPABILITY_BINDING_INVALID', `unsupported binding source: ${String(from)}`);
}

function normalizeTemplate(value, earlierStepIds, state, depth = 0) {
  if (depth > 24) fail('EPHEMERAL_CAPABILITY_LITERAL_DEPTH', 'literal JSON depth exceeds 24');
  if (bindingNode(value)) {
    state.bindings += 1;
    if (state.bindings > 64) fail('EPHEMERAL_CAPABILITY_BINDING_LIMIT', 'composite contains more than 64 binding nodes');
    return normalizeBinding(value, earlierStepIds);
  }
  if (Array.isArray(value)) return value.map((item) => normalizeTemplate(item, earlierStepIds, state, depth + 1));
  if (plainObject(value)) {
    const output = {};
    for (const [key, child] of Object.entries(value)) output[key] = normalizeTemplate(child, earlierStepIds, state, depth + 1);
    return output;
  }
  if (value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value))) return value;
  fail('EPHEMERAL_CAPABILITY_NON_JSON', 'composite templates must contain plain JSON values only');
}

function primitiveKindDenied(name) {
  return META_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function resolvePath(root, path, label) {
  let current = root;
  for (const segment of path) {
    if (typeof segment === 'string' && DANGEROUS_PATH_KEYS.has(segment)) fail('EPHEMERAL_CAPABILITY_BINDING_UNSAFE', `unsafe binding path segment: ${segment}`);
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) fail('EPHEMERAL_CAPABILITY_BINDING_MISSING', `missing binding path for ${label}`);
    current = current[segment];
  }
  return current;
}

function resolveTemplate(value, input, stepResults, depth = 0) {
  if (depth > 24) fail('EPHEMERAL_CAPABILITY_LITERAL_DEPTH', 'resolved JSON depth exceeds 24');
  if (bindingNode(value)) {
    const bind = value.$bind;
    const root = bind.from === 'input' ? input : stepResults.get(bind.stepId);
    if (root === undefined) fail('EPHEMERAL_CAPABILITY_BINDING_MISSING', `missing binding source: ${bind.stepId ?? 'input'}`);
    return cloneJson(resolvePath(root, bind.path, bind.stepId ?? 'input'), 'resolved binding');
  }
  if (Array.isArray(value)) return value.map((item) => resolveTemplate(item, input, stepResults, depth + 1));
  if (plainObject(value)) {
    const output = {};
    for (const [key, child] of Object.entries(value)) output[key] = resolveTemplate(child, input, stepResults, depth + 1);
    return output;
  }
  return value;
}

function signed(base) {
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export class EphemeralCapabilityRegistry {
  constructor({ runId, taskId, maxCapabilities = 16 } = {}) {
    this.runId = assertText(runId, 'runId', 256);
    this.taskId = assertText(taskId, 'taskId', 256);
    this.maxCapabilities = Math.max(1, Math.min(16, Math.floor(Number(maxCapabilities) || 16)));
    this.capabilities = new Map();
  }

  register(input = {}, { primitiveSchemas } = {}) {
    if (!(primitiveSchemas instanceof Map)) fail('EPHEMERAL_CAPABILITY_PRIMITIVES_REQUIRED', 'primitiveSchemas Map is required');
    if (this.capabilities.size >= this.maxCapabilities) fail('EPHEMERAL_CAPABILITY_CAPACITY', `ephemeral capability capacity reached: ${this.maxCapabilities}`);
    const name = assertText(input.name, 'capability name', 64);
    if (!NAME.test(name)) fail('EPHEMERAL_CAPABILITY_NAME', 'capability name contains unsupported characters');
    const generatedName = `ephemeral.${name}`;
    if (this.capabilities.has(generatedName) || primitiveSchemas.has(generatedName)) fail('EPHEMERAL_CAPABILITY_COLLISION', `capability name collision: ${generatedName}`);
    const description = assertText(input.description, 'description', 1_000);
    const parameters = cloneJson(input.parameters, 'parameters');
    assertSchema(parameters, { root: true });
    if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 8) fail('EPHEMERAL_CAPABILITY_STEP_LIMIT', 'composite must contain between 1 and 8 steps');

    const earlierStepIds = new Set();
    const state = { bindings: 0 };
    const steps = input.steps.map((raw) => {
      if (!plainObject(raw)) fail('EPHEMERAL_CAPABILITY_STEP_INVALID', 'each step must be an object');
      const id = assertText(raw.id, 'step id', 64);
      if (!STEP_ID.test(id)) fail('EPHEMERAL_CAPABILITY_STEP_ID', `invalid step id: ${id}`);
      if (earlierStepIds.has(id)) fail('EPHEMERAL_CAPABILITY_STEP_DUPLICATE', `duplicate step id: ${id}`);
      const tool = assertText(raw.tool, 'step tool', 128);
      if (primitiveKindDenied(tool)) fail('EPHEMERAL_CAPABILITY_PRIMITIVE_DENIED', `meta or composite tool cannot be a primitive: ${tool}`);
      if (!primitiveSchemas.has(tool)) fail('EPHEMERAL_CAPABILITY_PRIMITIVE_UNAUTHORIZED', `primitive tool is not authorized: ${tool}`);
      if (raw.args !== undefined && !plainObject(raw.args)) fail('EPHEMERAL_CAPABILITY_STEP_ARGS', `step ${id} args must be an object`);
      const args = normalizeTemplate(raw.args ?? {}, earlierStepIds, state);
      earlierStepIds.add(id);
      return { id, tool, args };
    });
    const output = normalizeTemplate(input.output, earlierStepIds, state);
    const definition = { name: generatedName, description, parameters, steps, output };
    const definitionBytes = Buffer.byteLength(canonicalStringify(definition), 'utf8');
    if (definitionBytes > 64 * 1024) fail('EPHEMERAL_CAPABILITY_SIZE_LIMIT', 'normalized definition exceeds 64 KiB');
    const schema = { type: 'function', function: { name: generatedName, description, parameters } };
    const primitiveTools = [...new Set(steps.map((step) => step.tool))];
    const authorizationSnapshotSha256 = canonicalSha256([...primitiveSchemas.keys()].sort());
    const base = { schema: 'forge.ephemeral-capability-definition.v1', runId: this.runId, taskId: this.taskId, name: generatedName, schemaSha256: canonicalSha256(schema), definitionSha256: canonicalSha256(definition), primitiveTools, authorizationSnapshotSha256 };
    const receipt = signed(base);
    const record = deepFreeze({ name: generatedName, schema: cloneJson(schema), definition: cloneJson(definition), receipt });
    deepFreeze(record.schema);
    deepFreeze(record.definition);
    this.capabilities.set(generatedName, record);
    return record;
  }

  get(name) { return this.capabilities.get(String(name)) ?? null; }

  async invoke(name, input = {}, { executePrimitive, isPrimitiveActive } = {}) {
    const record = this.get(name);
    if (!record) fail('EPHEMERAL_CAPABILITY_UNKNOWN', `unknown ephemeral capability: ${name}`);
    if (typeof executePrimitive !== 'function') fail('EPHEMERAL_CAPABILITY_EXECUTOR_REQUIRED', 'executePrimitive callback is required');
    if (typeof isPrimitiveActive !== 'function') fail('EPHEMERAL_CAPABILITY_AUTHORITY_REQUIRED', 'isPrimitiveActive callback is required');
    if (!plainObject(input)) fail('EPHEMERAL_CAPABILITY_INPUT_INVALID', 'composite input must be an object');
    const invocationInput = cloneJson(input, 'invocation input');
    validateInputValue(invocationInput, record.definition.parameters);
    const stepResults = new Map();
    const childReceipts = [];
    for (const step of record.definition.steps) {
      if (!isPrimitiveActive(step.tool)) fail('EPHEMERAL_CAPABILITY_PRIMITIVE_INACTIVE', `primitive tool is no longer active or authorized: ${step.tool}`);
      const args = resolveTemplate(step.args, invocationInput, stepResults);
      let result;
      try {
        result = await executePrimitive({ name: step.tool, args, parentCompositeId: record.name, childStepId: step.id });
      } catch (error) {
        error.ephemeralCapability = deepFreeze({ name: record.name, failedStepId: step.id, primitiveTool: step.tool, childReceipts: [...childReceipts], definitionReceiptSha256: record.receipt.receiptSha256 });
        throw error;
      }
      const receiptSha256 = String(result?.receipt?.receiptSha256 ?? '');
      if (!HASH.test(receiptSha256)) fail('EPHEMERAL_CAPABILITY_CHILD_RECEIPT', `child step ${step.id} returned an invalid receipt`);
      childReceipts.push(receiptSha256);
      if (result?.status !== 'pass') fail('EPHEMERAL_CAPABILITY_CHILD_FAILED', `child step ${step.id} failed with status ${String(result?.status)}`);
      const cloned = cloneJson(result, `child step ${step.id} result`);
      if (Buffer.byteLength(canonicalStringify(cloned), 'utf8') > 64 * 1024) fail('EPHEMERAL_CAPABILITY_CHILD_SIZE', `child step ${step.id} result exceeds 64 KiB`);
      stepResults.set(step.id, cloned);
    }
    const output = resolveTemplate(record.definition.output, invocationInput, stepResults);
    const safeOutput = cloneJson(output, 'composite output');
    const base = { schema: 'forge.ephemeral-capability-execution.v1', runId: this.runId, taskId: this.taskId, capability: record.name, definitionReceiptSha256: record.receipt.receiptSha256, requestSha256: canonicalSha256(invocationInput), childReceiptSha256: [...childReceipts], status: 'pass', outputSha256: canonicalSha256(safeOutput) };
    return deepFreeze({ status: 'pass', output: safeOutput, childReceipts: [...childReceipts], receipt: signed(base) });
  }

  snapshot() {
    const capabilities = [...this.capabilities.values()].map((record) => deepFreeze({ name: record.name, schemaSha256: record.receipt.schemaSha256, definitionReceiptSha256: record.receipt.receiptSha256 }));
    return deepFreeze({ schema: 'forge.ephemeral-capability-registry-snapshot.v1', runId: this.runId, taskId: this.taskId, count: capabilities.length, capabilities });
  }
}
