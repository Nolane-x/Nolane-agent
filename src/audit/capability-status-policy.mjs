const STATUSES = new Set(['not_implemented', 'implemented_not_wired', 'verified_source_test', 'external_gate']);
const HASH = /^[a-f0-9]{64}$/i;

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  return result;
}

export function validateCapabilityStatusRecord(record) {
  const id = requiredText(record?.id, 'capability id');
  const status = requiredText(record?.status, 'capability status');
  if (!STATUSES.has(status)) throw new TypeError(`Unsupported capability status: ${status}`);
  const acceptance = record.acceptance ?? {};
  if (status === 'implemented_not_wired' || status === 'verified_source_test') {
    requiredText(acceptance.entrypoint, 'acceptance entrypoint');
    requiredText(acceptance.exactTest, 'acceptance exact test');
  }
  if (status === 'verified_source_test') {
    if (!HASH.test(String(acceptance.evidence?.entrypointSha256 ?? ''))) throw new TypeError('verified capability requires entrypoint SHA-256');
    if (!HASH.test(String(acceptance.evidence?.exactTestSha256 ?? ''))) throw new TypeError('verified capability requires exact test SHA-256');
    if (!HASH.test(String(acceptance.replayReceiptSha256 ?? ''))) throw new TypeError('verified capability requires replay receipt SHA-256');
  }
  return Object.freeze({ id, status, countsAsVerified: status === 'verified_source_test', productionWiringRequired: status === 'implemented_not_wired' });
}

export function validateCapabilityTransition({ from, to, productionWired = false, replayReceiptSha256 = null } = {}) {
  if (!STATUSES.has(from) || !STATUSES.has(to)) throw new TypeError('known capability transition states are required');
  if (to === 'verified_source_test') {
    if (productionWired !== true) throw new Error('Verified promotion requires production wiring');
    if (!HASH.test(String(replayReceiptSha256 ?? ''))) throw new Error('Verified promotion requires replay receipt SHA-256');
  }
  if (from === 'external_gate' && to === 'verified_source_test' && productionWired !== true) throw new Error('External gate cannot be bypassed without production wiring');
  return Object.freeze({ allowed: true, from, to, productionWired, replayReceiptSha256 });
}
