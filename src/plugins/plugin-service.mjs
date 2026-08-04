import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { deepFreeze } from '../config.mjs';
import path from 'node:path';

function required(value, label, max = 10_000) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); if (text.length > max) throw new TypeError(`${label} is too long`); return text; }
function slug(value) { return required(value, 'identifier', 256).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'plugin'; }

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
}

async function treeEntries(root, { maxFiles = 20_000, maxBytes = 500_000_000 } = {}) {
  const base = await realpath(root);
  const out = []; let bytes = 0;
  async function walk(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (out.length >= maxFiles) throw new Error('plugin file count exceeds limit');
      if (entry.isSymbolicLink()) throw new Error(`plugin contains symlink: ${path.join(prefix, entry.name)}`);
      const absolute = path.join(directory, entry.name); const relative = path.posix.join(prefix.split(path.sep).join('/'), entry.name);
      if (entry.isDirectory()) await walk(absolute, relative);
      else if (entry.isFile()) {
        const stat = await lstat(absolute); bytes += stat.size; if (bytes > maxBytes) throw new Error('plugin size exceeds limit');
        out.push({ absolute, relative, size: stat.size, mode: stat.mode });
      }
    }
  }
  await walk(base);
  return out;
}

async function hashTree(root) {
  const entries = await treeEntries(root);
  const hash = createHash('sha256');
  for (const entry of entries) { hash.update(entry.relative); hash.update('\0'); hash.update(await readFile(entry.absolute)); hash.update('\0'); }
  return { sha256: hash.digest('hex'), entries };
}

