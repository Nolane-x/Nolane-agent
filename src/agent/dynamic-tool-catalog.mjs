function clone(value) { return structuredClone(value); }

function normalizeSchema(schema) {
  if (!schema || schema.type !== 'function' || !schema.function || typeof schema.function !== 'object') throw new TypeError('tool schema must be an OpenAI function schema');
  const name = String(schema.function.name ?? '');
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(name)) throw new TypeError('tool schema function name is invalid');
  if (typeof schema.function.description !== 'string' || schema.function.description.trim().length === 0) throw new TypeError(`tool ${name} requires a description`);
  const parameters = schema.function.parameters;
  if (!parameters || parameters.type !== 'object' || typeof parameters.properties !== 'object') throw new TypeError(`tool ${name} requires object parameters`);
  return Object.freeze(clone(schema));
}

function terms(query) {
  return String(query ?? '').toLocaleLowerCase('en-US').split(/[^a-z0-9_.:-]+/).filter(Boolean);
}

export class DynamicToolCatalog {
  constructor({ pinnedTools = [], summaryDescriptionChars = 160 } = {}) {
    this.pinned = new Set(pinnedTools.map(String));
    this.summaryDescriptionChars = Math.max(40, Math.min(500, Number(summaryDescriptionChars) || 160));
    this.entries = new Map();
  }

  register(schema, { source = 'core', tags = [], capability = null } = {}) {
    const normalized = normalizeSchema(schema);
    const name = normalized.function.name;
    const entry = Object.freeze({
      name,
      schema: normalized,
      source: String(source),
      tags: Object.freeze([...new Set(tags.map((item) => String(item).toLocaleLowerCase('en-US')).filter(Boolean))].sort()),
      capability: capability === null ? null : String(capability),
    });
    this.entries.set(name, entry);
    return this.summary(name);
  }

  baseSchemas() {
    return [...this.entries.values()]
      .filter((entry) => this.pinned.has(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => clone(entry.schema));
  }

  summaries() {
    return [...this.entries.keys()].sort().map((name) => this.summary(name));
  }

  summary(name) {
    const entry = this.entries.get(String(name));
    if (!entry) throw new Error(`Unknown tool: ${name}`);
    const description = entry.schema.function.description;
    return Object.freeze({
      name: entry.name,
      source: entry.source,
      tags: [...entry.tags],
      capability: entry.capability,
      description: description.length <= this.summaryDescriptionChars ? description : `${description.slice(0, this.summaryDescriptionChars - 1)}…`,
      pinned: this.pinned.has(entry.name),
      hasFullSchema: false,
    });
  }

  loadSchema(name) {
    const entry = this.entries.get(String(name));
    if (!entry) throw new Error(`Unknown tool: ${name}`);
    return clone(entry.schema);
  }

  search(query, { limit = 20 } = {}) {
    const requested = terms(query);
    if (requested.length === 0) return [];
    const scored = [];
    for (const entry of this.entries.values()) {
      const name = entry.name.toLocaleLowerCase('en-US');
      const source = entry.source.toLocaleLowerCase('en-US');
      const description = entry.schema.function.description.toLocaleLowerCase('en-US');
      let score = 0;
      let matched = true;
      for (const term of requested) {
        let termScore = 0;
        if (name === term) termScore = 20;
        else if (name.includes(term)) termScore = 12;
        else if (entry.tags.some((tag) => tag === term)) termScore = 10;
        else if (entry.tags.some((tag) => tag.includes(term))) termScore = 7;
        else if (source.includes(term)) termScore = 5;
        else if (description.includes(term)) termScore = 3;
        if (termScore === 0) { matched = false; break; }
        score += termScore;
      }
      if (matched) scored.push({ score, entry });
    }
    return scored.sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name)).slice(0, Math.max(1, Math.min(100, Number(limit) || 20))).map(({ entry }) => this.summary(entry.name));
  }
}
