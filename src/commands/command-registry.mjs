function tokenize(input) {
  const text = String(input ?? '').trim();
  if (!text.startsWith('/')) throw new TypeError('command must start with /');
  const tokens = [];
  let current = '';
  let quote = null;
  let escaping = false;
  for (let index = 1; index < text.length; index += 1) {
    const char = text[index];
    if (escaping) { current += char; escaping = false; continue; }
    if (char === '\\') { escaping = true; continue; }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (/\s/.test(char)) {
      if (current) { tokens.push(current); current = ''; }
      continue;
    }
    current += char;
  }
  if (escaping) current += '\\';
  if (quote) throw new TypeError('unterminated command quote');
  if (current) tokens.push(current);
  if (!tokens.length) throw new TypeError('command name is required');
  return tokens;
}

function assignFlag(target, key, value) {
  if (target[key] === undefined) target[key] = value;
  else if (Array.isArray(target[key])) target[key].push(value);
  else target[key] = [target[key], value];
}

function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return rows[a.length][b.length];
}

export class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
  }

  register({ name, aliases = [], description = '', usage = '', execute } = {}) {
    const clean = String(name ?? '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(clean)) throw new TypeError('command name is invalid');
    if (typeof execute !== 'function') throw new TypeError(`command /${clean} execute function is required`);
    if (this.commands.has(clean) || this.aliases.has(clean)) throw new Error(`duplicate command: ${clean}`);
    const descriptor = Object.freeze({ name: clean, aliases: Object.freeze([...new Set(aliases.map((item) => String(item).trim().toLowerCase()).filter(Boolean))]), description: String(description ?? ''), usage: String(usage ?? ''), execute });
    this.commands.set(clean, descriptor);
    for (const alias of descriptor.aliases) {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(alias) || this.commands.has(alias) || this.aliases.has(alias)) throw new Error(`duplicate or invalid command alias: ${alias}`);
      this.aliases.set(alias, clean);
    }
    return descriptor;
  }

  parse(input) {
    const tokens = tokenize(input);
    const requested = tokens.shift().toLowerCase();
    const name = this.aliases.get(requested) ?? requested;
    const args = [];
    const flags = {};
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (!token.startsWith('--') || token === '--') { args.push(token); continue; }
      const body = token.slice(2);
      const equals = body.indexOf('=');
      let key; let value;
      if (equals >= 0) { key = body.slice(0, equals); value = body.slice(equals + 1); }
      else {
        key = body;
        const next = tokens[index + 1];
        if (next !== undefined && !next.startsWith('--')) { value = next; index += 1; }
        else value = true;
      }
      if (!/^[a-z][a-z0-9-]{0,63}$/i.test(key)) throw new TypeError(`invalid flag: --${key}`);
      assignFlag(flags, key, value);
    }
    return Object.freeze({ raw: String(input), requestedName: requested, name, args: Object.freeze(args), flags: Object.freeze(flags) });
  }

  async execute(input, context = {}) {
    const parsed = typeof input === 'string' ? this.parse(input) : input;
    const command = this.commands.get(parsed.name);
    if (!command) {
      const suggestion = this.#suggest(parsed.requestedName ?? parsed.name);
      throw new Error(`Unknown command /${parsed.requestedName ?? parsed.name}.${suggestion ? ` Did you mean /${suggestion}?` : ''}`);
    }
    const value = await command.execute({ ...parsed, context });
    return Object.freeze({ ok: true, command: command.name, value: structuredClone(value ?? null) });
  }

  list() { return [...this.commands.values()].map(({ execute, ...item }) => item).sort((a, b) => a.name.localeCompare(b.name)); }
  help(name = null) {
    if (!name) return this.list();
    const clean = this.aliases.get(String(name).toLowerCase()) ?? String(name).toLowerCase();
    const command = this.commands.get(clean);
    if (!command) return null;
    const { execute, ...view } = command;
    return view;
  }

  #suggest(name) {
    let best = null;
    for (const candidate of this.commands.keys()) {
      const score = distance(String(name), candidate);
      if (!best || score < best.score) best = { candidate, score };
    }
    return best && best.score <= Math.max(2, Math.floor(String(name).length / 2)) ? best.candidate : null;
  }
}
