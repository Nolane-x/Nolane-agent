import { createHash } from 'node:crypto';

function canonicalEvidenceBytes(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  if (bytes.includes(0)) return bytes;
  const text = bytes.toString('utf8');
  if (text.includes('\uFFFD') || !Buffer.from(text, 'utf8').equals(bytes)) return bytes;
  return Buffer.from(text.replaceAll('\r\n', '\n'), 'utf8');
}

export function evidenceFileSha256(value) {
  return createHash('sha256').update(canonicalEvidenceBytes(value)).digest('hex');
}
