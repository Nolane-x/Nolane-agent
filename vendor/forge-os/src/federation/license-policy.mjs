const VENDOR_ALLOWED = new Set(['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','ISC','CC0-1.0']);
const LINK_ONLY = new Set(['Proprietary','Source-available','Mixed','MIXED']);

export function classifyLicense({ declared, files = [] } = {}) {
  const candidates = [declared, ...files.map((file) => file.spdx)].filter(Boolean);
  const unique = [...new Set(candidates.map(String))];
  if (unique.length !== 1) return { spdx: unique.length ? unique.sort().join(' OR ') : 'UNKNOWN', mode: 'link-only', ambiguous: true };
  const spdx = unique[0];
  if (VENDOR_ALLOWED.has(spdx)) return { spdx, mode: 'vendor-allowed', ambiguous: false };
  if (LINK_ONLY.has(spdx)) return { spdx, mode: 'link-only', ambiguous: false };
  return { spdx, mode: 'link-only', ambiguous: true };
}
