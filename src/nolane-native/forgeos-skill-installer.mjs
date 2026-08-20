import { lstat, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

async function exists(candidate) {
  try { await lstat(candidate); return true; } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function skillName(content) {
  const match = String(content ?? '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const name = match?.[1]?.match(/^name:\s*([a-z0-9][a-z0-9-]{1,127})\s*$/m)?.[1] ?? null;
  if (!name) throw new Error('ForgeOS Skill has invalid standard frontmatter');
  return name;
}

function receiptFor(skill, files, directoryName) {
  return {
    schema: 'nolane.agent.forgeos-skill-install.v1', id: skill.id, sourceId: skill.sourceId, catalog: skill.catalog,
    directoryName, sourceUrl: skill.sourceUrl, license: skill.license, sourceCommit: skill.sourceCommit,
    contentSha256: skill.contentSha256, manifestSha256: files.find((file) => file.relativePath === 'manifest.json')?.contentSha256 ?? null,
    catalogSha256: skill.catalogSha256, sourceReceiptSha256: skill.receiptSha256,
    files: files.map((file) => ({ relativePath: file.relativePath, contentSha256: file.contentSha256 })),
  };
}

async function writeBundleFile(stage, file) {
  const destination = path.resolve(stage, file.relativePath);
  if (!inside(stage, destination)) throw new Error(`Skill bundle file escapes staging directory: ${file.relativePath}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, file.content, { encoding: 'utf8', flag: 'wx' });
}

export class ForgeOsSkillInstaller {
  constructor({ catalog, destinationRoot } = {}) {
    if (!catalog || typeof catalog.readInstallBundle !== 'function') throw new TypeError('catalog with readInstallBundle is required');
    if (!destinationRoot) throw new TypeError('destinationRoot is required');
    this.catalog = catalog;
    this.destinationRoot = path.resolve(destinationRoot);
  }

  async install(id) {
    const bundle = await this.catalog.readInstallBundle(id);
    const { skill, files } = bundle;
    if (skill.source !== 'forge-os' || !skill.sourceUrl || !skill.license || !/^[a-f0-9]{64}$/.test(String(skill.contentSha256)) || !/^[a-f0-9]{64}$/.test(String(skill.catalogSha256)) || !/^[a-f0-9]{64}$/.test(String(skill.receiptSha256))) throw new Error(`ForgeOS Skill provenance is incomplete: ${id}`);
    const entrypoint = files.find((file) => file.relativePath === 'SKILL.md');
    if (!entrypoint || entrypoint.contentSha256 !== skill.contentSha256) throw new Error(`ForgeOS Skill bundle is stale: ${id}`);
    const directoryName = skillName(entrypoint.content);
    if (directoryName !== skill.sourceId) throw new Error(`ForgeOS Skill name does not match source ID: ${id}`);
    await mkdir(this.destinationRoot, { recursive: true });
    const destination = path.resolve(this.destinationRoot, directoryName);
    if (!inside(this.destinationRoot, destination)) throw new Error(`Skill destination escapes local library: ${id}`);
    const lock = path.join(this.destinationRoot, `.nolane-skill-install-${directoryName}.lock`);
    try { await mkdir(lock); } catch (error) {
      if (error?.code === 'EEXIST') throw new Error(`Skill already installed or installing: ${directoryName}`);
      throw error;
    }
    let stage = null;
    try {
      if (await exists(destination)) throw new Error(`Skill already installed: ${directoryName}`);
      stage = await mkdtemp(path.join(this.destinationRoot, '.nolane-skill-'));
      for (const file of files) await writeBundleFile(stage, file);
      const receipt = receiptFor(skill, files, directoryName);
      const sidecar = {
        schema: 'nolane.agent.skill-provenance.v1', sourceUrl: skill.sourceUrl, license: skill.license, capabilities: [],
        import: {
          source: 'forge-os', sourceId: skill.sourceId, catalog: skill.catalog, contentSha256: skill.contentSha256,
          manifestSha256: receipt.manifestSha256, catalogSha256: skill.catalogSha256, sourceCommit: skill.sourceCommit, receiptSha256: skill.receiptSha256,
        },
      };
      await writeFile(path.join(stage, 'nolane-skill.json'), `${JSON.stringify(sidecar, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      if (await exists(destination)) throw new Error(`Skill already installed: ${directoryName}`);
      await rename(stage, destination);
      stage = null;
      const receiptSha256 = sha256(JSON.stringify(receipt));
      return Object.freeze({ ...receipt, files: Object.freeze(receipt.files.map((file) => file.relativePath)), provenanceStatus: 'forge-os-imported', receiptSha256 });
    } finally {
      if (stage) await rm(stage, { recursive: true, force: true });
      await rm(lock, { recursive: true, force: true });
    }
  }
}
