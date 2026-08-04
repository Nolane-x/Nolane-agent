const COUNTS = Object.freeze({
  '2.20.0': Object.freeze({ verified_source_test: 759, partial: 7, external_gate: 56, not_implemented: 328 }),
  '2.21.0': Object.freeze({ verified_source_test: 768, partial: 25, external_gate: 56, not_implemented: 301 }),
  '2.22.0': Object.freeze({ verified_source_test: 774, partial: 37, external_gate: 56, not_implemented: 283 }),
  '2.23.0': Object.freeze({ verified_source_test: 786, partial: 43, external_gate: 56, not_implemented: 265 }),
  '2.24.0': Object.freeze({ verified_source_test: 805, partial: 54, external_gate: 56, not_implemented: 235 }),
  '2.25.0': Object.freeze({ verified_source_test: 829, partial: 66, external_gate: 56, not_implemented: 199 }),
  '2.26.0': Object.freeze({ verified_source_test: 854, partial: 77, external_gate: 56, not_implemented: 163 }),
  '2.27.0': Object.freeze({ verified_source_test: 883, partial: 96, external_gate: 56, not_implemented: 115 }),
  '2.28.0': Object.freeze({ verified_source_test: 907, partial: 105, external_gate: 59, not_implemented: 79 }),
  '2.29.0': Object.freeze({ verified_source_test: 936, partial: 112, external_gate: 59, not_implemented: 43 }),
  '3.0.0': Object.freeze({ verified_source_test: 959, partial: 115, external_gate: 63, not_implemented: 13 }),
  '3.1.0': Object.freeze({ verified_source_test: 972, partial: 115, external_gate: 63, not_implemented: 0 }),
  '3.2.0': Object.freeze({ verified_source_test: 985, partial: 102, external_gate: 63, not_implemented: 0 }),
  '3.3.0': Object.freeze({ verified_source_test: 996, partial: 91, external_gate: 63, not_implemented: 0 }),
  '3.4.0': Object.freeze({ verified_source_test: 1017, partial: 70, external_gate: 63, not_implemented: 0 }),
  '3.5.0': Object.freeze({ verified_source_test: 1028, partial: 59, external_gate: 63, not_implemented: 0 }),
  '4.0.0': Object.freeze({ verified_source_test: 1081, partial: 0, external_gate: 69, not_implemented: 0 }),
});

export function expectedFrontierAuditCounts(version) {
  const normalized = String(version ?? '');
  const exact = COUNTS[normalized];
  if (exact) return { ...exact };
  const match = /^(\d+)\.(\d+)\./.exec(normalized);
  if (!match) throw new TypeError(`unsupported frontier audit version: ${normalized}`);
  const canonical = `${match[1]}.${match[2]}.0`;
  const counts = COUNTS[canonical];
  if (!counts) throw new RangeError(`unsupported frontier audit version: ${normalized}`);
  return { ...counts };
}

export function knownFrontierAuditVersions() { return Object.freeze(Object.keys(COUNTS)); }
