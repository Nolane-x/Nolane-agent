import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from './redaction.mjs';

function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }

export class SecretAccessService {
  constructor({ guardrail, providers = {}, clock = () => Date.now(), eventSink = () => {} } = {}) {
    if (!guardrail?.authorize) throw new TypeError('guardrail is required');
    this.guardrail = guardrail;
    this.providers = new Map();
    this.clock = clock;
    this.eventSink = eventSink;
    for (const [name, provider] of Object.entries(providers)) this.register(name, provider);
  }

  register(name, provider) {
    const id = required(name, 'provider');
    if (!provider?.read) throw new TypeError('secret provider must implement read');
    if (this.providers.has(id)) throw new Error(`Secret provider already registered: ${id}`);
    this.providers.set(id, provider);
    return this;
  }

  listProviders() { return Object.freeze([...this.providers.keys()].sort()); }

  async withSecret(input = {}, consumer) {
    if (typeof consumer !== 'function') throw new TypeError('secret consumer is required');
    const providerName = required(input.provider, 'provider');
    const provider = this.providers.get(providerName);
    if (!provider) throw Object.assign(new Error('Secret provider is not configured'), { code: 'SECRET_PROVIDER_NOT_FOUND', statusCode: 404 });
    const reference = input.reference && typeof input.reference === 'object' && !Array.isArray(input.reference) ? structuredClone(input.reference) : {};
    const name = reference.name ?? reference.path ?? reference.field ?? 'secret';
    const guardrail = this.guardrail.authorize({
      principalId: required(input.principalId, 'principalId'),
      sessionId: input.sessionId ?? null,
      taskContract: input.taskContract,
      consume: input.consume !== false,
      action: { kind: 'secret.read', provider: providerName, name: String(name) },
    });
    const lease = await provider.read(reference);
    const secretView = lease.publicView();
    let safeOutput;
    await lease.consume(async (bytes) => {
      const secretText = bytes.toString('utf8');
      const output = await consumer(bytes);
      safeOutput = redactSecrets(output, { secretValues: [secretText] });
    });
    const base = {
      schema: 'forge.secret-access-receipt.v1',
      at: new Date(this.clock()).toISOString(),
      principalId: input.principalId,
      sessionId: input.sessionId ?? null,
      provider: providerName,
      providerReceiptSha256: secretView.receiptSha256,
      guardrailReceiptSha256: guardrail.receiptSha256,
      outputSha256: canonicalSha256(safeOutput ?? null),
      status: 'pass',
    };
    const receipt = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.eventSink(receipt);
    return freeze({ output: safeOutput, secret: secretView, receipt });
  }
}
