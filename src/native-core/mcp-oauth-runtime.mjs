import { createHash, randomBytes as cryptoRandomBytes } from 'node:crypto';
import { atomicWriteJson, freeze, readJson, sha256 } from './native-runtime-utils.mjs';

const b64url = (value) => Buffer.from(value).toString('base64url');
const httpsUrl = (value, field) => { const url = new URL(String(value)); if (url.protocol !== 'https:') throw new TypeError(`${field} must use https`); return url.toString(); };
const loopbackRedirect = (value) => { const url = new URL(String(value)); if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new TypeError('redirectUri must be a loopback http URL'); return url.toString(); };

export class McpOAuthRuntime {
  constructor({ file, clock = () => Date.now(), randomBytes = cryptoRandomBytes, stateTtlMs = 300_000 } = {}) {
    if (!file) throw new TypeError('file is required');
    this.file = file; this.clock = clock; this.randomBytes = randomBytes; this.stateTtlMs = stateTtlMs;
    this.states = new Map(); this.connections = new Map(); this.writeChain = Promise.resolve();
  }
  async open() {
    const data = await readJson(this.file, { connections: [] });
    for (const entry of data.connections ?? []) this.connections.set(entry.serverId, entry);
    return this.snapshot();
  }
  async begin(input = {}) {
    const serverId = String(input.serverId ?? '').trim(); const clientId = String(input.clientId ?? '').trim();
    if (!serverId || !clientId) throw new TypeError('serverId and clientId are required');
    const verifier = b64url(this.randomBytes(32));
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = b64url(this.randomBytes(24));
    const record = { serverId, clientId, authorizationEndpoint: httpsUrl(input.authorizationEndpoint, 'authorizationEndpoint'), tokenEndpoint: httpsUrl(input.tokenEndpoint, 'tokenEndpoint'), redirectUri: loopbackRedirect(input.redirectUri), scopes: [...new Set((input.scopes ?? []).map(String))].sort(), codeVerifier: verifier, expiresAtMs: this.clock() + this.stateTtlMs, used: false };
    this.states.set(state, record);
    return freeze({ schema: 'nolane.mcp-oauth.begin.v1', serverId, state, codeChallenge: challenge, codeChallengeMethod: 'S256', expiresAtMs: record.expiresAtMs, authorizationEndpoint: record.authorizationEndpoint, redirectUri: record.redirectUri, scopes: freeze(record.scopes), receiptSha256: sha256({ serverId, state, challenge, expiresAtMs: record.expiresAtMs }) });
  }
  async complete(input = {}) {
    const state = String(input.state ?? ''); const record = this.states.get(state);
    if (!record) throw new Error('unknown state');
    if (record.used) throw new Error('state already used');
    if (record.expiresAtMs <= this.clock()) { this.states.delete(state); throw new Error('state expired'); }
    const code = String(input.code ?? '').trim(); const credentialRef = String(input.credentialRef ?? '').trim();
    if (!code || !credentialRef.startsWith('vault://')) throw new TypeError('authorization code and vault credentialRef are required');
    record.used = true;
    const connection = freeze({ serverId: record.serverId, credentialRef, tokenEndpoint: record.tokenEndpoint, scopes: freeze(record.scopes), connectedAtMs: this.clock(), authorizationCodeSha256: sha256(code) });
    this.connections.set(record.serverId, connection); this.states.delete(state); await this.#persist();
    return freeze({ ...connection, receiptSha256: sha256(connection) });
  }
  async revoke(serverId) { const id = String(serverId?.serverId ?? serverId ?? ''); const existed = this.connections.delete(id); await this.#persist(); return freeze({ serverId: id, revoked: existed, receiptSha256: sha256({ serverId: id, revoked: existed }) }); }
  connection(serverId) { const value = this.connections.get(String(serverId)); if (!value) throw new Error(`unknown MCP connection: ${serverId}`); return value; }
  snapshot() { return freeze({ schema: 'nolane.mcp-oauth.snapshot.v1', connections: freeze([...this.connections.values()].sort((a, b) => a.serverId.localeCompare(b.serverId)).map((entry) => freeze({ serverId: entry.serverId, credentialRef: entry.credentialRef, tokenEndpoint: entry.tokenEndpoint, scopes: entry.scopes, connectedAtMs: entry.connectedAtMs }))), pendingStates: this.states.size }); }
  #persist() { const value = { schema: 'nolane.mcp-oauth.store.v1', connections: [...this.connections.values()] }; this.writeChain = this.writeChain.catch(() => {}).then(() => atomicWriteJson(this.file, value)); return this.writeChain; }
}
