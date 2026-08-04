import { randomUUID } from 'node:crypto';
function req(value, name) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${name} is required`); return text; }
function validDigest(value) { return /^sha256:[a-f0-9]{64}$/i.test(String(value ?? '')); }
function clone(value) { return structuredClone(value); }
function publicRecord(record) { const { driverState: _driverState, ...visible } = record; return clone(visible); }

export class CloudSandboxService {
  constructor({ driver, policies = {}, storage = null, clock = () => Date.now(), audit = () => {} } = {}) {
    if (!driver) throw new TypeError('driver is required');
    this.driver = driver; this.policies = policies; this.storage = storage; this.clock = clock; this.audit = audit; this.boxes = new Map();
    const restored = storage?.loadAll?.() ?? [];
    for (const record of restored) this.boxes.set(record.id, clone(record));
    driver.restore?.(restored.map((record) => record.driverState).filter(Boolean));
  }
  #persist(record) { this.storage?.save?.(record); }
  #policy(org) { const policy = this.policies[org]; if (!policy) throw Object.assign(new Error('Sandbox policy not configured'), { statusCode: 403, code: 'sandbox-policy-missing' }); return policy; }
  async create(input = {}) {
    const org = req(input.organizationId, 'organizationId'); const workspaceId = req(input.workspaceId, 'workspaceId'); const policy = this.#policy(org);
    const active = [...this.boxes.values()].filter((box) => box.organizationId === org && !['terminated','failed'].includes(box.state)).length;
    if (active >= Number(policy.maxActive ?? 1)) throw Object.assign(new Error('Sandbox quota exceeded'), { statusCode: 429, code: 'sandbox-quota' });
    if (!policy.allowedRegions?.includes(input.region)) throw Object.assign(new Error('Sandbox region not allowed'), { statusCode: 403, code: 'sandbox-region' });
    if (policy.dataResidency && input.dataResidency !== policy.dataResidency) throw Object.assign(new Error('Data residency mismatch'), { statusCode: 403, code: 'sandbox-residency' });
    if (!validDigest(input.imageDigest)) throw new TypeError('imageDigest must be a sha256 digest');
    const resources = input.resources ?? {};
    if (Number(resources.cpu) > Number(policy.maxCpu) || Number(resources.ramMb) > Number(policy.maxRamMb)) throw Object.assign(new Error('Sandbox resource quota exceeded'), { statusCode: 429, code: 'sandbox-resource-quota' });
    const ttlMs = Math.max(100, Number(input.ttlMs ?? policy.maxTtlMs));
    if (ttlMs > Number(policy.maxTtlMs)) throw Object.assign(new Error('Sandbox TTL exceeds policy'), { statusCode: 400, code: 'sandbox-ttl' });
    if (input.network?.mode !== 'allowlist' && input.network?.mode !== 'deny') throw new TypeError('network mode must be deny or allowlist');
    for (const secret of input.secrets ?? []) if (!String(secret.ref ?? '').startsWith(`vault://${org}/`)) throw Object.assign(new Error('Secret reference crosses tenant boundary'), { statusCode: 403, code: 'sandbox-secret-tenant' });
    const id = String(input.id ?? randomUUID());
    if (this.boxes.has(id)) throw Object.assign(new Error('Sandbox ID already exists'), { statusCode: 409, code: 'sandbox-conflict' });
    const createdAt = this.clock();
    const spec = { id, organizationId: org, workspaceId, region: input.region, dataResidency: input.dataResidency, imageDigest: input.imageDigest, resources: clone(resources), ttlMs, expiresAt: createdAt + ttlMs, network: clone(input.network), workspaceReadOnly: input.workspaceReadOnly === true, secretRefs: (input.secrets ?? []).map((secret) => String(secret.ref)), cacheNamespace: `${org}/${id}`, createdAt };
    const provisioned = await this.driver.provision(spec);
    const record = { ...spec, state: provisioned.state ?? 'running', isolationLevel: provisioned.isolationLevel ?? 'unknown', driverState: clone(provisioned), updatedAt: this.clock() };
    this.boxes.set(id, record); this.#persist(record);
    this.audit({ type: 'sandbox.created', organizationId: org, workspaceId, sandboxId: id });
    return publicRecord(record);
  }
  get({ organizationId, sandboxId } = {}) { const box = this.boxes.get(req(sandboxId, 'sandboxId')); if (!box || box.organizationId !== req(organizationId, 'organizationId')) throw Object.assign(new Error('Sandbox not found'), { statusCode: 404, code: 'sandbox-not-found' }); return publicRecord(box); }
  async terminate({ organizationId, sandboxId, reason = 'requested' } = {}) {
    const visible = this.get({ organizationId, sandboxId });
    if (visible.state === 'terminated') return visible;
    await this.driver.terminate(visible.id);
    const current = this.boxes.get(visible.id); current.state = 'terminated'; current.terminatedAt = this.clock(); current.terminationReason = String(reason); current.updatedAt = this.clock();
    if (current.driverState) current.driverState.state = 'terminated';
    this.#persist(current);
    this.audit({ type: 'sandbox.terminated', organizationId, sandboxId, reason });
    return publicRecord(current);
  }
  async snapshot({ organizationId, sandboxId } = {}) { const box = this.get({ organizationId, sandboxId }); if (box.state !== 'running') throw Object.assign(new Error('Sandbox is not running'), { statusCode: 409 }); return this.driver.snapshot(box.id); }
  async sweepExpired() { const now = this.clock(); let count = 0; for (const box of [...this.boxes.values()]) if (box.state === 'running' && box.expiresAt <= now) { await this.terminate({ organizationId: box.organizationId, sandboxId: box.id, reason: 'ttl-expired' }); count += 1; } return count; }
}
