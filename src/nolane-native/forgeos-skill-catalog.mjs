import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const CATALOGS = Object.freeze([
  Object.freeze({ id: 'v2', directory: 'skills-v2', prefix: 'forgeos:v2:', title: 'ForgeOS Skills v2' }),
  Object.freeze({ id: 'legacy', directory: 'skills', prefix: 'forgeos:legacy:', title: 'ForgeOS Skills' }),
]);

function catalogEntryPath(root, catalog, entry) {
  if (catalog.id === 'v2') {
    if (typeof entry?.path !== 'string' || !entry.path) return null;
    return path.resolve(root, entry.path);
  }
  if (typeof entry?.name !== 'string' || !entry.name || !/^[a-z0-9][a-z0-9-]{1,127}$/.test(entry.name)) return null;
  if (entry.kind === 'domain') {
    if (typeof entry.domain !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(entry.domain)) return null;
    return path.resolve(root, 'skills', 'domains', entry.domain, entry.name);
  }
  if (entry.kind !== 'core' || typeof entry.pack !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(entry.pack)) return null;
  return path.resolve(root, 'skills', 'core', entry.pack, entry.name);
}

async function regularFile(file) {
  try {
    const info = await lstat(file);
    return info.isFile() && !info.isSymbolicLink();
  } catch {
    return false;
  }
}

const humanize = (value) => String(value ?? '').replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const DEFAULT_SOURCE_URL = 'https://github.com/Nolane-x/forge-os';

async function readJsonFile(file) {
  if (!await regularFile(file)) return { value: null, bytes: null };
  try {
    const bytes = await readFile(file);
    return { value: JSON.parse(bytes.toString('utf8')), bytes };
  } catch {
    return { value: null, bytes: null };
  }
}

async function readProvenance(root, sourceUrl) {
  const manifestResult = await readJsonFile(path.join(root, 'project-manifest.json'));
  const packageResult = await readJsonFile(path.join(root, 'package.json'));
  const source = manifestResult.value?.source ?? {};
  const verification = manifestResult.value?.verification ?? {};
  const packageRepository = packageResult.value?.repository?.url;
  const releaseVersion = String(manifestResult.value?.version ?? packageResult.value?.version ?? '').trim() || null;
  const sourceCommit = typeof source.commit === 'string' && source.commit ? source.commit : null;
  const sourceTree = typeof source.tree === 'string' && source.tree ? source.tree : null;
  const verificationSourceCommit = typeof verification.sourceCommit === 'string' && verification.sourceCommit ? verification.sourceCommit : null;
  const verificationSourceTree = typeof verification.sourceTree === 'string' && verification.sourceTree ? verification.sourceTree : null;
  const sourceDirty = source.dirty === true ? true : source.dirty === false ? false : null;
  const license = typeof packageResult.value?.license === 'string' && packageResult.value.license
    ? packageResult.value.license
    : await regularFile(path.join(root, 'LICENSE')) ? 'MIT' : null;
  return Object.freeze({
    sourceUrl: sourceUrl ?? packageRepository ?? DEFAULT_SOURCE_URL,
    sourceCommit,
    sourceTree,
    verificationSourceCommit,
    verificationSourceTree,
    releaseVersion,
    license,
    sourceDirty,
    provenanceStatus: sourceDirty === true ? 'vendor-snapshot-dirty' : sourceCommit ? 'verified-source-snapshot' : 'unverified-local-copy',
    manifestSha256: manifestResult.bytes ? sha256(manifestResult.bytes) : null,
  });
}

export class ForgeOsSkillCatalog {
  constructor({ roots = [], sourceUrl = DEFAULT_SOURCE_URL } = {}) {
    this.roots = roots.map((root) => path.resolve(root));
    this.sourceUrl = sourceUrl;
    this.skills = new Map();
  }

