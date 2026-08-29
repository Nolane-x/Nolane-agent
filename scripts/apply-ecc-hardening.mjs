import { readFile, writeFile } from 'node:fs/promises';

function replaceOne(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing patch marker: ${label}`);
  if (source.indexOf(before, first + 1) >= 0) throw new Error(`ambiguous patch marker: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const registryPath = 'src/agent/ephemeral-capability-registry.mjs';
let registry = await readFile(registryPath, 'utf8');

registry = replaceOne(registry,
`    for (const [name, child] of Object.entries(properties)) {
      if (!name) fail('EPHEMERAL_CAPABILITY_SCHEMA_PROPERTY', 'property name must be non-empty');
      assertSchema(child, { depth: depth + 1 });
    }`,
`    for (const [name, child] of Object.entries(properties)) {
      if (!name || DANGEROUS_PATH_KEYS.has(name)) fail('EPHEMERAL_CAPABILITY_SCHEMA_PROPERTY', \`unsafe or empty parameter property name: \${name}\`);
      assertSchema(child, { depth: depth + 1 });
    }`,
'schema property hardening');

registry = replaceOne(registry,
`function bindingNode(value) {
  return plainObject(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$bind');
}`,
`function schemaValueEqual(left, right) {
  try { return canonicalStringify(left) === canonicalStringify(right); }
  catch { return false; }
}

function inputSchemaFailure(path, message) {
  fail('EPHEMERAL_CAPABILITY_INPUT_SCHEMA', \`invalid composite input at \${path}: \${message}\`);
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
  if (!typeValid) inputSchemaFailure(path, \`expected \${type}\`);

  if (schema.const !== undefined && !schemaValueEqual(value, schema.const)) inputSchemaFailure(path, 'const constraint failed');
  if (schema.enum !== undefined && !schema.enum.some((candidate) => schemaValueEqual(value, candidate))) inputSchemaFailure(path, 'enum constraint failed');

  if (type === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) inputSchemaFailure(path, \`minLength \${schema.minLength} not met\`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) inputSchemaFailure(path, \`maxLength \${schema.maxLength} exceeded\`);
  }
  if (type === 'number' || type === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) inputSchemaFailure(path, \`minimum \${schema.minimum} not met\`);
    if (schema.maximum !== undefined && value > schema.maximum) inputSchemaFailure(path, \`maximum \${schema.maximum} exceeded\`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) inputSchemaFailure(path, \`exclusiveMinimum \${schema.exclusiveMinimum} not met\`);
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) inputSchemaFailure(path, \`exclusiveMaximum \${schema.exclusiveMaximum} exceeded\`);
  }
  if (type === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) inputSchemaFailure(path, \`minItems \${schema.minItems} not met\`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) inputSchemaFailure(path, \`maxItems \${schema.maxItems} exceeded\`);
    for (let index = 0; index < value.length; index += 1) validateInputValue(value[index], schema.items, \`\${path}[\${index}]\`, depth + 1);
  }
  if (type === 'object') {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) inputSchemaFailure(path, \`missing required property \${required}\`);
    for (const key of Object.keys(value)) {
      if (DANGEROUS_PATH_KEYS.has(key)) inputSchemaFailure(path, \`unsafe property \${key}\`);
      if (!Object.hasOwn(properties, key)) inputSchemaFailure(path, \`additional property \${key} is not allowed\`);
      validateInputValue(value[key], properties[key], \`\${path}.\${key}\`, depth + 1);
    }
  }
  return true;
}

function bindingNode(value) {
  return plainObject(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$bind');
}`,
'runtime schema validator');

registry = replaceOne(registry,
`      if (!primitiveSchemas.has(tool)) fail('EPHEMERAL_CAPABILITY_PRIMITIVE_UNAUTHORIZED', \`primitive tool is not authorized: \${tool}\`);
      const args = normalizeTemplate(raw.args ?? {}, earlierStepIds, state);`,
`      if (!primitiveSchemas.has(tool)) fail('EPHEMERAL_CAPABILITY_PRIMITIVE_UNAUTHORIZED', \`primitive tool is not authorized: \${tool}\`);
      if (raw.args !== undefined && !plainObject(raw.args)) fail('EPHEMERAL_CAPABILITY_STEP_ARGS', \`step \${id} args must be an object\`);
      const args = normalizeTemplate(raw.args ?? {}, earlierStepIds, state);`,
'step args validation');

registry = replaceOne(registry,
`    if (!plainObject(input)) fail('EPHEMERAL_CAPABILITY_INPUT_INVALID', 'composite input must be an object');
    const invocationInput = cloneJson(input, 'invocation input');
    const stepResults = new Map();`,
`    if (!plainObject(input)) fail('EPHEMERAL_CAPABILITY_INPUT_INVALID', 'composite input must be an object');
    const invocationInput = cloneJson(input, 'invocation input');
    validateInputValue(invocationInput, record.definition.parameters);
    const stepResults = new Map();`,
'invocation schema enforcement');

await writeFile(registryPath, registry);

const loopPath = 'src/agent/agent-loop.mjs';
let loop = await readFile(loopPath, 'utf8');
loop = replaceOne(loop,
`    let primitiveToolSchemas = new Map(baseTools.map((schema) => [schema.function.name, schema]));
    let catalogAuthorizedToolSchemas = new Map(primitiveToolSchemas);
    let authorizedToolSchemas = new Map(primitiveToolSchemas);`,
`    let primitiveToolSchemas = new Map(baseTools.map((schema) => [schema.function.name, schema]));
    let catalogAuthorizedToolSchemas = new Map(primitiveToolSchemas);`,
'remove dead authorized declaration');
loop = replaceOne(loop,
`      primitiveToolSchemas = new Map(activeTools.map((schema) => [schema.function.name, schema]));
      catalogAuthorizedToolSchemas = new Map(primitiveToolSchemas);
      authorizedToolSchemas = new Map(primitiveToolSchemas);`,
`      primitiveToolSchemas = new Map(activeTools.map((schema) => [schema.function.name, schema]));
      catalogAuthorizedToolSchemas = new Map(primitiveToolSchemas);`,
'remove dead authorized reset');
loop = replaceOne(loop,
`      for (const schema of activeTools) authorizedToolSchemas.set(schema.function.name, schema);
      const sessionStartHook = await runHook('SessionStart', {`,
`      const sessionStartHook = await runHook('SessionStart', {`,
'remove dead active set');
loop = replaceOne(loop,
`          if (!activeTools.some((item) => item.function.name === registered.name)) activeTools = Object.freeze([...activeTools, registered.schema]);
          authorizedToolSchemas.set(registered.name, registered.schema);
          const capabilityOutput = Object.freeze({`,
`          if (!activeTools.some((item) => item.function.name === registered.name)) activeTools = Object.freeze([...activeTools, registered.schema]);
          const capabilityOutput = Object.freeze({`,
'remove dead capability set');
await writeFile(loopPath, loop);

console.log(JSON.stringify({ status: 'patched', registryBytes: Buffer.byteLength(registry), agentLoopBytes: Buffer.byteLength(loop) }));
