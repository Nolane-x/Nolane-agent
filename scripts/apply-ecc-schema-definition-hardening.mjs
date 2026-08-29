import { readFile, writeFile } from 'node:fs/promises';

const target = 'src/agent/ephemeral-capability-registry.mjs';
let source = await readFile(target, 'utf8');

function replaceOne(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing patch marker: ${label}`);
  if (source.indexOf(before, first + 1) >= 0) throw new Error(`ambiguous patch marker: ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOne(
`function assertSchema(schema, { root = false, depth = 0 } = {}) {
  if (depth > 24) fail('EPHEMERAL_CAPABILITY_SCHEMA_DEPTH', 'parameter schema depth exceeds 24');
  if (!plainObject(schema)) fail('EPHEMERAL_CAPABILITY_SCHEMA_INVALID', 'parameter schema must be an object');
  for (const key of Object.keys(schema)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) fail('EPHEMERAL_CAPABILITY_SCHEMA_KEYWORD', \`unsupported parameter schema keyword: \${key}\`);
  }
  if (!ALLOWED_SCHEMA_TYPES.has(schema.type)) fail('EPHEMERAL_CAPABILITY_SCHEMA_TYPE', \`unsupported parameter schema type: \${schema.type}\`);
  if (root && schema.type !== 'object') fail('EPHEMERAL_CAPABILITY_SCHEMA_ROOT', 'root parameter schema type must be object');
  if (schema.type === 'object') {
    if (schema.additionalProperties !== false) fail('EPHEMERAL_CAPABILITY_SCHEMA_ADDITIONAL', 'object parameter schemas require additionalProperties:false');
    if (schema.properties !== undefined && !plainObject(schema.properties)) fail('EPHEMERAL_CAPABILITY_SCHEMA_PROPERTIES', 'properties must be an object');
    const properties = schema.properties ?? {};
    if (root && Object.keys(properties).length > 32) fail('EPHEMERAL_CAPABILITY_PARAMETER_LIMIT', 'composite input parameters exceed 32');
    for (const [name, child] of Object.entries(properties)) {
      if (!name || DANGEROUS_PATH_KEYS.has(name)) fail('EPHEMERAL_CAPABILITY_SCHEMA_PROPERTY', \`unsafe or empty parameter property name: \${name}\`);
      assertSchema(child, { depth: depth + 1 });
    }
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required) || schema.required.some((item) => typeof item !== 'string' || !Object.hasOwn(properties, item))) {
        fail('EPHEMERAL_CAPABILITY_SCHEMA_REQUIRED', 'required must contain only declared property names');
      }
    }
  } else {
    if (schema.additionalProperties !== undefined || schema.properties !== undefined || schema.required !== undefined) {
      fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', \`\${schema.type} schema cannot declare object-only keywords\`);
    }
  }
  if (schema.type === 'array') {
    if (!schema.items) fail('EPHEMERAL_CAPABILITY_SCHEMA_ITEMS', 'array parameter schema requires items');
    assertSchema(schema.items, { depth: depth + 1 });
  } else if (schema.items !== undefined) {
    fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', \`\${schema.type} schema cannot declare items\`);
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length === 0)) fail('EPHEMERAL_CAPABILITY_SCHEMA_ENUM', 'enum must be a non-empty array');
  return schema;
}`,
`function assertSchema(schema, { root = false, depth = 0 } = {}) {
  if (depth > 24) fail('EPHEMERAL_CAPABILITY_SCHEMA_DEPTH', 'parameter schema depth exceeds 24');
  if (!plainObject(schema)) fail('EPHEMERAL_CAPABILITY_SCHEMA_INVALID', 'parameter schema must be an object');
  for (const key of Object.keys(schema)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) fail('EPHEMERAL_CAPABILITY_SCHEMA_KEYWORD', \`unsupported parameter schema keyword: \${key}\`);
  }
  if (!ALLOWED_SCHEMA_TYPES.has(schema.type)) fail('EPHEMERAL_CAPABILITY_SCHEMA_TYPE', \`unsupported parameter schema type: \${schema.type}\`);
  if (root && schema.type !== 'object') fail('EPHEMERAL_CAPABILITY_SCHEMA_ROOT', 'root parameter schema type must be object');

  const numericKeys = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'];
  const stringKeys = ['minLength', 'maxLength'];
  const arrayKeys = ['minItems', 'maxItems'];
  const present = (keys) => keys.filter((key) => schema[key] !== undefined);
  const numericPresent = present(numericKeys);
  const stringPresent = present(stringKeys);
  const arrayPresent = present(arrayKeys);

  if (numericPresent.length && !['number', 'integer'].includes(schema.type)) fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', \`\${schema.type} schema cannot declare numeric constraints\`);
  if (stringPresent.length && schema.type !== 'string') fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', \`\${schema.type} schema cannot declare string-length constraints\`);
  if (arrayPresent.length && schema.type !== 'array') fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', \`\${schema.type} schema cannot declare array-length constraints\`);

  for (const key of numericPresent) {
    if (typeof schema[key] !== 'number' || !Number.isFinite(schema[key])) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', \`\${key} must be a finite number\`);
  }
  for (const key of [...stringPresent, ...arrayPresent]) {
    if (!Number.isSafeInteger(schema[key]) || schema[key] < 0) fail('EPHEMERAL_CAPABILITY_SCHEMA_CONSTRAINT', \`\${key} must be a non-negative safe integer\`);
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
      if (!name || DANGEROUS_PATH_KEYS.has(name)) fail('EPHEMERAL_CAPABILITY_SCHEMA_PROPERTY', \`unsafe or empty parameter property name: \${name}\`);
      assertSchema(child, { depth: depth + 1 });
    }
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required) || schema.required.some((item) => typeof item !== 'string' || !Object.hasOwn(properties, item)) || new Set(schema.required).size !== schema.required.length) {
        fail('EPHEMERAL_CAPABILITY_SCHEMA_REQUIRED', 'required must contain unique declared property names');
      }
    }
  } else if (schema.additionalProperties !== undefined || schema.properties !== undefined || schema.required !== undefined) {
    fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', \`\${schema.type} schema cannot declare object-only keywords\`);
  }

  if (schema.type === 'array') {
    if (!schema.items) fail('EPHEMERAL_CAPABILITY_SCHEMA_ITEMS', 'array parameter schema requires items');
    assertSchema(schema.items, { depth: depth + 1 });
  } else if (schema.items !== undefined) {
    fail('EPHEMERAL_CAPABILITY_SCHEMA_SHAPE', \`\${schema.type} schema cannot declare items\`);
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length === 0)) fail('EPHEMERAL_CAPABILITY_SCHEMA_ENUM', 'enum must be a non-empty array');
  return schema;
}`,
'assertSchema bounded constraint validation');

await writeFile(target, source);
console.log(JSON.stringify({ status: 'patched', target, bytes: Buffer.byteLength(source) }));
