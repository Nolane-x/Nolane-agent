import { boundedArray, optionalText, sha, signed, text } from './frontier-utils.mjs';

const TYPES = new Set(['skill', 'architecture-decision', 'policy', 'memory']);
const TRANSITIONS = new Set(['fork', 'merge', 'supersede', 'revoke', 'rollback']);

export class CulturalLineageLedger {
  constructor({ maxArtifacts = 5_000, maxHistoryPerArtifact = 200 } = {}) { this.maxArtifacts = maxArtifacts; this.maxHistoryPerArtifact = maxHistoryPerArtifact; this.artifacts = new Map(); }

  register(input = {}) {
    if (this.artifacts.size >= this.maxArtifacts) throw new RangeError('cultural lineage artifact limit exceeded');
    const artifactId = text(input.artifactId, 'artifactId', 200); if (this.artifacts.has(artifactId)) throw new TypeError(`duplicate artifact: ${artifactId}`);
    const artifactType = text(input.artifactType, 'artifactType', 80); if (!TYPES.has(artifactType)) throw new TypeError(`unsupported artifact type: ${artifactType}`);
    const parents = boundedArray(input.parents ?? [], 'parents', 16).map((parent) => {
      const parentId = text(parent.artifactId, 'parent.artifactId', 200); const parentVersion = text(parent.version, 'parent.version', 128);
      const state = this.artifacts.get(parentId); if (!state || !state.versions.has(parentVersion)) throw new Error(`unknown parent version: ${parentId}@${parentVersion}`);
      return { artifactId: parentId, version: parentVersion };
    });
    const version = text(input.version, 'version', 128);
    const entry = signed({ schema: 'forge.cultural-lineage-entry.v1', artifactId, artifactType, version, parents, provenanceReceiptSha256: sha(input.provenanceReceiptSha256, 'provenanceReceiptSha256'), rollbackRef: text(input.rollbackRef, 'rollbackRef', 300) });
    this.artifacts.set(artifactId, { artifactId, artifactType, currentVersion: version, versions: new Set([version]), parents, provenanceReceiptSha256: entry.provenanceReceiptSha256, rollbackRef: entry.rollbackRef, history: [entry], revoked: false });
    return entry;
  }

  transition(artifactId, input = {}) {
    const state = this.#state(artifactId); if (state.history.length >= this.maxHistoryPerArtifact) throw new RangeError('lineage history limit exceeded');
    const transition = text(input.transition, 'transition', 40); if (!TRANSITIONS.has(transition)) throw new TypeError(`unsupported lineage transition: ${transition}`);
    const targetVersion = text(input.targetVersion, 'targetVersion', 128);
    if (transition === 'rollback' && !state.versions.has(targetVersion)) throw new Error(`rollback target version is unknown: ${targetVersion}`);
    if (transition !== 'rollback') state.versions.add(targetVersion);
    const event = signed({ schema: 'forge.cultural-lineage-transition.v1', artifactId: state.artifactId, artifactType: state.artifactType, transition, fromVersion: state.currentVersion, targetVersion, sourceReceiptSha256: sha(input.sourceReceiptSha256, 'sourceReceiptSha256'), rollbackRef: input.rollbackRef ? text(input.rollbackRef, 'rollbackRef', 300) : state.rollbackRef });
    state.currentVersion = targetVersion; state.rollbackRef = event.rollbackRef; state.revoked = transition === 'revoke'; state.history.push(event);
    return this.#snapshotState(state);
  }

  snapshot() { return signed({ schema: 'forge.cultural-lineage-ledger.v1', artifacts: [...this.artifacts.values()].map((state) => this.#snapshotState(state)).sort((a,b)=>a.artifactId.localeCompare(b.artifactId)), claims: { rawPromptStored: false, chainOfThoughtStored: false, productionPolicyChanged: false } }); }
  #state(id) { const artifactId = text(id, 'artifactId', 200); const state = this.artifacts.get(artifactId); if (!state) throw new RangeError(`unknown artifact: ${artifactId}`); return state; }
  #snapshotState(state) { return signed({ schema: 'forge.cultural-lineage-state.v1', artifactId: state.artifactId, artifactType: state.artifactType, currentVersion: state.currentVersion, versions: [...state.versions].sort(), parents: state.parents, provenanceReceiptSha256: state.provenanceReceiptSha256, rollbackRef: state.rollbackRef, revoked: state.revoked, history: state.history, claims: { rawPromptStored: false } }); }
}
