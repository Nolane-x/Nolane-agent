import { PtyHostClient } from '../terminal/pty-host-client.mjs';

export class CredentialHelperClient {
  constructor(options = {}) { this.rpc = new PtyHostClient({ maxFrameBytes: 64 * 1024, ...options }); }
  async start() { return this.rpc.start(); }
  async set({ service, account, secret }) { return this.rpc.request('credential/set', { service, account, secret }); }
  async resolve({ service, account }) { const result = await this.rpc.request('credential/resolve', { service, account }); return result?.secret ?? null; }
  async list({ service = null } = {}) { return this.rpc.request('credential/list', { service }); }
  async delete({ service, account }) { const result = await this.rpc.request('credential/delete', { service, account }); return Boolean(result?.deleted); }
  async close() { await this.rpc.close(); }
}
