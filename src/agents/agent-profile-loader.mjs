import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    const body = value.slice(1, -1).trim();
    if (!body) return [];
    return body.split(',').map((entry) => entry.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  return value.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatter(content, file) {
  if (!content.startsWith('---\n')) fail('AGENT_PROFILE_FRONTMATTER', `${file}: missing frontmatter`);
  const end = content.indexOf('\n---\n', 4);
  if (end < 0) fail('AGENT_PROFILE_FRONTMATTER', `${file}: unterminated frontmatter`);
  const metadata = {};
  for (const [index, line] of content.slice(4, end).split('\n').entries()) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) fail('AGENT_PROFILE_FRONTMATTER', `${file}:${index + 2}: expected key: value`);
    const key = line.slice(0, colon).trim();
    if (Object.hasOwn(metadata, key)) fail('AGENT_PROFILE_FRONTMATTER', `${file}: duplicate key ${key}`);
    metadata[key] = parseScalar(line.slice(colon + 1));
  }
  return { metadata, prompt: content.slice(end + 5).trim() };
}

function stringList(value, field, max = 128) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('AGENT_PROFILE_SCHEMA', `${field} must be an array`);
  const result = [...new Set(value.map(String).map((entry) => entry.trim()).filter(Boolean))];
  if (result.length > max || result.some((entry) => entry.length > 128)) fail('AGENT_PROFILE_SCHEMA', `${field} exceeds limits`);
  return result;
}

export function validateAgentProfile(input, { source = '<memory>' } = {}) {
  const id = String(input.id ?? '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id)) fail('AGENT_PROFILE_ID', `${source}: invalid id`);
  const description = String(input.description ?? '').trim().slice(0, 500);
  if (!description) fail('AGENT_PROFILE_SCHEMA', `${source}: description is required`);
  const prompt = String(input.prompt ?? '').trim();
  if (Buffer.byteLength(prompt) > 64 * 1024) fail('AGENT_PROFILE_SCHEMA', `${source}: prompt exceeds 64 KiB`);
  const maxTurns = Number(input.maxTurns ?? 12);
  const budgetTokens = Number(input.budgetTokens ?? 20_000);
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 200) fail('AGENT_PROFILE_SCHEMA', `${source}: maxTurns is invalid`);
  if (!Number.isInteger(budgetTokens) || budgetTokens < 256 || budgetTokens > 2_000_000) fail('AGENT_PROFILE_SCHEMA', `${source}: budgetTokens is invalid`);
  const sandboxProfile = String(input.sandboxProfile ?? 'workspace');
  if (!['read-only', 'workspace', 'sandbox', 'cloud'].includes(sandboxProfile)) fail('AGENT_PROFILE_SCHEMA', `${source}: sandboxProfile is invalid`);
  return Object.freeze({
    schema: 'forge.agent-profile.v1', id, description, prompt,
    tools: Object.freeze(stringList(input.tools, 'tools')),
    exclusiveTools: Object.freeze(stringList(input.exclusiveTools, 'exclusiveTools')),
    mcpServers: Object.freeze(stringList(input.mcpServers, 'mcpServers')),
    skills: Object.freeze(stringList(input.skills, 'skills')),
    capabilities: Object.freeze(stringList(input.capabilities, 'capabilities')),
    maxTurns, budgetTokens, allowChildAgents: input.allowChildAgents === true, sandboxProfile, source,
  });
}

export class AgentProfileLoader {
  constructor({ maxFiles = 128, maxFileBytes = 64 * 1024 } = {}) {
    this.maxFiles = Math.max(1, Math.min(1024, maxFiles));
    this.maxFileBytes = Math.max(1024, Math.min(1024 * 1024, maxFileBytes));
  }

  async loadProjectProfiles(projectRoot) {
    const root = await realpath(projectRoot);
    const directory = path.join(root, '.forge', 'agents');
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) {
      if (error.code === 'ENOENT') return Object.freeze([]);
      throw error;
    }
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name));
    if (files.length > this.maxFiles) fail('AGENT_PROFILE_LIMIT', `Too many agent profiles: ${files.length}`);
    const profiles = [];
    const ids = new Set();
    for (const entry of files) {
      const file = path.join(directory, entry.name);
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink()) fail('AGENT_PROFILE_UNSAFE_FILE', `${file}: expected a regular file`);
      if (info.size > this.maxFileBytes) fail('AGENT_PROFILE_LIMIT', `${file}: exceeds ${this.maxFileBytes} bytes`);
      const parsed = parseFrontmatter(await readFile(file, 'utf8'), file);
      const profile = validateAgentProfile({ ...parsed.metadata, prompt: parsed.prompt }, { source: file });
      if (ids.has(profile.id)) fail('AGENT_PROFILE_DUPLICATE', `Duplicate agent profile id: ${profile.id}`);
      ids.add(profile.id);
      profiles.push(profile);
    }
    return Object.freeze(profiles);
  }
}
