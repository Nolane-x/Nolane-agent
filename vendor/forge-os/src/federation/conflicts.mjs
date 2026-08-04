function pairs(values) { const out=[]; for(let i=0;i<values.length;i++) for(let j=i+1;j<values.length;j++) out.push([values[i],values[j]]); return out; }
export function detectProviderConflicts(records) {
  const findings=[];
  for (const [a,b] of pairs(records ?? [])) {
    if (a.capabilityId !== b.capabilityId) continue;
    const ownership = (a.outputOwnership ?? []).filter((item) => (b.outputOwnership ?? []).includes(item));
    if (ownership.length) findings.push({code:'output-ownership-conflict',providers:[a.providerId,b.providerId],items:ownership});
    for (const tool of Object.keys(a.toolVersions ?? {})) if (b.toolVersions?.[tool] && b.toolVersions[tool] !== a.toolVersions[tool]) findings.push({code:'tool-version-conflict',providers:[a.providerId,b.providerId],tool,versions:[a.toolVersions[tool],b.toolVersions[tool]]});
    if ((a.policyTags ?? []).includes('strict') && (b.policyTags ?? []).includes('permissive') || (b.policyTags ?? []).includes('strict') && (a.policyTags ?? []).includes('permissive')) findings.push({code:'policy-conflict',providers:[a.providerId,b.providerId]});
  }
  return findings;
}
