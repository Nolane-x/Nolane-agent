export class InMemorySandboxDriver {
  constructor() { this.records = new Map(); }
  restore(records = []) { for (const record of records) if (record?.id) this.records.set(record.id, structuredClone(record)); }
  async provision(spec) { const record = { id: spec.id, state: 'running', isolationLevel: 'reference-only', spec: structuredClone(spec), createdAt: spec.createdAt }; this.records.set(spec.id, record); return structuredClone(record); }
  async inspect(id) { const record = this.records.get(id); return record ? structuredClone(record) : null; }
  async snapshot(id) { const record = this.records.get(id); if (!record) throw new Error('Sandbox not found'); return { snapshotId: `${id}:snapshot`, sandboxId: id, createdAt: Date.now() }; }
  async resume(snapshot, spec) { return this.provision({ ...spec, resumedFrom: snapshot.snapshotId }); }
  async terminate(id) { const record = this.records.get(id); if (record) record.state = 'terminated'; return record ? structuredClone(record) : null; }
}
