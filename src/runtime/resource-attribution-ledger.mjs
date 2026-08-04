import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
function text(value, label, max = 256) { const output = String(value ?? '').trim(); if (!output) throw new TypeError(`${label} is required`); if (output.length > max) throw new TypeError(`${label} is too long`); return output; }
function sha(value, label) { const output = String(value ?? '').trim().toLowerCase(); if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`); return output; }
function number(value, label) { const output = Number(value); if (!Number.isFinite(output) || output < 0) throw new TypeError(`${label} must be non-negative`); return output; }
function at(value) { const output = Number(value); if (!Number.isSafeInteger(output) || output < 0) throw new TypeError('atMs must be a non-negative safe integer'); return output; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class ResourceAttributionLedger {
  constructor({ maxResources = 20_000, maxSamplesPerResource = 10_000 } = {}) {
    this.maxResources = Math.max(1, Math.floor(Number(maxResources) || 20_000));
    this.maxSamplesPerResource = Math.max(2, Math.floor(Number(maxSamplesPerResource) || 10_000));
    this.resources = new Map();
  }

  registerResource(input = {}) {
    const resourceId = text(input.resourceId, 'resourceId');
    const hierarchy = {
      resourceId, decisionId: text(input.decisionId, 'decisionId'), taskId: text(input.taskId, 'taskId'),
      milestoneId: text(input.milestoneId, 'milestoneId'), missionId: text(input.missionId, 'missionId'),
      registrationReceiptSha256: sha(input.registrationReceiptSha256, 'registrationReceiptSha256'),
    };
    const existing = this.resources.get(resourceId);
    if (existing) {
      const same = ['decisionId', 'taskId', 'milestoneId', 'missionId', 'registrationReceiptSha256'].every((key) => existing[key] === hierarchy[key]);
      if (!same) throw new TypeError(`resource conflict: ${resourceId}`);
      return signed({ schema: 'forge.resource-attribution-registration.v1', ...hierarchy, duplicate: true });
    }
    if (this.resources.size >= this.maxResources) throw new RangeError(`resource capacity exceeded: ${this.maxResources}`);
    this.resources.set(resourceId, { ...hierarchy, samples: new Map(), journal: [], lastAtMs: null, lastRssMb: null, rssMbSeconds: 0, finalized: false });
    return signed({ schema: 'forge.resource-attribution-registration.v1', ...hierarchy, duplicate: false });
  }

  sample(input = {}) { return this.#applySample(input, false); }
  finalize(input = {}) { return this.#applySample(input, true); }

  #applySample(input, final) {
    const resourceId = text(input.resourceId, 'resourceId');
    const resource = this.resources.get(resourceId);
    if (!resource) throw new RangeError(`unknown resource: ${resourceId}`);
    if (resource.finalized) throw new TypeError(`resource is finalized: ${resourceId}`);
    const sampleId = text(input.sampleId, 'sampleId');
    const sampleAtMs = at(input.atMs);
    const rssMb = number(input.rssMb, 'rssMb');
    const sourceReceiptSha256 = sha(input.sourceReceiptSha256, 'sourceReceiptSha256');
    const existing = resource.samples.get(sampleId);
    if (existing) {
      if (existing.atMs !== sampleAtMs || existing.rssMb !== rssMb || existing.sourceReceiptSha256 !== sourceReceiptSha256 || existing.final !== final) throw new TypeError(`sample conflict: ${sampleId}`);
      return signed({ schema: 'forge.resource-attribution-sample.v1', resourceId, sampleId, duplicate: true, final, rssMbSeconds: resource.rssMbSeconds });
    }
    if (resource.lastAtMs !== null && sampleAtMs < resource.lastAtMs) throw new TypeError('resource sample time must be monotonic');
    if (resource.samples.size >= this.maxSamplesPerResource) throw new RangeError(`resource sample capacity exceeded: ${this.maxSamplesPerResource}`);
    if (resource.lastAtMs !== null) resource.rssMbSeconds += ((resource.lastRssMb + rssMb) / 2) * ((sampleAtMs - resource.lastAtMs) / 1_000);
    const sample = Object.freeze({ sampleId, atMs: sampleAtMs, rssMb, sourceReceiptSha256, final });
    resource.samples.set(sampleId, sample); resource.journal.push(sample); resource.lastAtMs = sampleAtMs; resource.lastRssMb = rssMb; resource.finalized = final;
    return signed({ schema: 'forge.resource-attribution-sample.v1', resourceId, sampleId, duplicate: false, final, atMs: sampleAtMs, rssMb, rssMbSeconds: resource.rssMbSeconds, sourceReceiptSha256 });
  }

  snapshot(scope = {}) {
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new TypeError('scope must be an object');
    const selectors = ['resourceId', 'decisionId', 'taskId', 'milestoneId', 'missionId'].filter((key) => scope[key] != null);
    if (selectors.length > 1) throw new TypeError('scope must select exactly one hierarchy level');
    const selectedKey = selectors[0] ?? null;
    const selectedValue = selectedKey ? text(scope[selectedKey], selectedKey) : null;
    const resources = [...this.resources.values()].filter((item) => !selectedKey || item[selectedKey] === selectedValue);
    return signed({
      schema: 'forge.resource-attribution-snapshot.v1', scope: selectedKey ? { [selectedKey]: selectedValue } : {},
      resourceCount: resources.length, rssMbSeconds: resources.reduce((sum, item) => sum + item.rssMbSeconds, 0),
      activeResourceCount: resources.filter((item) => !item.finalized).length,
      resources: resources.map((item) => Object.freeze({ resourceId: item.resourceId, decisionId: item.decisionId, taskId: item.taskId, milestoneId: item.milestoneId, missionId: item.missionId, rssMbSeconds: item.rssMbSeconds, sampleCount: item.samples.size, finalized: item.finalized, lastAtMs: item.lastAtMs, lastRssMb: item.lastRssMb })),
      claims: { rssIntegratedByTrapezoid: true, unscopedCostsAllowed: false, fileDescriptorsInferred: false },
    });
  }
}
