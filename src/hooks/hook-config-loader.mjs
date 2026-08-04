import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateHookDefinition } from './hook-schema.mjs';

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

export async function loadHookConfiguration({ projectRoot, files = [] }) {
  const root = path.resolve(projectRoot);
  const hooks = [];
  const ids = new Set();
  const sources = [];
  for (const file of files) {
    const resolved = path.resolve(file);
    let parsed;
    try {
      parsed = JSON.parse(await readFile(resolved, 'utf8'));
    } catch (error) {
      fail('HOOK_CONFIG_INVALID', `${resolved}: ${error.message}`);
    }
    if (parsed?.schema !== 'forge.hooks.v1' || !Array.isArray(parsed.hooks)) fail('HOOK_CONFIG_INVALID', `${resolved}: expected forge.hooks.v1`);
    for (const raw of parsed.hooks) {
      const entry = validateHookDefinition(raw, { projectRoot: root });
      if (ids.has(entry.id)) fail('HOOK_ID_DUPLICATE', `Duplicate hook id: ${entry.id}`);
      ids.add(entry.id);
      hooks.push(entry);
      sources.push(Object.freeze({ hookId: entry.id, file: resolved }));
    }
  }
  return Object.freeze({ schema: 'forge.hooks.config.v1', hooks: Object.freeze(hooks), sources: Object.freeze(sources) });
}
