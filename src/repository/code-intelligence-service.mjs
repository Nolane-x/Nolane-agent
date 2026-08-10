import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LspClient } from './lsp-client.mjs';
import { LspSessionPool } from './lsp-session-pool.mjs';

function range(value) {
  if (!value) return null;
  return Object.freeze({ start: Object.freeze({ line: Number(value.start?.line ?? 0) + 1, column: Number(value.start?.character ?? 0) + 1 }), end: Object.freeze({ line: Number(value.end?.line ?? 0) + 1, column: Number(value.end?.character ?? 0) + 1 }) });
}

function relativePath(uri, root) {
  const rootValue = String(root ?? '');
  try {
    const absolute = fileURLToPath(uri);
    const relative = path.relative(path.resolve(rootValue), absolute).replaceAll('\\', '/');
    return relative.startsWith('../') || path.isAbsolute(relative) ? absolute.replaceAll('\\', '/') : relative;
  } catch {
    try {
      const parsed = new URL(String(uri));
      if (parsed.protocol !== 'file:') return String(uri);
      const pathname = decodeURIComponent(parsed.pathname);
      const relative = path.posix.relative(path.posix.resolve(rootValue.replaceAll('\\', '/')), pathname);
      return relative.startsWith('../') || path.posix.isAbsolute(relative) ? pathname : relative;
    } catch { return String(uri); }
  }
}

function normalizeLocation(location, root) {
  if (!location) return null;
  const uri = location.uri ?? location.targetUri ?? '';
  const valueRange = location.range ?? location.targetSelectionRange ?? location.targetRange;
  return Object.freeze({ uri, path: relativePath(uri, root), range: range(valueRange) });
}

export class CodeIntelligenceService {
  static pooled(options = {}) { return new CodeIntelligenceService({ ...options, sessionPool: options.sessionPool ?? new LspSessionPool(options.poolOptions) }); }
  constructor({ registry, repositoryIndex = null, sessionPool = null, maxResults = 200 } = {}) {
    this.registry = registry;
    this.sessionPool = sessionPool;
    this.repositoryIndex = repositoryIndex;
    this.maxResults = Math.max(1, Math.min(2_000, Number(maxResults) || 200));
  }

  async #withClient(languageId, projectRoot, operation) {
    const definition = this.registry?.resolve(languageId, projectRoot);
    if (!definition) return null;
    if (this.sessionPool) {
      const lease = await this.sessionPool.acquire({ languageId, workspaceRoot: projectRoot, definition, rootUri: pathToFileURL(path.resolve(projectRoot)).href });
      try { return await operation(lease.client); } finally { lease.release(); }
    }
    const client = new LspClient(definition);
    try { await client.initialize({ rootUri: pathToFileURL(path.resolve(projectRoot)).href, capabilities: {} }); return await operation(client); }
    finally { await client.shutdown().catch(() => client.dispose()); }
  }

  async workspaceSymbols({ projectId, projectRoot, languageId, query = '', limit = this.maxResults } = {}) {
    const bounded = Math.max(1, Math.min(this.maxResults, Number(limit) || this.maxResults));
    const lsp = await this.#withClient(languageId, projectRoot, async (client) => (await client.workspaceSymbols(String(query))).slice(0, bounded));
    if (lsp) {
      const items = lsp.map((symbol) => {
        const location = normalizeLocation(symbol.location, projectRoot);
        return Object.freeze({ name: String(symbol.name ?? ''), kind: Number(symbol.kind ?? 0), containerName: String(symbol.containerName ?? ''), ...location });
      });
      return Object.freeze({ schema: 'forge.code-intelligence.v1', source: 'lsp', items: Object.freeze(items) });
    }
    const items = this.repositoryIndex?.symbols(projectId, { query, limit: bounded }) ?? [];
    return Object.freeze({ schema: 'forge.code-intelligence.v1', source: 'repository-index', items: Object.freeze(items) });
  }

  async definition({ projectRoot, languageId, uri, line, character } = {}) {
    const items = await this.#withClient(languageId, projectRoot, async (client) => (await client.definition({ uri, line, character })).slice(0, this.maxResults));
    return Object.freeze({ schema: 'forge.code-definition.v1', source: items ? 'lsp' : 'unavailable', items: Object.freeze((items ?? []).map((item) => normalizeLocation(item, projectRoot))) });
  }

  async references({ projectRoot, languageId, uri, line, character, includeDeclaration = true } = {}) {
    const items = await this.#withClient(languageId, projectRoot, async (client) => (await client.references({ uri, line, character, includeDeclaration })).slice(0, this.maxResults));
    return Object.freeze({ schema: 'forge.code-references.v1', source: items ? 'lsp' : 'unavailable', items: Object.freeze((items ?? []).map((item) => normalizeLocation(item, projectRoot))) });
  }

  async callHierarchy({ projectRoot, languageId, uri, line, character } = {}) {
    const result = await this.#withClient(languageId, projectRoot, (client) => client.callHierarchy({ uri, line, character }));
    return Object.freeze({ schema: 'forge.code-call-hierarchy.v1', source: result ? 'lsp' : 'unavailable', result: result ?? { items: [], incoming: [], outgoing: [] } });
  }
  async hover({ projectRoot, languageId, uri, line, character } = {}) {
    const result = await this.#withClient(languageId, projectRoot, (client) => client.hover({ uri, line, character }));
    return Object.freeze({ schema: 'forge.code-hover.v1', source: result ? 'lsp' : 'unavailable', result });
  }

  async rename({ projectRoot, languageId, uri, line, character, newName } = {}) {
    const result = await this.#withClient(languageId, projectRoot, (client) => client.rename({ uri, line, character, newName }));
    return Object.freeze({ schema: 'forge.code-rename.v1', source: result ? 'lsp' : 'unavailable', result });
  }

  async typeDefinition({ projectRoot, languageId, uri, line, character } = {}) {
    const result = await this.#withClient(languageId, projectRoot, (client) => client.typeDefinition({ uri, line, character }));
    return Object.freeze({ schema: 'forge.code-type-definition.v1', source: result ? 'lsp' : 'unavailable', items: Object.freeze((result ?? []).map((item) => normalizeLocation(item, projectRoot))) });
  }

  async diagnostics({ projectRoot, languageId, uri, text, version = 1 } = {}) {
    const result = await this.#withClient(languageId, projectRoot, async (client) => {
      await client.openDocument({ uri, languageId, text, version });
      const deadline = Date.now() + Math.max(100, client.timeoutMs);
      while (Date.now() < deadline) { const rows = client.diagnostics(uri); if (rows.length) return rows; await new Promise((resolve) => setTimeout(resolve, 5)); }
      return client.diagnostics(uri);
    });
    return Object.freeze({ schema: 'forge.code-diagnostics.v1', source: result ? 'lsp' : 'unavailable', items: Object.freeze(result ?? []) });
  }

  async close() { await this.sessionPool?.close?.(); }

}
