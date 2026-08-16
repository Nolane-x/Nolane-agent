export const PERFECTION_STATUSES = Object.freeze([
  'PASS',
  'FAIL',
  'UNKNOWN',
  'BLOCKED',
  'NOT_APPLICABLE',
  'DEFERRED_WITH_REASON',
]);

export const PERFECTION_EVIDENCE_CLASSES = Object.freeze([
  'SRC',
  'INT',
  'DOM',
  'VIS',
  'A11Y',
  'PERF',
  'OS',
  'MANUAL',
  'PROVIDER',
  'RELEASE',
]);

const STATUS_SET = new Set(PERFECTION_STATUSES);
const EVIDENCE_SET = new Set(PERFECTION_EVIDENCE_CLASSES);
const EXACT_GIT_SHA_RE = /^[0-9a-f]{40}$/;

function normalizeEvidence(evidence = []) {
  if (!Array.isArray(evidence)) throw new TypeError('evidence must be an array');
  return evidence.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new TypeError(`evidence[${index}] must be an object`);
    const evidenceClass = String(entry.class ?? '').trim();
    const ref = String(entry.ref ?? '').trim();
    if (!EVIDENCE_SET.has(evidenceClass)) {
      throw new Error(`unsupported evidence class: ${evidenceClass || '<empty>'}`);
    }
    if (!ref) throw new Error(`evidence[${index}] requires ref`);
    return Object.freeze({ class: evidenceClass, ref });
  });
}

export function normalizePerfectionObservation(observation, { knownIds } = {}) {
  if (!observation || typeof observation !== 'object') throw new TypeError('observation must be an object');
  const id = String(observation.id ?? '').trim();
  const status = String(observation.status ?? '').trim();
  const revision = String(observation.revision ?? '').trim();
  const notes = String(observation.notes ?? '').trim();
  const evidence = normalizeEvidence(observation.evidence ?? []);

  if (!/^PFX-[A-Z]+-\d{3}$/.test(id)) throw new Error(`invalid perfection id: ${id || '<empty>'}`);
  if (knownIds && !knownIds.has(id)) throw new Error(`unknown perfection id: ${id}`);
  if (!STATUS_SET.has(status)) throw new Error(`unsupported perfection status: ${status || '<empty>'}`);

  if (status === 'PASS') {
    if (evidence.length === 0) throw new Error(`${id}: PASS requires evidence`);
    if (!EXACT_GIT_SHA_RE.test(revision)) throw new Error(`${id}: PASS requires exact 40-character Git revision`);
  }

  if ((status === 'NOT_APPLICABLE' || status === 'DEFERRED_WITH_REASON') && !notes) {
    throw new Error(`${id}: ${status} requires notes`);
  }

  if (revision && !EXACT_GIT_SHA_RE.test(revision)) {
    throw new Error(`${id}: revision must be an exact 40-character Git revision when present`);
  }

  return Object.freeze({ id, status, evidence, revision, notes });
}

export function buildPerfectionMatrix({ catalog, observations = [] }) {
  if (!catalog?.ids || !(catalog.ids instanceof Map)) throw new TypeError('catalog.ids must be a Map');
  const knownIds = new Set(catalog.ids.keys());
  const observed = new Map();

  for (const raw of observations) {
    const item = normalizePerfectionObservation(raw, { knownIds });
    if (observed.has(item.id)) throw new Error(`duplicate perfection observation: ${item.id}`);
    observed.set(item.id, item);
  }

  const items = [...catalog.ids.keys()].sort().map((id) => observed.get(id) ?? Object.freeze({
    id,
    status: 'UNKNOWN',
    evidence: [],
    revision: '',
    notes: '',
  }));

  const counts = Object.fromEntries(PERFECTION_STATUSES.map((status) => [status, 0]));
  for (const item of items) counts[item.status] += 1;

  return Object.freeze({
    schema: 'nolane.product-perfection.matrix.v1',
    total: items.length,
    counts: Object.freeze(counts),
    items: Object.freeze(items),
  });
}
