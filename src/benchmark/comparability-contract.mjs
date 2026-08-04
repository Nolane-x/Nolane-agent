import { signed, text } from '../construction/construction-utils.mjs';

function canonical(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`; }

export class ComparabilityContract {
  verify({ task, systems = [] } = {}) {
    if (!task || typeof task !== 'object') throw new TypeError('task is required');
    if (!Array.isArray(systems) || systems.length < 2) throw new TypeError('at least two systems are required');
    const normalized = systems.map((raw) => ({
      system: text(raw?.system, 'system', 512),
      providerKind: text(raw?.providerKind, 'providerKind', 128),
      modelDigest: text(raw?.modelDigest, 'modelDigest', 128),
      machineFingerprint: text(raw?.machineFingerprint, 'machineFingerprint', 128),
      platform: text(raw?.platform, 'platform', 128),
      runtime: text(raw?.runtime, 'runtime', 128),
      budgets: raw?.budgets ?? {},
      permissions: raw?.permissions ?? {},
    }));
    const reference = normalized[0];
    const reasons = [];
    for (const candidate of normalized.slice(1)) {
      if (candidate.modelDigest !== reference.modelDigest) reasons.push('model-mismatch');
      if (candidate.machineFingerprint !== reference.machineFingerprint) reasons.push('machine-mismatch');
      if (candidate.platform !== reference.platform || candidate.runtime !== reference.runtime) reasons.push('runtime-mismatch');
      if (canonical(candidate.budgets) !== canonical(reference.budgets) || canonical(candidate.budgets) !== canonical(task.budgets ?? {})) reasons.push('budget-mismatch');
      if (canonical(candidate.permissions) !== canonical(reference.permissions) || canonical(candidate.permissions) !== canonical(task.permissions ?? {})) reasons.push('permission-mismatch');
    }
    const unique = [...new Set(reasons)];
    return signed({ schema: 'forge.benchmark-comparability.v1', taskId: text(task.id, 'task.id', 512), systems: normalized.map((item) => ({ system: item.system, providerKind: item.providerKind, modelDigest: item.modelDigest, machineFingerprint: item.machineFingerprint, platform: item.platform, runtime: item.runtime })), status: unique.length ? 'reject' : 'pass', reasons: unique, claims: { systemsComparable: unique.length === 0, providerSelfDeclarationSufficient: false } });
  }
}
