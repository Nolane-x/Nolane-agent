import { signed, text } from '../construction/construction-utils.mjs';

const SHA = /^[a-f0-9]{64}$/i;
function digest(value, label) { const out = String(value ?? '').toLowerCase(); if (!SHA.test(out)) throw new TypeError(`${label} must be SHA-256`); return out; }

export class SbomProvenanceService {
  generate({ commit, components = [], artifacts = [] } = {}) {
    const sourceCommit = digest(commit, 'commit');
    const normalized = [...components, ...artifacts].map((entry, index) => Object.freeze({
      bomRef: `${String(entry.type ?? 'component')}:${text(entry.name, `component[${index}].name`, 512)}@${String(entry.version ?? 'unknown').slice(0, 128)}`,
      type: String(entry.type ?? 'library').slice(0, 64),
      name: String(entry.name),
      version: String(entry.version ?? 'unknown').slice(0, 128),
      digest: digest(entry.digest, `component[${index}].digest`),
      origin: text(entry.origin, `component[${index}].origin`, 512),
      license: entry.license ? String(entry.license).slice(0, 128) : null,
      sourceCommit,
    })).sort((a, b) => a.bomRef.localeCompare(b.bomRef));
    return signed({
      schema: 'forge.sbom-provenance.v1',
      format: 'cyclonedx-compatible-bounded',
      sourceCommit,
      components: normalized,
      componentCount: normalized.length,
      claims: { rawComponentContentStored: false, externalRegistryQueried: false },
    });
  }
}
