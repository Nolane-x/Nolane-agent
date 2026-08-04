import { createHash } from 'node:crypto';

export function stableForensicId(namespace, value) {
  if (typeof namespace !== 'string' || !/^[a-z][a-z0-9-]*$/.test(namespace)) throw new TypeError('Forensic ID namespace must be kebab-case');
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('Forensic ID value is required');
  return `${namespace}-${createHash('sha256').update(`${namespace}\0${value}`).digest('hex').slice(0, 24)}`;
}