  async discover() {
    const discovered = new Map();
    for (const configuredRoot of this.roots) {
      let root;
      try { root = await realpath(configuredRoot); } catch { continue; }
      const provenance = await readProvenance(root, this.sourceUrl);
      for (const catalog of CATALOGS) {
        const catalogPath = path.join(root, catalog.directory, 'catalog.json');
        if (!await regularFile(catalogPath)) continue;
        let entries;
        let catalogBytes;
        try {
          catalogBytes = await readFile(catalogPath);
          entries = JSON.parse(catalogBytes.toString('utf8'));
        } catch {
          continue;
        }
        if (!Array.isArray(entries)) continue;
        const catalogSha256 = sha256(catalogBytes);
        for (const entry of entries) {
          const sourceId = String(entry?.id ?? entry?.name ?? '');
          if (!/^[a-z0-9][a-z0-9-]{1,127}$/.test(sourceId)) continue;
          const directory = catalogEntryPath(root, catalog, entry);
          if (!directory || !inside(root, directory) || !await regularFile(path.join(directory, 'SKILL.md'))) continue;
          const skillFile = path.join(directory, 'SKILL.md');
          let content;
          try { content = await readFile(skillFile); } catch { continue; }
          let manifest = null;
          const manifestPath = path.join(directory, 'manifest.json');
          if (await regularFile(manifestPath)) {
            try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { manifest = null; }
          }
          const id = `${catalog.prefix}${sourceId}`;
          if (discovered.has(id)) throw new Error(`duplicate ForgeOS skill id: ${id}`);
          const title = String(entry?.title ?? manifest?.identity?.title ?? manifest?.title ?? manifest?.name ?? humanize(sourceId)).trim();
          const record = {
            id,
            sourceId,
            source: 'forge-os',
            sourceUrl: provenance.sourceUrl,
            sourceCommit: provenance.sourceCommit,
            sourceTree: provenance.sourceTree,
            verificationSourceCommit: provenance.verificationSourceCommit,
            verificationSourceTree: provenance.verificationSourceTree,
            releaseVersion: provenance.releaseVersion,
            license: provenance.license,
            sourceDirty: provenance.sourceDirty,
            provenanceStatus: provenance.provenanceStatus,
            provenanceManifestSha256: provenance.manifestSha256,
            catalog: catalog.id,
            catalogTitle: catalog.title,
            title,
            description: typeof (entry?.description ?? manifest?.identity?.description ?? manifest?.description) === 'string' ? (entry.description ?? manifest?.identity?.description ?? manifest?.description) : null,
            maturity: entry?.maturity ?? manifest?.maturity ?? manifest?.metadata?.maturity ?? entry?.status ?? null,
            status: entry?.status ?? manifest?.status ?? manifest?.metadata?.status ?? entry?.maturity ?? null,
            kind: entry?.kind ?? manifest?.skillType ?? manifest?.metadata?.['skill-type'] ?? 'technique',
            pack: entry?.pack ?? null,
            domain: entry?.domain ?? null,
            kernelLevel: entry?.kernelLevel ?? null,
            capabilityIds: Object.freeze([...(entry?.capabilityIds ?? [])].map(String).sort()),
            defaultSections: Object.freeze([...(entry?.defaultSections ?? [])].map(String)),
            targetTokens: Number.isFinite(Number(entry?.targetTokens)) ? Number(entry.targetTokens) : null,
            hardTokens: Number.isFinite(Number(entry?.hardTokens)) ? Number(entry.hardTokens) : null,
            relativePath: path.relative(root, directory).replaceAll(path.sep, '/'),
            manifestSha256: typeof entry?.manifestSha256 === 'string' ? entry.manifestSha256 : null,
            contentSha256: sha256(content),
            catalogSha256,
            directory,
            skillFile,
            contentLoaded: false,
          };
          discovered.set(id, Object.freeze(record));
        }
      }
    }
    this.skills = discovered;
    return [...discovered.values()].map(({ directory, skillFile, ...view }) => Object.freeze({ ...view }));
  }

  async load(id) {
    if (this.skills.size === 0) await this.discover();
    const skill = this.skills.get(String(id));
    if (!skill) throw new Error(`unknown ForgeOS skill: ${id}`);
    if (!await regularFile(skill.skillFile)) throw new Error(`ForgeOS skill entrypoint is unavailable: ${id}`);
    const content = await readFile(skill.skillFile);
    if (sha256(content) !== skill.contentSha256) throw new Error(`ForgeOS skill content changed after discovery: ${id}`);
    const receiptBase = {
      schema: 'nolane.agent.forgeos-skill-load.v1',
      id: skill.id,
      sourceId: skill.sourceId,
      catalog: skill.catalog,
      sourceUrl: skill.sourceUrl,
      sourceCommit: skill.sourceCommit,
      sourceTree: skill.sourceTree,
      verificationSourceCommit: skill.verificationSourceCommit,
      verificationSourceTree: skill.verificationSourceTree,
      releaseVersion: skill.releaseVersion,
      license: skill.license,
      sourceDirty: skill.sourceDirty,
      provenanceStatus: skill.provenanceStatus,
      provenanceManifestSha256: skill.provenanceManifestSha256,
      catalogSha256: skill.catalogSha256,
      manifestSha256: skill.manifestSha256,
      contentSha256: skill.contentSha256,
    };
    return Object.freeze({
      id: skill.id,
      sourceId: skill.sourceId,
      source: skill.source,
      sourceUrl: skill.sourceUrl,
      sourceCommit: skill.sourceCommit,
      sourceTree: skill.sourceTree,
      verificationSourceCommit: skill.verificationSourceCommit,
      verificationSourceTree: skill.verificationSourceTree,
      releaseVersion: skill.releaseVersion,
      license: skill.license,
      sourceDirty: skill.sourceDirty,
      provenanceStatus: skill.provenanceStatus,
      provenanceManifestSha256: skill.provenanceManifestSha256,
      catalog: skill.catalog,
      catalogTitle: skill.catalogTitle,
      title: skill.title,
      description: skill.description,
      maturity: skill.maturity,
      status: skill.status,
      kind: skill.kind,
      pack: skill.pack,
      domain: skill.domain,
      kernelLevel: skill.kernelLevel,
      capabilityIds: skill.capabilityIds,
      defaultSections: skill.defaultSections,
      targetTokens: skill.targetTokens,
      hardTokens: skill.hardTokens,
      relativePath: skill.relativePath,
      manifestSha256: skill.manifestSha256,
      contentSha256: skill.contentSha256,
      catalogSha256: skill.catalogSha256,
      content: content.toString('utf8'),
      contentLoaded: true,
      receiptSha256: sha256(JSON.stringify(receiptBase)),
    });
  }
}