async function copyTree(root, destination, entries) {
  await mkdir(destination, { recursive: true });
  for (const entry of entries) {
    const target = path.join(destination, ...entry.relative.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(entry.absolute, target);
    try { await chmod(target, 0o444); } catch {}
  }
}

export class PluginService {
  constructor({ cacheRoot, scanner, sourceResolver = null, trustStore = null, trustMode = 'development', transparencyLog = null } = {}) {
    if (!scanner?.scanMarketplace || !scanner?.scanPlugin) throw new TypeError('plugin scanner is required');
    this.cacheRoot = path.resolve(required(cacheRoot, 'plugin cache root'));
    this.scanner = scanner;
    this.sourceResolver = sourceResolver;
    this.trustStore = trustStore;
    this.trustMode = String(trustMode);
    if (!['development', 'required'].includes(this.trustMode)) throw new TypeError('trustMode must be development or required');
    this.transparencyLog = transparencyLog;
    this.stateFile = path.join(this.cacheRoot, 'registry.json');
    this.state = { version: 1, marketplaces: [], plugins: [] };
    this.readyPromise = null;
  }

  async ready() {
    if (!this.readyPromise) this.readyPromise = (async () => {
      await mkdir(path.join(this.cacheRoot, 'objects'), { recursive: true });
      try {
        const parsed = JSON.parse(await readFile(this.stateFile, 'utf8'));
        if (parsed?.version === 1 && Array.isArray(parsed.marketplaces) && Array.isArray(parsed.plugins)) this.state = parsed;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return this;
    })();
    return this.readyPromise;
  }

  async #save() { await atomicJson(this.stateFile, this.state); }

  async addMarketplace({ source } = {}) {
    await this.ready();
    let sourceRoot = source;
    const raw = typeof source === 'string' ? source.trim() : source;
    const looksRemote = typeof raw === 'string' && (/^https:\/\//i.test(raw) || /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:@[^\s]+)?$/.test(raw));
    if (looksRemote || (raw && typeof raw === 'object' && !Array.isArray(raw))) {
      if (typeof this.sourceResolver !== 'function') throw new Error('remote marketplace source resolver is not configured');
      const spec = typeof raw === 'string' && /^https:\/\//i.test(raw) ? { source: 'git', url: raw.endsWith('.git') ? raw : `${raw}.git` } : raw;
      sourceRoot = await this.sourceResolver(spec, { kind: 'marketplace' });
    }
    const scanned = await this.scanner.scanMarketplace(sourceRoot);
    const sourceHash = createHash('sha256').update(scanned.root).digest('hex').slice(0, 12);
    const id = `${slug(scanned.name)}-${sourceHash}`;
    const record = { id, name: scanned.name, version: scanned.version, description: scanned.description, owner: scanned.owner, root: scanned.root, source: typeof source === 'string' ? source : structuredClone(source), immutable: looksRemote || (raw && typeof raw === 'object'), plugins: scanned.plugins.map((plugin) => structuredClone(plugin)), addedAt: new Date().toISOString() };
    const index = this.state.marketplaces.findIndex((item) => item.id === id);
    if (index >= 0) this.state.marketplaces[index] = record; else this.state.marketplaces.push(record);
    await this.#save();
    return Object.freeze(structuredClone(record));
  }

  listMarketplaces() { return this.state.marketplaces.map((item) => structuredClone(item)); }

  async install({ marketplaceId, pluginName } = {}) {
    await this.ready();
    const market = this.state.marketplaces.find((item) => item.id === required(marketplaceId, 'marketplace id'));
    if (!market) throw new Error(`Unknown marketplace: ${marketplaceId}`);
    const entry = market.plugins.find((item) => item.name === required(pluginName, 'plugin name'));
    if (!entry) throw new Error(`Unknown plugin ${pluginName} in marketplace ${marketplaceId}`);
    let sourceRoot;
    if (entry.source.kind === 'local') sourceRoot = entry.source.path;
    else {
      if (typeof this.sourceResolver !== 'function') throw new Error('remote plugin source resolver is not configured');
      sourceRoot = await this.sourceResolver(entry.source.spec, { marketplace: market, plugin: entry });
    }
    const scanned = await this.scanner.scanPlugin(sourceRoot);
    const tree = await hashTree(sourceRoot);
    const objectPath = path.join(this.cacheRoot, 'objects', tree.sha256);
    try { await lstat(objectPath); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const temp = `${objectPath}.tmp-${process.pid}-${Date.now()}`;
      try { await copyTree(sourceRoot, temp, tree.entries); await rename(temp, objectPath); }
      catch (copyError) { await rm(temp, { recursive: true, force: true }); throw copyError; }
    }
    let trust = { status: 'development-unsigned' };
    try {
      const bundle = JSON.parse(await readFile(path.join(sourceRoot, 'forge-plugin-signature.json'), 'utf8'));
      if (!this.trustStore) throw new Error('Plugin trust store is not configured');
      const verified = await this.trustStore.evaluateBundle({ bundle, directory: sourceRoot, pluginId: scanned.name });
      trust = { status: 'trusted', publisherId: verified.publisherId, keyId: verified.keyId, rootHash: verified.rootHash };
      this.transparencyLog?.append?.({ publisherId: verified.publisherId, keyId: verified.keyId, pluginId: scanned.name, rootHash: verified.rootHash });
    } catch (error) {
      if (error.code !== 'ENOENT' || this.trustMode === 'required') throw Object.assign(new Error(`Plugin signature verification failed: ${error.message}`), { statusCode: error.statusCode ?? 403, code: 'plugin-signature-rejected' });
    }
    const id = `${market.id}:${slug(scanned.name)}@${scanned.version}`;
    const existing = this.state.plugins.find((item) => item.id === id);
    const record = {
      id, marketplaceId: market.id, name: scanned.name, version: scanned.version, description: scanned.description,
      status: 'installed', contentSha256: tree.sha256, installPath: objectPath, capabilities: [...scanned.capabilities], risks: [...scanned.risks],
      hooks: structuredClone(scanned.hooks), commands: scanned.commands.map((item) => ({ name: item.name, relativePath: path.relative(sourceRoot, item.path) })),
      agents: scanned.agents.map((item) => ({ name: item.name, relativePath: path.relative(sourceRoot, item.path) })),
      skills: scanned.skills.map((item) => ({ name: item.name, description: item.description, relativePath: path.relative(sourceRoot, item.path) })),
      mcpServers: scanned.mcpServers.map((item) => ({ name: item.name, config: structuredClone(item.config) })), lspServers: (scanned.lspServers ?? []).map((item) => ({ name: item.name, config: structuredClone(item.config) })), trust, activeProjects: existing?.activeProjects ?? [], activations: existing?.activations ?? {}, installedAt: existing?.installedAt ?? new Date().toISOString(), immutable: true,
    };
    const index = this.state.plugins.findIndex((item) => item.id === id);
    if (index >= 0) this.state.plugins[index] = record; else this.state.plugins.push(record);
    await this.#save();
    return Object.freeze(structuredClone(record));
  }

  list() { return this.state.plugins.map((item) => structuredClone(item)); }

  async activate(pluginId, { projectId, requestedCapabilities = null, approvedServers = {}, allowHooks = false } = {}) {
    await this.ready();
    const index = this.state.plugins.findIndex((item) => item.id === required(pluginId, 'plugin id'));
    if (index < 0) throw new Error(`Unknown plugin: ${pluginId}`);
    const project = required(projectId, 'project id');
    const plugin = this.state.plugins[index];
    if (this.trustMode === 'required' && plugin.trust?.status !== 'trusted') throw Object.assign(new Error('Plugin activation requires a trusted signature'), { statusCode: 403, code: 'plugin-trust-required' });
    const requested = requestedCapabilities == null ? [...plugin.capabilities] : [...new Set(requestedCapabilities.map(String))];
    const granted = [];
    const denied = [];
    const grantedServers = { mcp: [], lsp: [] };
    for (const capability of requested) {
      if (!plugin.capabilities.includes(capability)) { denied.push(capability); continue; }
      if (capability === 'hooks') { denied.push(allowHooks ? 'hooks:quarantined' : 'hooks'); continue; }
      if (capability === 'mcp' || capability === 'lsp') {
        const available = new Set((capability === 'mcp' ? plugin.mcpServers : plugin.lspServers ?? []).map((server) => server.name));
        const approved = Array.isArray(approvedServers?.[capability]) ? [...new Set(approvedServers[capability].map(String))].filter((name) => available.has(name)) : [];
        if (!approved.length) { denied.push(`${capability}:review-required`); continue; }
        granted.push(capability); grantedServers[capability] = approved;
        continue;
      }
      granted.push(capability);
    }
    plugin.activeProjects = [...new Set([...plugin.activeProjects, project])];
    plugin.activations[project] = { grantedCapabilities: [...new Set(granted)], deniedCapabilities: [...new Set(denied)], grantedServers, activatedAt: new Date().toISOString() };
    await this.#save();
    return Object.freeze({ pluginId: plugin.id, projectId: project, ...structuredClone(plugin.activations[project]) });
  }

  async review(pluginId, { projectId = null } = {}) {
    await this.ready();
    const plugin = this.state.plugins.find((item) => item.id === required(pluginId, 'plugin id'));
    if (!plugin) throw new Error(`Unknown plugin: ${pluginId}`);
    const serverView = (server, kind) => Object.freeze({
      id: server.name,
      command: String(server.config?.command ?? ''),
      args: Object.freeze([...(server.config?.args ?? [])].map(String)),
      envNames: Object.freeze(Object.keys(server.config?.env ?? {}).sort()),
      extensions: Object.freeze(kind === 'lsp' ? Object.keys(server.config?.extensionToLanguage ?? {}).sort() : []),
      risks: Object.freeze(['external-process', ...(Object.keys(server.config?.env ?? {}).length ? ['environment-access'] : []), ...(kind === 'mcp' ? ['tool-provider'] : ['code-intelligence'])]),
    });
    return deepFreeze({
      pluginId: plugin.id, projectId: projectId == null ? null : String(projectId), name: plugin.name, version: plugin.version,
      contentSha256: plugin.contentSha256, risks: [...plugin.risks],
      capabilities: {
        mcp: { available: plugin.capabilities.includes('mcp'), requiredApproval: true, servers: (plugin.mcpServers ?? []).map((server) => serverView(server, 'mcp')) },
        lsp: { available: plugin.capabilities.includes('lsp'), requiredApproval: true, servers: (plugin.lspServers ?? []).map((server) => serverView(server, 'lsp')) },
        hooks: { available: plugin.capabilities.includes('hooks'), executable: true, quarantined: true },
      },
      activation: projectId == null ? null : structuredClone(plugin.activations?.[String(projectId)] ?? null),
    });
  }

  async runtimeCapabilitiesForProject(projectId) {
    await this.ready();
    const project = required(projectId, 'project id');
    const output = { mcp: [], lsp: [] };
    const replaceRoot = (value, root) => typeof value === 'string' ? value.replaceAll('${CLAUDE_PLUGIN_ROOT}', root) : value;
    for (const plugin of this.state.plugins.filter((item) => item.activeProjects.includes(project))) {
      const activation = plugin.activations?.[project];
      if (!activation) continue;
      for (const kind of ['mcp', 'lsp']) {
        if (!(activation.grantedCapabilities ?? []).includes(kind)) continue;
        const allowed = new Set(activation.grantedServers?.[kind] ?? []);
        const servers = kind === 'mcp' ? plugin.mcpServers ?? [] : plugin.lspServers ?? [];
        for (const server of servers) {
          if (!allowed.has(server.name)) continue;
          const root = await realpath(plugin.installPath);
          output[kind].push({
            pluginId: plugin.id, pluginName: plugin.name, name: server.name,
            command: replaceRoot(server.config.command, root), args: (server.config.args ?? []).map((arg) => replaceRoot(arg, root)),
            env: Object.fromEntries(Object.entries(server.config.env ?? {}).map(([key, value]) => [key, replaceRoot(value, root)])),
            cwd: root,
            ...(kind === 'lsp' ? { extensionToLanguage: structuredClone(server.config.extensionToLanguage ?? {}) } : {}),
          });
        }
      }
    }
    return deepFreeze(output);
  }

  async contextForProject(projectId, { maxItems = 32, maxChars = 64_000 } = {}) {
    await this.ready();
    const project = required(projectId, 'project id');
    const itemLimit = Math.max(1, Math.min(256, Number(maxItems) || 32));
    const charLimit = Math.max(1_000, Math.min(1_000_000, Number(maxChars) || 64_000));
    const items = []; const omissions = []; let usedChars = 0;
    const active = this.state.plugins.filter((plugin) => plugin.activeProjects.includes(project));
    for (const plugin of active) {
      const granted = new Set(plugin.activations?.[project]?.grantedCapabilities ?? []);
      const components = [
        ...(granted.has('skills') ? plugin.skills.map((item) => ({ ...item, kind: 'skill', file: path.join(item.relativePath, 'SKILL.md') })) : []),
        ...(granted.has('agents') ? plugin.agents.map((item) => ({ ...item, kind: 'agent', file: item.relativePath })) : []),
        ...(granted.has('commands') ? plugin.commands.map((item) => ({ ...item, kind: 'command', file: item.relativePath })) : []),
      ];
      for (const component of components) {
        if (items.length >= itemLimit) { omissions.push({ pluginId: plugin.id, name: component.name, reason: 'item-limit' }); continue; }
        const root = await realpath(plugin.installPath);
        const candidate = path.resolve(root, component.file);
        const relative = path.relative(root, candidate);
        if (relative.startsWith('..') || path.isAbsolute(relative)) { omissions.push({ pluginId: plugin.id, name: component.name, reason: 'path-escape' }); continue; }
        let text;
        try {
          const stat = await lstat(candidate);
          if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('not a regular file');
          text = await readFile(candidate, 'utf8');
        } catch (error) { omissions.push({ pluginId: plugin.id, name: component.name, reason: `unreadable:${String(error.message).slice(0, 120)}` }); continue; }
        const remaining = charLimit - usedChars;
        if (remaining <= 0) { omissions.push({ pluginId: plugin.id, name: component.name, reason: 'character-limit' }); continue; }
        const boundedText = text.slice(0, remaining);
        usedChars += boundedText.length;
        items.push({ pluginId: plugin.id, pluginName: plugin.name, pluginVersion: plugin.version, contentSha256: plugin.contentSha256, kind: component.kind, name: component.name, sourcePath: component.file.split(path.sep).join('/'), text: boundedText, truncated: boundedText.length < text.length, trust: 'community-plugin-untrusted' });
      }
    }
    return deepFreeze({ projectId: project, items, omissions, usedChars, maxChars: charLimit });
  }

  async deactivate(pluginId, { projectId } = {}) {
    await this.ready();
    const plugin = this.state.plugins.find((item) => item.id === required(pluginId, 'plugin id'));
    if (!plugin) throw new Error(`Unknown plugin: ${pluginId}`);
    const project = required(projectId, 'project id');
    plugin.activeProjects = plugin.activeProjects.filter((item) => item !== project);
    delete plugin.activations[project];
    await this.#save();
    return Object.freeze({ pluginId: plugin.id, projectId: project, active: false });
  }

  publicView() {
    return this.state.plugins.map((plugin) => Object.freeze({ id: plugin.id, marketplaceId: plugin.marketplaceId, name: plugin.name, version: plugin.version, description: plugin.description, status: plugin.status, contentSha256: plugin.contentSha256, capabilities: Object.freeze([...plugin.capabilities]), risks: Object.freeze([...plugin.risks]), hooks: Object.freeze({ defined: plugin.hooks?.defined === true, quarantined: plugin.hooks?.quarantined === true }), trust: Object.freeze({ ...(plugin.trust ?? { status: 'development-unsigned' }) }), activeProjects: Object.freeze([...plugin.activeProjects]), immutable: true }));
  }
}
