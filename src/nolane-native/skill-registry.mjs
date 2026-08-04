import { readdir, readFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const inside = (root, candidate) => { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

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
        try {
          const info = await lstat(manifestPath);
          if (!info.isFile() || info.isSymbolicLink()) continue;
          manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        } catch { continue; }
        this.#validateManifest(manifest);
        if (discovered.has(manifest.id)) throw new Error(`duplicate skill id: ${manifest.id}`);
        const entrypoint = path.resolve(directory, manifest.entrypoint);
        if (!inside(directory, entrypoint)) throw new Error(`skill entrypoint escapes skill directory: ${manifest.id}`);
        const entryInfo = await lstat(entrypoint);
        if (!entryInfo.isFile() || entryInfo.isSymbolicLink()) throw new Error(`skill entrypoint must be a regular file: ${manifest.id}`);
        const contentSha256 = sha256(await readFile(entrypoint));
        discovered.set(manifest.id, Object.freeze({
          id: manifest.id,
          title: manifest.title,
          capabilities: Object.freeze([...manifest.capabilities].sort()),
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
    const receiptBase = { schema: 'nolane.agent.skill-load.v1', id, manifestSha256: skill.manifestSha256, contentSha256: skill.contentSha256, capabilities: skill.capabilities };
    return Object.freeze({ id, title: skill.title, capabilities: skill.capabilities, content: bytes.toString('utf8'), contentLoaded: true, receiptSha256: sha256(JSON.stringify(receiptBase)) });
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
