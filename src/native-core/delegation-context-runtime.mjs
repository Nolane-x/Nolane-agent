import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);
const unsafe = /(^|\/)(\.env(?:\.|$)|\.git(?:\/|$)|.*\.(?:pem|key|p12|pfx)$)/i;
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
export class DelegationContextRuntime {
  constructor({ maxBytes = 64_000 } = {}) { this.maxBytes = Math.max(128, Math.min(1_000_000, Number(maxBytes) || 64_000)); }
  build({ objective, parentSummary = '', files = [], evidence = [] } = {}) {
    const omissions = [];
    const safeFiles = files.map(String).filter((file) => { const ok = !file.startsWith('/') && !file.startsWith('../') && !file.includes('/../') && !unsafe.test(file); if (!ok) omissions.push({ kind: 'file', value: file }); return ok; });
    let summary = String(parentSummary ?? '');
    let keptEvidence = evidence.map((row) => ({ id: String(row?.id ?? ''), summary: String(row?.summary ?? '').slice(0, 1_000) })).filter((row) => row.id);
    const build = () => ({ schema: 'nolane.delegation-context.v1', objective: String(objective ?? ''), parentSummary: summary, files: safeFiles, evidence: keptEvidence, omissions });
    while (bytes(build()) > this.maxBytes && summary.length > 0) { const removed = Math.max(1, Math.ceil(summary.length / 4)); summary = summary.slice(0, Math.max(0, summary.length - removed)); if (!omissions.some((x) => x.kind === 'parent-summary')) omissions.push({ kind: 'parent-summary', reason: 'byte-budget' }); }
    while (bytes(build()) > this.maxBytes && keptEvidence.length) { omissions.push({ kind: 'evidence', value: keptEvidence.at(-1).id, reason: 'byte-budget' }); keptEvidence = keptEvidence.slice(0, -1); }
    let value = build();
    if (bytes(value) > this.maxBytes) {
      value = { schema: value.schema, objective: String(objective ?? '').slice(0, 32), parentSummary: '', files: safeFiles, evidence: [], omissions: ['content-truncated'] };
    }
    if (bytes(value) > this.maxBytes) {
      value = { objective: String(objective ?? '').slice(0, 24), files: safeFiles, omissions: ['truncated'] };
    }
    const byteLength = bytes(value); const base = { ...value, byteLength };
    return freeze({ ...base, files: freeze([...base.files]), evidence: freeze([...base.evidence]), omissions: freeze([...base.omissions]), receiptSha256: sha256(JSON.stringify(base)) });
  }
}
