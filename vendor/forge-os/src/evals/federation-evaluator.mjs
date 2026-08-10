import { canonicalSha256 } from '../core/canonical-json.mjs';
import { clusterProviders } from '../federation/deduplicator.mjs';

function ageDays(date,now){const time=Date.parse(date??'');return Number.isFinite(time)?Math.max(0,(now-time)/86400000):Infinity;}
export function evaluateFederatedProvider({provider,capability,scanReceipt,baseline,candidate,now=Date.now(),maxAgeDays=30}){
  const findings=[];const blocker=(code,message)=>findings.push({code,severity:'blocker',message});const warning=(code,message)=>findings.push({code,severity:'warning',message});
  if(!provider?.providerDigest)blocker('missing-provider-digest','Provider is not content-addressed');
  if(scanReceipt?.status!=='pass'||scanReceipt.providerDigest!==provider?.providerDigest)blocker('scan-missing-or-stale','Current passing scan receipt is required');
  if(ageDays(provider?.observedAt??provider?.importedAt,now)>maxAgeDays)blocker('source-stale',`Provider metadata is older than ${maxAgeDays} days`);
  if(provider?.trust?.blockers?.length)blocker('trust-blockers','Provider has unresolved trust blockers');
  if(capability&&provider?.capabilityId!==capability.capabilityId&&!(provider?.capabilityIds??[]).includes(capability.capabilityId))blocker('capability-mismatch','Provider does not match evaluated capability');
  if(baseline&&candidate){if(candidate.passRate<baseline.passRate)blocker('quality-regression','Candidate pass rate is below baseline');if(candidate.quality<baseline.quality)blocker('quality-regression','Candidate quality is below baseline');if(candidate.tokens>baseline.tokens*1.5&&candidate.quality<=baseline.quality)warning('token-inflation','Candidate uses substantially more tokens without quality gain');}
  const status=findings.some(f=>f.severity==='blocker')?'fail':'pass';const receipt={schemaVersion:1,type:'federation-provider-evaluation',providerId:provider?.providerId??null,providerDigest:provider?.providerDigest??null,capabilityId:capability?.capabilityId??provider?.capabilityId??null,status,findings,metrics:{baseline:baseline??null,candidate:candidate??null},evaluatedAt:new Date(now).toISOString()};return Object.freeze({...receipt,receiptSha256:canonicalSha256(receipt)});
}
export function auditFederationGraph({capabilities=[],providers=[],sources=[],knowledgePacks=[],now=Date.now()}){
  const clusters=clusterProviders(providers);
  const duplicateClusters=clusters.filter(c=>c.providers.length>1).map(c=>({signature:c.key??c.signature,providerIds:c.providers.map(p=>p.providerId)}));
  const capabilityIds=new Set(capabilities.map(c=>c.capabilityId));
  const expand=(provider)=>provider.capabilityIds?.length?provider.capabilityIds:[provider.capabilityId];
  const providerCapabilities=new Set(providers.flatMap(expand));
  const knowledgeCapabilities=new Set(providers.filter(p=>p.kind==='knowledge'&&['stable','candidate'].includes(p.status)).flatMap(expand));
  const proceduralCapabilities=new Set(providers.filter(p=>p.kind==='skill'&&['stable','candidate'].includes(p.status)).flatMap(expand));
  const stableProceduralCapabilities=new Set(providers.filter(p=>p.kind==='skill'&&p.status==='stable').flatMap(expand));
  const missingProviders=[...capabilityIds].filter(id=>!providerCapabilities.has(id));
  const missingKnowledgeProviders=[...capabilityIds].filter(id=>!knowledgeCapabilities.has(id));
  const missingProceduralProviders=[...capabilityIds].filter(id=>!proceduralCapabilities.has(id));
  const missingStableProceduralProviders=[...capabilityIds].filter(id=>!stableProceduralCapabilities.has(id));
  const staleProviders=providers.filter(p=>p.builtIn!==true&&ageDays(p.observedAt??p.importedAt,now)>30).map(p=>p.providerId);
  const blockers=providers.flatMap(p=>(p.trust?.blockers??[]).map(code=>({providerId:p.providerId,code})));
  const sourceIds=new Set(sources.map(s=>s.id));
  const unresolvedSources=providers.filter(p=>!sourceIds.has(p.sourceId)).map(p=>p.providerId);
  const packIds=new Set(knowledgePacks.map(p=>p.id));
  const missingKnowledge=capabilities.filter(c=>!packIds.has(c.knowledgePackId)).map(c=>c.capabilityId);
  const firstPartySkills=providers.filter(p=>p.builtIn===true&&p.kind==='skill');
  const externalProviders=providers.filter(p=>p.builtIn!==true);
  return{
    schemaVersion:2,generatedAt:new Date(now).toISOString(),
    summary:{capabilityCount:capabilities.length,providerCount:providers.length,sourceCount:sources.length,knowledgePackCount:knowledgePacks.length,duplicateClusterCount:duplicateClusters.length,missingProviderCount:missingProviders.length,missingKnowledgeProviderCount:missingKnowledgeProviders.length,missingProceduralProviderCount:missingProceduralProviders.length,missingStableProceduralProviderCount:missingStableProceduralProviders.length,staleProviderCount:staleProviders.length,blockerCount:blockers.length,missingKnowledgeCount:missingKnowledge.length},
    duplicateClusters,missingProviders,missingKnowledgeProviders,missingProceduralProviders,missingStableProceduralProviders,staleProviders,blockers,unresolvedSources,missingKnowledge,
    claims:{firstPartySkills:firstPartySkills.length,stableFirstPartySkills:firstPartySkills.filter(p=>p.status==='stable').length,candidateFirstPartySkills:firstPartySkills.filter(p=>p.status==='candidate').length,federatedCapabilities:capabilities.length,builtInProviderMappings:providers.filter(p=>p.builtIn===true).length,knowledgeProviderMappings:providers.filter(p=>p.builtIn===true&&p.kind==='knowledge').length,externalProvidersImported:externalProviders.length}
  };
}
