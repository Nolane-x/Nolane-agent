import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const ALLOWED = new Set(['audio.transcribe', 'audio.synthesize', 'audio.inspect']);
export class AudioProviderRegistry {
  #providers = new Map(); #max;
  constructor({ maxArtifactBytes = 25_000_000 } = {}) { this.#max = Math.max(1, Number(maxArtifactBytes) || 25_000_000); }
  register({ id, capabilities, credentialRef = null, execute } = {}) {
    if (!id || !Array.isArray(capabilities) || capabilities.length === 0 || capabilities.some((item) => !ALLOWED.has(item)) || typeof execute !== 'function') throw new TypeError('Valid audio provider is required');
    this.#providers.set(String(id), { id: String(id), capabilities: [...new Set(capabilities)].sort(), credentialRef: credentialRef === null ? null : String(credentialRef), execute }); return this;
  }
  describe() { return Object.freeze([...this.#providers.values()].map(({ credentialRef, execute, ...item }) => Object.freeze(item)).sort((a, b) => a.id.localeCompare(b.id))); }
  async execute({ capability, input = {}, providerId = null } = {}) {
    if (!ALLOWED.has(String(capability))) throw new TypeError(`Unsupported audio capability: ${capability}`);
    const provider = providerId ? this.#providers.get(String(providerId)) : [...this.#providers.values()].find((item) => item.capabilities.includes(String(capability)));
    if (!provider || !provider.capabilities.includes(String(capability))) throw new Error(`No audio provider for capability: ${capability}`);
    const output = await provider.execute({ capability: String(capability), input: structuredClone(input), credentialRef: provider.credentialRef });
    const bytes = output?.bytes === undefined ? null : Buffer.from(output.bytes);
    if (bytes && bytes.length > this.#max) throw new Error(`Audio artifact byte limit exceeded: ${bytes.length} > ${this.#max}`);
    const base = { schema: 'nolane.native.audio-provider-result.v1', providerId: provider.id, capability: String(capability), mimeType: output?.mimeType ?? null, artifactBytes: bytes?.length ?? 0, artifactSha256: bytes ? sha256(bytes) : null, text: output?.text === undefined ? null : String(output.text), language: output?.language === undefined ? null : String(output.language) };
    return Object.freeze({ ...base, bytes: bytes ? Buffer.from(bytes) : null, receiptSha256: sha256(JSON.stringify(base)) });
  }
}
