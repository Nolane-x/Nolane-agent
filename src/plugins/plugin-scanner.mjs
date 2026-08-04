import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

function required(value, label, max = 10_000) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} is too long`);
  return text;
}

async function safeRoot(input, label) {
  const resolved = path.resolve(required(input, label));
  const stat = await lstat(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!stat.isDirectory()) throw new Error(`${label} must be a directory`);
  return realpath(resolved);
}

function inside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function readJson(file, maxBytes) {
  const stat = await lstat(file);
  if (stat.isSymbolicLink()) throw new Error(`manifest must not be a symlink: ${file}`);
  if (!stat.isFile()) throw new Error(`manifest is not a regular file: ${file}`);
  if (stat.size > maxBytes) throw new Error(`manifest exceeds ${maxBytes} bytes`);
  let value;
  try { value = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new Error(`invalid JSON manifest ${file}: ${error.message}`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`manifest must contain an object: ${file}`);
  return value;
}

async function listMarkdown(directory, maxFiles) {
  try {
    const root = await safeRoot(directory, 'plugin component directory');
    const entries = await readdir(root, { withFileTypes: true });
    const out = [];
    for (const entry of entries.slice(0, maxFiles)) {
      if (entry.isSymbolicLink()) throw new Error(`plugin component contains symlink: ${entry.name}`);
      if (entry.isFile() && /\.md$/i.test(entry.name)) out.push({ name: path.basename(entry.name, path.extname(entry.name)), path: path.join(root, entry.name) });
    }
    return out;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}


function safeString(value, label, max = 8192) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > max || /[\u0000-\u001f\u007f]/.test(text)) throw new Error(`${label} is invalid`);
  return text;
}

function normalizeServerConfig(name, config, kind) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`${kind} server ${name} config must be an object`);
  const command = safeString(config.command, `${kind} server ${name} command`, 4096);
  const args = config.args == null ? [] : config.args;
  if (!Array.isArray(args) || args.length > 256 || args.some((item) => typeof item !== 'string' || item.length > 8192 || /[\u0000\r\n]/.test(item))) throw new Error(`${kind} server ${name} args are invalid`);
  const env = config.env == null ? {} : config.env;
  if (!env || typeof env !== 'object' || Array.isArray(env) || Object.keys(env).length > 256) throw new Error(`${kind} server ${name} env is invalid`);
  for (const [key, value] of Object.entries(env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key) || typeof value !== 'string' || value.length > 16384 || value.includes('\u0000')) throw new Error(`${kind} server ${name} env is invalid`);
  }
  const normalized = { name, command, args: [...args], env: structuredClone(env) };
  if (kind === 'lsp') {
    const mapping = config.extensionToLanguage ?? {};
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) || Object.keys(mapping).length > 512) throw new Error(`lsp server ${name} extensionToLanguage is invalid`);
    for (const [extension, language] of Object.entries(mapping)) {
      if (!/^\.[A-Za-z0-9._+-]{1,32}$/.test(extension) || typeof language !== 'string' || !language.trim() || language.length > 128) throw new Error(`lsp server ${name} extension mapping is invalid`);
    }
    normalized.extensionToLanguage = structuredClone(mapping);
  }
  return normalized;
}

async function readServerFile(file, kind, maxManifestBytes) {
  try {
    const parsed = await readJson(file, maxManifestBytes);
    const raw = kind === 'mcp' && parsed.mcpServers && typeof parsed.mcpServers === 'object' ? parsed.mcpServers : parsed;
    return Object.entries(raw).map(([name, config]) => normalizeServerConfig(safeString(name, `${kind} server name`, 256), config, kind));
  } catch (error) {
    if (error.code === 'ENOENT' || /manifest is not/.test(error.message)) return [];
    throw error;
  }
}

async function listSkills(directory, maxFiles, maxManifestBytes) {
  try {
    const root = await safeRoot(directory, 'skills directory');
    const entries = await readdir(root, { withFileTypes: true });
    const out = [];
    for (const entry of entries.slice(0, maxFiles)) {
      if (entry.isSymbolicLink()) throw new Error(`skills directory contains symlink: ${entry.name}`);
      if (!entry.isDirectory()) continue;
      const skillRoot = path.join(root, entry.name);
      const manifest = path.join(skillRoot, 'SKILL.md');
      try {
        const stat = await lstat(manifest);
        if (stat.isSymbolicLink()) throw new Error(`skill manifest must not be a symlink: ${entry.name}`);
        if (!stat.isFile() || stat.size > maxManifestBytes) continue;
        const text = await readFile(manifest, 'utf8');
        const frontmatter = text.match(/^---\s*\n([\s\S]*?)\n---/);
        const name = frontmatter?.[1]?.match(/^name:\s*(.+)$/m)?.[1]?.trim() || entry.name;
        const description = frontmatter?.[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim() || '';
        out.push({ name, description, path: skillRoot, manifest });
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return out;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export class PluginScanner {
  constructor({ maxManifestBytes = 2_000_000, maxComponents = 2_000 } = {}) {
    this.maxManifestBytes = Math.max(1_024, Number(maxManifestBytes) || 2_000_000);
    this.maxComponents = Math.max(1, Number(maxComponents) || 2_000);
  }

  async scanMarketplace(input) {
    const root = await safeRoot(input, 'marketplace root');
    const manifestPath = path.join(root, '.claude-plugin', 'marketplace.json');
    const manifest = await readJson(manifestPath, this.maxManifestBytes);
    const name = required(manifest.name, 'marketplace name', 256);
    if (!Array.isArray(manifest.plugins)) throw new Error('marketplace plugins must be an array');
    const seen = new Set();
    const plugins = manifest.plugins.slice(0, this.maxComponents).map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`marketplace plugin ${index} is invalid`);
      const pluginName = required(entry.name, `marketplace plugin ${index} name`, 256);
      if (seen.has(pluginName)) throw new Error(`duplicate marketplace plugin: ${pluginName}`);
      seen.add(pluginName);
      let source;
      if (typeof entry.source === 'string') {
        const sourcePath = path.resolve(root, entry.source);
        if (!inside(root, sourcePath)) throw new Error(`plugin source escapes marketplace root: ${entry.source}`);
        source = Object.freeze({ kind: 'local', path: sourcePath });
      } else if (entry.source && typeof entry.source === 'object' && !Array.isArray(entry.source)) {
        source = Object.freeze({ kind: 'remote', spec: structuredClone(entry.source) });
      } else throw new Error(`plugin source is required: ${pluginName}`);
      return Object.freeze({ name: pluginName, version: String(entry.version ?? '0.0.0'), description: String(entry.description ?? ''), category: String(entry.category ?? ''), author: entry.author && typeof entry.author === 'object' ? structuredClone(entry.author) : null, source });
    });
    return Object.freeze({ name, version: String(manifest.version ?? '1.0.0'), description: String(manifest.description ?? ''), owner: manifest.owner && typeof manifest.owner === 'object' ? structuredClone(manifest.owner) : null, root, manifestPath, plugins: Object.freeze(plugins) });
  }

  async scanPlugin(input) {
    const root = await safeRoot(input, 'plugin root');
    let manifest = {};
    try { manifest = await readJson(path.join(root, '.claude-plugin', 'plugin.json'), this.maxManifestBytes); }
    catch (error) { if (error.code !== 'ENOENT' && !/manifest is not/.test(error.message)) throw error; }
    const name = required(manifest.name ?? path.basename(root), 'plugin name', 256);
    const commands = await listMarkdown(path.join(root, 'commands'), this.maxComponents);
    const agents = await listMarkdown(path.join(root, 'agents'), this.maxComponents);
    const skills = await listSkills(path.join(root, 'skills'), this.maxComponents, this.maxManifestBytes);
    const mcpServers = (await readServerFile(path.join(root, '.mcp.json'), 'mcp', this.maxManifestBytes)).slice(0, this.maxComponents);
    const lspServers = (await readServerFile(path.join(root, '.lsp.json'), 'lsp', this.maxManifestBytes)).slice(0, this.maxComponents);
    const hooksDefined = Boolean(manifest.hooks && typeof manifest.hooks === 'object' && Object.keys(manifest.hooks).length);
    const capabilities = [];
    if (commands.length) capabilities.push('commands');
    if (agents.length) capabilities.push('agents');
    if (skills.length) capabilities.push('skills');
    if (mcpServers.length) capabilities.push('mcp');
    if (lspServers.length) capabilities.push('lsp');
    if (hooksDefined) capabilities.push('hooks');
    const risks = [];
    if (hooksDefined) risks.push('executable-hooks');
    if (mcpServers.length) risks.push('mcp-external-processes');
    if (lspServers.length) risks.push('lsp-external-processes');
    if ([...mcpServers, ...lspServers].some((server) => Object.keys(server.env ?? {}).length)) risks.push('environment-access');
    return Object.freeze({
      name,
      version: String(manifest.version ?? '0.0.0'),
      description: String(manifest.description ?? ''),
      root,
      capabilities: Object.freeze(capabilities),
      risks: Object.freeze(risks),
      commands: Object.freeze(commands),
      agents: Object.freeze(agents),
      skills: Object.freeze(skills),
      mcpServers: Object.freeze(mcpServers.map((server) => Object.freeze({ name: server.name, config: Object.freeze({ command: server.command, args: Object.freeze([...server.args]), env: Object.freeze(structuredClone(server.env)) }) }))),
      lspServers: Object.freeze(lspServers.map((server) => Object.freeze({ name: server.name, config: Object.freeze({ command: server.command, args: Object.freeze([...server.args]), env: Object.freeze(structuredClone(server.env)), extensionToLanguage: Object.freeze(structuredClone(server.extensionToLanguage ?? {})) }) }))),
      hooks: Object.freeze({ defined: hooksDefined, quarantined: hooksDefined, manifest: hooksDefined ? structuredClone(manifest.hooks) : null }),
      manifest: Object.freeze({ name, version: String(manifest.version ?? '0.0.0'), description: String(manifest.description ?? '') }),
    });
  }
}
