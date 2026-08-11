import { readdir, readFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const inside = (root, candidate) => { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

async function regularFile(file) {
  try {
    const info = await lstat(file);
    return info.isFile() && !info.isSymbolicLink();
  } catch {
    return false;
  }
}

function frontmatterValue(value, field) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === '|' || trimmed === '>' || trimmed.startsWith('|') || trimmed.startsWith('>')) throw new Error(`invalid SKILL.md ${field} frontmatter`);
  const quote = trimmed[0];
  if (quote === '"' || quote === "'") {
    if (trimmed.length < 2 || trimmed.at(-1) !== quote) throw new Error(`invalid SKILL.md ${field} frontmatter`);
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseSkillFrontmatter(content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('SKILL.md requires YAML frontmatter');
  const fields = Object.create(null);
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^(name|description):[\t ]*(.*)$/);
    if (!field) continue;
    if (fields[field[1]] !== undefined) throw new Error(`duplicate SKILL.md ${field[1]} frontmatter`);
    fields[field[1]] = frontmatterValue(field[2], field[1]);
  }
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(fields.name ?? '')) throw new Error('invalid SKILL.md name frontmatter');
  if (!fields.description) throw new Error('SKILL.md description frontmatter is required');
  return Object.freeze({ name: fields.name, description: fields.description });
}

async function readProvenanceSidecar(directory) {
  const sidecarPath = path.join(directory, 'nolane-skill.json');
  let info;
  try { info = await lstat(sidecarPath); } catch (error) {
    if (error?.code === 'ENOENT') return Object.freeze({ sourceUrl: null, license: null, capabilities: null });
    throw error;
  }
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('skill provenance sidecar must be a regular file');
  let sidecar;
  try { sidecar = JSON.parse(await readFile(sidecarPath, 'utf8')); } catch { throw new Error('invalid skill provenance sidecar'); }
  if (sidecar?.schema !== 'nolane.agent.skill-provenance.v1') throw new Error('invalid skill provenance schema');
  if (sidecar.sourceUrl != null && (typeof sidecar.sourceUrl !== 'string' || !/^https:\/\/[^\s]+$/i.test(sidecar.sourceUrl))) throw new Error('invalid skill provenance sourceUrl');
  if (sidecar.license != null && (typeof sidecar.license !== 'string' || !sidecar.license.trim() || sidecar.license.length > 200)) throw new Error('invalid skill provenance license');
  if (sidecar.capabilities != null && (!Array.isArray(sidecar.capabilities) || sidecar.capabilities.some((capability) => typeof capability !== 'string' || !capability.trim()))) throw new Error('invalid skill provenance capabilities');
  return Object.freeze({
    sourceUrl: sidecar.sourceUrl?.trim() || null,
    license: sidecar.license?.trim() || null,
    capabilities: sidecar.capabilities == null ? null : Object.freeze([...new Set(sidecar.capabilities.map((capability) => capability.trim()))].sort()),
  });
}

export class NolaneSkillRegistry {
  constructor({ roots = [] } = {}) {
    this.roots = roots.map((root) => path.resolve(root));
    this.skills = new Map();
    this.certifications = new Map();
  }

