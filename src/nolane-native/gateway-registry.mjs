export class NolaneGatewayRegistry {
  constructor() { this.gateways = new Map(); }
  register(gateway) {
    if (!gateway?.id || !gateway?.platform || typeof gateway.probe !== 'function' || typeof gateway.start !== 'function' || typeof gateway.stop !== 'function') throw new Error('gateway requires id, platform, probe, start and stop');
    if (this.gateways.has(gateway.id)) throw new Error(`gateway already registered: ${gateway.id}`);
    this.gateways.set(gateway.id, { gateway, state: 'stopped', lastProbe: null });
  }
  async probe(id) { const item = this.#require(id); const result = await item.gateway.probe(); item.lastProbe = Object.freeze({ ...result }); return Object.freeze({ id, platform: item.gateway.platform, capabilities: Object.freeze([...(item.gateway.capabilities ?? [])]), ...result }); }
  async start(id) { const item = this.#require(id); const probe = await this.probe(id); if (!probe.ready) throw new Error(`gateway is not ready: ${id}`); await item.gateway.start(); item.state = 'running'; return this.status(id); }
  async stop(id) { const item = this.#require(id); if (item.state === 'running') await item.gateway.stop(); item.state = 'stopped'; return this.status(id); }
  status(id) { const item = this.#require(id); return Object.freeze({ id, platform: item.gateway.platform, capabilities: Object.freeze([...(item.gateway.capabilities ?? [])]), status: item.state, ready: item.lastProbe?.ready ?? null }); }
  snapshot() { return Object.freeze([...this.gateways.keys()].sort().map((id) => this.status(id))); }
  #require(id) { const item = this.gateways.get(id); if (!item) throw new Error(`unknown gateway: ${id}`); return item; }
}
