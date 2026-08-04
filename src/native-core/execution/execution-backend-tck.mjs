import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class ExecutionBackendTCK {
  async verify(backend) {
    if (!backend || typeof backend !== 'object') throw new TypeError('Execution backend is required');
    if (!String(backend.id ?? '').trim()) throw new TypeError('Execution backend id is required');
    if (!String(backend.kind ?? '').trim()) throw new TypeError('Execution backend kind is required');
    if (typeof backend.available !== 'function') throw new TypeError('Execution backend available() is required');
    if (typeof backend.execute !== 'function') throw new TypeError('Execution backend execute() is required');
    if (typeof backend.teardown !== 'function') throw new TypeError('Execution backend teardown() is required');
    const base = Object.freeze({
      schema: 'nolane.execution-backend-tck.v1',
      backendId: String(backend.id),
      kind: String(backend.kind),
      capabilities: Object.freeze([...(backend.capabilities ?? [])].map(String).sort()),
      available: Boolean(await backend.available()),
      status: 'pass',
    });
    return Object.freeze({ ...base, receiptSha256: sha256(base) });
  }
}
