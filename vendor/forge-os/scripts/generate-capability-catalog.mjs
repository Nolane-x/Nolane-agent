import { mkdir, writeFile } from 'node:fs/promises';
import { CAPABILITY_DOMAINS, CAPABILITY_OPERATIONS } from '../config/capability-domains.mjs';
import { normalizeCapability } from '../src/federation/contracts.mjs';

const output=[];
for (const domain of CAPABILITY_DOMAINS) {
  let previous='confirmed-intent';
  for (let ordinal=0; ordinal<CAPABILITY_OPERATIONS.length; ordinal++) {
    const [key,label,artifact,evidence,riskClass] = CAPABILITY_OPERATIONS[ordinal];
    const produces = `${domain.id}.${artifact}`;
    const tool = key === 'audit-accessibility' ? ['browser'] : key.includes('test') ? domain.tools.slice(0,2) : domain.tools.slice(0,1);
    const topics = [...new Set([
      domain.topics[ordinal % domain.topics.length],
      domain.topics[(ordinal + 3) % domain.topics.length],
      domain.topics[(ordinal + 6) % domain.topics.length],
      key.replaceAll('-',' '),
    ])];
    const record = normalizeCapability({
      capabilityId:`${domain.id}.${key}`, title:`${label} for ${domain.label}`, domain:domain.id,
      discipline:key, intentSignals:[`${label.toLowerCase()} ${domain.label.toLowerCase()}`, ...topics],
      consumes:[previous], produces:[produces], evidence:[`${domain.id}.${evidence}`, `${domain.id}.independent-review`],
      riskClass, knowledgeTopics:topics, requiredTools:tool, conflictTags:[`${domain.id}.active-output`,`${key}.policy`],
      preferredSourceIds:domain.sources, knowledgePackId:`knowledge-pack.${domain.id}`, knowledgeSourceIds:domain.sources.filter((id) => !['forgeos-local','superpowers'].includes(id)),
      mcpCapabilities:domain.tools.map((item) => `tool.${item}`), qualityDimensions:[domain.topics[0],domain.topics[1],'traceability','verification'],
      dependencies:ordinal === 0 ? [] : [`${domain.id}.${CAPABILITY_OPERATIONS[ordinal-1][0]}`],
      deliveryModel:'federated-resolution', phase:key, ordinal,
      providerPolicy:{minimumTrust:riskClass === 'critical' ? 85 : riskClass === 'high' ? 75 : 60, allowLinkOnly:true, preferLocal:true},
      contextBudget:1200 + ordinal * 40,
    });
    output.push(record); previous=produces;
  }
}
await mkdir('capabilities',{recursive:true});
await writeFile('capabilities/catalog.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Generated ${output.length} federated capabilities.`);
