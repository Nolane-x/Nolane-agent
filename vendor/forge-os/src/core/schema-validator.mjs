function pathJoin(path, key) {
  return typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`;
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validateNode(schema, value, path, errors) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => Object.is(candidate, value))) errors.push(`${path} must be one of ${schema.enum.map(JSON.stringify).join(', ')}`);
  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf.map((branch) => {
      const branchErrors = [];
      validateNode(branch, value, path, branchErrors);
      return branchErrors;
    });
    if (!branches.some((branch) => branch.length === 0)) errors.push(`${path} does not match any allowed schema`);
    return;
  }
  if (Array.isArray(schema.oneOf)) {
    const matching = schema.oneOf.filter((branch) => {
      const branchErrors = [];
      validateNode(branch, value, path, branchErrors);
      return branchErrors.length === 0;
    });
    if (matching.length !== 1) errors.push(`${path} must match exactly one allowed schema`);
    return;
  }
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((type) => typeMatches(value, type))) {
      errors.push(`${path} must be ${allowed.join(' or ')}`);
      return;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} must contain at least ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} must contain at most ${schema.maxLength} characters`);
    if (schema.pattern && !(new RegExp(schema.pattern, schema.patternFlags ?? '')).test(value)) errors.push(`${path} has an invalid format`);
    if (schema.format === 'uri') {
      try { new URL(value); } catch { errors.push(`${path} must be a valid URI`); }
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${path} must be a valid date-time`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be <= ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} must have at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} must have at most ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path} must contain unique items`);
    if (schema.items) value.forEach((item, index) => validateNode(schema.items, item, pathJoin(path, index), errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key} is required`);
    const properties = schema.properties ?? {};
    for (const [key, item] of Object.entries(value)) {
      if (properties[key]) validateNode(properties[key], item, pathJoin(path, key), errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key} is not allowed`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateNode(schema.additionalProperties, item, pathJoin(path, key), errors);
    }
  }
}

export class SchemaValidationError extends TypeError {
  constructor(errors, label = 'value') {
    super(`Invalid ${label}: ${errors.join('; ')}`);
    this.name = 'SchemaValidationError';
    this.code = 'invalid_schema_value';
    this.errors = errors;
  }
}

export function validateSchema(schema, value, { label = 'value', throwOnError = true } = {}) {
  const errors = [];
  validateNode(schema, value, '$', errors);
  if (errors.length && throwOnError) throw new SchemaValidationError(errors, label);
  return { valid: errors.length === 0, errors };
}