  async discover() {
    const discovered = new Map();
    for (const configuredRoot of this.roots) {
      let root;
      try { root = await realpath(configuredRoot); } catch { continue; }
      const entries = await readdir(root, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        const directory = path.join(root, entry.name);
        const manifestPath = path.join(directory, 'skill.json');
        let manifest;
        let entrypoint;
        let standard = false;
        const provenance = await readProvenanceSidecar(directory);
        if (await regularFile(manifestPath)) {
          try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { continue; }
          this.#validateManifest(manifest);
          entrypoint = path.resolve(directory, manifest.entrypoint);
          if (!inside(directory, entrypoint)) throw new Error(`skill entrypoint escapes skill directory: ${manifest.id}`);
        } else {
          entrypoint = path.join(directory, 'SKILL.md');
          if (!await regularFile(entrypoint)) continue;
          const frontmatter = parseSkillFrontmatter(await readFile(entrypoint, 'utf8'));
          manifest = { id: frontmatter.name, title: frontmatter.name, description: frontmatter.description, entrypoint: 'SKILL.md', capabilities: [] };
          standard = true;
        }
        const capabilities = provenance.capabilities ?? manifest.capabilities;
        if (!standard && provenance.capabilities && JSON.stringify(capabilities) !== JSON.stringify([...manifest.capabilities].sort())) throw new Error(`skill provenance capabilities conflict with manifest: ${manifest.id}`);
        manifest = Object.freeze({ ...manifest, capabilities, sourceUrl: provenance.sourceUrl, license: provenance.license, provenanceStatus: 'local-user-supplied' });
        if (discovered.has(manifest.id)) throw new Error(`duplicate skill id: ${manifest.id}`);
        if (!await regularFile(entrypoint)) throw new Error(`skill entrypoint must be a regular file: ${manifest.id}`);
        const contentSha256 = sha256(await readFile(entrypoint));
        discovered.set(manifest.id, Object.freeze({
          id: manifest.id,
          sourceId: manifest.id,
          source: 'nolane',
          catalog: 'local',
          title: standard ? manifest.id.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) : manifest.title,
          description: manifest.description ?? null,
          capabilities: Object.freeze([...manifest.capabilities].sort()),
          sourceUrl: manifest.sourceUrl,
          license: manifest.license,
          provenanceStatus: manifest.provenanceStatus,
          directory,
          entrypoint,
          manifestSha256: sha256(JSON.stringify(manifest)),
          contentSha256,
          contentLoaded: false
        }));
      }
    }
    this.skills = discovered;
    return [...discovered.values()].map(({ directory, entrypoint, ...view }) => Object.freeze({ ...view }));
  }

  async load(id, { grantedCapabilities = [] } = {}) {
    if (this.skills.size === 0) await this.discover();
    const skill = this.skills.get(id);
    if (!skill) throw new Error(`unknown skill: ${id}`);
    const granted = new Set(grantedCapabilities);
    const missing = skill.capabilities.filter((capability) => !granted.has(capability));
    if (missing.length) throw new Error(`missing capability for skill ${id}: ${missing.join(', ')}`);
    const bytes = await readFile(skill.entrypoint);
    if (sha256(bytes) !== skill.contentSha256) throw new Error(`skill content changed after discovery: ${id}`);
    const receiptBase = { schema: 'nolane.agent.skill-load.v1', id, source: skill.source, catalog: skill.catalog, provenanceStatus: skill.provenanceStatus, sourceUrl: skill.sourceUrl, license: skill.license, manifestSha256: skill.manifestSha256, contentSha256: skill.contentSha256, capabilities: skill.capabilities };
    return Object.freeze({ id, sourceId: skill.sourceId, source: skill.source, catalog: skill.catalog, title: skill.title, description: skill.description, capabilities: skill.capabilities, sourceUrl: skill.sourceUrl, license: skill.license, provenanceStatus: skill.provenanceStatus, content: bytes.toString('utf8'), contentLoaded: true, receiptSha256: sha256(JSON.stringify(receiptBase)) });
  }


  async certify(id, { version, score, receiptSha256 } = {}) {
    if (this.skills.size === 0) await this.discover();
    if (!this.skills.has(String(id))) throw new Error(`unknown skill: ${id}`);
    if (!Number.isInteger(Number(version)) || Number(version) < 1 || !Number.isFinite(Number(score)) || !receiptSha256) throw new TypeError('skill certification requires version, score and receiptSha256');
    const record = Object.freeze({ id: String(id), version: Number(version), score: Number(score), receiptSha256: String(receiptSha256), active: true, rolledBack: false });
    const history = [...(this.certifications.get(String(id)) ?? [])].map((entry) => Object.freeze({ ...entry, active: false }));
    history.push(record); this.certifications.set(String(id), history); return record;
  }

  rollback(id, { fromVersion, toVersion, reason, evidenceReceipt } = {}) {
    const history = [...(this.certifications.get(String(id)) ?? [])];
    if (!history.length) throw new Error(`skill has no certified versions: ${id}`);
    const from = history.find((entry) => entry.version === Number(fromVersion));
    const to = history.find((entry) => entry.version === Number(toVersion));
    if (!from || !to || !reason || !evidenceReceipt) throw new Error('skill rollback requires existing versions, reason and evidence receipt');
    const next = history.map((entry) => Object.freeze({ ...entry, active: entry.version === to.version, rolledBack: entry.version === from.version ? true : entry.rolledBack, rollbackReason: entry.version === from.version ? String(reason) : entry.rollbackReason ?? null }));
    this.certifications.set(String(id), next);
    return Object.freeze({ skillId: String(id), fromVersion: from.version, activeVersion: to.version, reason: String(reason), evidenceReceipt: String(evidenceReceipt) });
  }

  certificationStatus(id) { return Object.freeze([...(this.certifications.get(String(id)) ?? [])]); }

  #validateManifest(manifest) {
    if (manifest?.schema !== 'nolane.agent.skill.v1') throw new Error('invalid skill schema');
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(manifest.id ?? ''))) throw new Error('invalid skill id');
    if (typeof manifest.title !== 'string' || !manifest.title.trim()) throw new Error('skill title is required');
    if (typeof manifest.entrypoint !== 'string' || !manifest.entrypoint) throw new Error('skill entrypoint is required');
    if (!Array.isArray(manifest.capabilities) || manifest.capabilities.some((item) => typeof item !== 'string')) throw new Error('skill capabilities must be a string array');
  }
}
