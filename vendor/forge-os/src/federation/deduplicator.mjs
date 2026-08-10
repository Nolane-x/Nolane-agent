import { canonicalSha256 } from '../core/canonical-json.mjs';
const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
const sorted = (values) => [...new Set((values ?? []).map(normalize).filter(Boolean))].sort();

export function capabilitySignature(record) {
  return canonicalSha256({
    domain: normalize(record.domain), consumes: sorted(record.consumes), produces: sorted(record.produces),
    knowledgeTopics: sorted(record.knowledgeTopics), requiredTools: sorted(record.requiredTools), conflictTags: sorted(record.conflictTags),
  });
}

export function clusterProviders(records) {
  const groups = new Map();
  for (const record of records ?? []) {
    const key = record.semanticKey ?? canonicalSha256({ capabilityId: normalize(record.capabilityId), kind: normalize(record.kind), materialType: normalize(record.material?.type), tools: sorted(record.compatibility?.tools), conflictTags: sorted(record.conflicts) });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([key, providers]) => ({ key, providers:[...providers].sort((a,b) => a.providerId.localeCompare(b.providerId)) }));
}
