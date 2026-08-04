function sanitizeString(value) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { output += value[index] + value[index + 1]; index += 1; }
      else output += '\uFFFD';
    } else if (code >= 0xdc00 && code <= 0xdfff) output += '\uFFFD';
    else output += value[index];
  }
  return output;
}

function sanitizeValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) throw new TypeError('Messages must not contain circular structures');
  seen.add(value);
  const result = {};
  for (const [key, child] of Object.entries(value)) result[sanitizeString(key)] = sanitizeValue(child, seen);
  seen.delete(value);
  return result;
}

export function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) throw new TypeError('messages must be an array');
  return messages.map((message) => sanitizeValue(message));
}

export function repairToolArguments(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return structuredClone(value);
  let text = String(value ?? '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const attempts = [
    text,
    text.replace(/,\s*([}\]])/g, '$1'),
    text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, content) => JSON.stringify(content.replace(/\\'/g, "'"))).replace(/,\s*([}\]])/g, '$1'),
  ];
  let last;
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Tool arguments must be a JSON object');
      return parsed;
    } catch (error) { last = error; }
  }
  throw new SyntaxError(`Invalid tool arguments JSON: ${last?.message ?? 'unknown error'}`);
}
