function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function validateServer(input) {
  if (!input || typeof input !== 'object') fail('LANGUAGE_SERVER_SCHEMA', 'server definition must be an object');
  const id = String(input.id ?? '').trim();
  const command = String(input.command ?? '').trim();
  const languageIds = [...new Set((input.languageIds ?? []).map(String).filter(Boolean))];
  if (!id || !command || !languageIds.length) fail('LANGUAGE_SERVER_SCHEMA', 'id, command, and languageIds are required');
  const args = Array.isArray(input.args) ? input.args.map(String) : [];
  if (args.length > 64) fail('LANGUAGE_SERVER_SCHEMA', `${id}: too many arguments`);
  const timeoutMs = Math.max(100, Math.min(120_000, Number(input.timeoutMs) || 5_000));
  return Object.freeze({ id, command, args: Object.freeze(args), languageIds: Object.freeze(languageIds), cwd: input.cwd ? String(input.cwd) : null, env: Object.freeze({ ...(input.env ?? {}) }), timeoutMs });
}

export class LanguageServerRegistry {
  constructor({ servers = [] } = {}) {
    this.byLanguage = new Map();
    this.servers = [];
    for (const raw of servers) {
      const server = validateServer(raw);
      this.servers.push(server);
      for (const languageId of server.languageIds) {
        if (this.byLanguage.has(languageId)) fail('LANGUAGE_SERVER_DUPLICATE', `Language ${languageId} already has a server`);
        this.byLanguage.set(languageId, server);
      }
    }
  }

  resolve(languageId, workspaceRoot) {
    const server = this.byLanguage.get(String(languageId));
    if (!server) return null;
    const replace = (value) => value.replaceAll('${workspaceRoot}', String(workspaceRoot));
    return Object.freeze({
      id: server.id, command: replace(server.command), args: Object.freeze(server.args.map(replace)),
      cwd: server.cwd ? replace(server.cwd) : process.cwd(), env: Object.freeze(Object.fromEntries(Object.entries(server.env).map(([key, value]) => [key, replace(String(value))]))),
      timeoutMs: server.timeoutMs, shell: false,
    });
  }

  list() { return Object.freeze([...this.servers]); }
}
