export class ProjectRepository {
  async read(_input) { throw new Error('ProjectRepository.read must be implemented'); }
  async commit(_input) { throw new Error('ProjectRepository.commit must be implemented'); }
  async health() { return { ok: false, reason: 'not-implemented' }; }
}

export function assertTenantId(value) {
  const tenantId=String(value??'').trim();
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,159}$/.test(tenantId)) throw new TypeError('tenantId is invalid');
  return tenantId;
}

export function assertIdempotencyKey(value) {
  const key=String(value??'').trim();
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,199}$/.test(key)) throw new TypeError('idempotencyKey is invalid');
  return key;
}
