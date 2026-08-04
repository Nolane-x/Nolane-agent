import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { canonicalSha256, canonicalStringify } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validReceipt(value) {
  return /^[a-f0-9]{64}$/i.test(String(value ?? ''));
}

export function compareDifferentialBehavior({ contract, observed } = {}) {
  if (!Array.isArray(contract) || !Array.isArray(observed)) throw new TypeError('contract and observed arrays are required');
  const observedById = new Map(observed.map((item) => [String(item.id), item.actual]));
  const mismatches = contract
    .filter((item) => !observedById.has(String(item.id)) || canonicalStringify(observedById.get(String(item.id))) !== canonicalStringify(item.expected))
    .map((item) => String(item.id))
    .sort();
  const base = {
    schema: 'nolane.native.differential-behavior.v1', status: mismatches.length === 0 ? 'pass' : 'fail',
    acceptedBehaviors: contract.map((item) => String(item.id)).sort(), mismatches,
    importedThirdPartyRuntime: false, executedThirdPartyRuntime: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export class NolaneOperationalBoundaryService {
  #credentials = new Map();
  #events = [];

  configurationContract() {
    const base = {
      schema: 'nolane.native.configuration-contract.v1',
      canonicalEnvironmentPrefix: 'NOLANE_AGENT_', legacyEnvironmentPrefix: 'FORGE_STUDIO_',
      defaults: { runtime: 'nolane-native', legacySidecarExecutionEnabled: false, host: '127.0.0.1', uiVersion: 'v3' },
      migration: { dataDirectory: '.forge-studio -> .nolane-agent', precedence: 'canonical-over-legacy', rollbackReceiptRequired: true },
      plaintextTokenArgumentsAllowed: false,
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  registerCredential(input = {}) {
    const forbidden = ['value', 'secret', 'token', 'apiKey', 'credential'];
    if (forbidden.some((key) => input[key] !== undefined)) throw new Error('Credential secret values are forbidden; register a secret reference only');
    const provider = String(input.provider ?? '').trim();
    const account = String(input.account ?? '').trim();
    if (!provider || !account || !input.secretRef || typeof input.secretRef !== 'object' || Array.isArray(input.secretRef)) throw new TypeError('provider, account and secretRef are required');
    const secretRef = structuredClone(input.secretRef);
    if (Object.keys(secretRef).some((key) => forbidden.includes(key))) throw new Error('Credential secret values are forbidden inside secretRef');
    const base = {
      schema: 'nolane.native.credential-reference.v1', id: `${provider}:${account}`, provider, account,
      secretRef, capabilities: Array.isArray(input.capabilities) ? [...new Set(input.capabilities.map(String))].sort() : [],
    };
    const record = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#credentials.set(record.id, record);
    this.#events.push({ type: 'credential-reference.registered', receiptSha256: record.receiptSha256 });
    return record;
  }

  async resolveWorkspacePath({ workspaceRoot, relativePath } = {}) {
    if (!workspaceRoot || !relativePath || path.isAbsolute(String(relativePath))) throw new Error('Path is outside workspace boundary');
    const root = await realpath(path.resolve(String(workspaceRoot)));
    const lexical = path.resolve(root, String(relativePath));
    if (!inside(root, lexical)) throw new Error('Path is outside workspace boundary');
    const target = await realpath(lexical).catch((error) => {
      if (error?.code === 'ENOENT') return lexical;
      throw error;
    });
    if (!inside(root, target)) throw new Error('Path is outside workspace boundary');
    return target;
  }

  authorizeAction({ kind, reversible, approvalReceiptSha256 = null } = {}) {
    if (!kind || typeof reversible !== 'boolean') throw new TypeError('Action kind and reversibility are required');
    const approvalRequired = reversible === false;
    if (approvalRequired && !validReceipt(approvalReceiptSha256)) throw new Error('Irreversible action requires an approval receipt');
    const base = {
      schema: 'nolane.native.action-authorization.v1', kind: String(kind), reversible,
      approvalRequired, approvalReceiptSha256: approvalRequired ? approvalReceiptSha256 : null, allowed: true,
    };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#events.push({ type: 'action.authorized', receiptSha256: receipt.receiptSha256 });
    return receipt;
  }

  snapshot() {
    return deepFreeze({
      schema: 'nolane.native.operational-boundary.v1', credentials: [...this.#credentials.values()],
      events: [...this.#events], configuration: this.configurationContract(), secretValuesStored: false,
    });
  }
}
