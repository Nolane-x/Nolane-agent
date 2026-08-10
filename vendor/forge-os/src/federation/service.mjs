import { loadFederationSources } from './source-registry.mjs';
import { loadCapabilityCatalog, searchCapabilities } from './capability-catalog.mjs';
import { normalizeProviderRecord } from './contracts.mjs';
import { scanSkillPackage } from './security-scanner.mjs';
import { assessMcpServer } from './mcp-assessor.mjs';
import { compileCapabilityExecutionBundle } from './resolver.mjs';
import { issueFederationApproval, promoteProvider, quarantineProvider } from './promotion.mjs';
import { authorizeFederationAction } from '../policy/federation-policy.mjs';
import { principalRecord } from '../core/principals.mjs';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { materializeCapabilityBundle } from './materializer.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBuiltInProviders, seedBuiltInProviders } from './local-provider-seed.mjs';
import { assessSkillIntake } from './skill-intake.mjs';

const DEFAULT_MATERIALIZATION_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function scopedProviderId(tenantId, providerId){
  const tenantHash=canonicalSha256(String(tenantId)).slice(0,12);
  const prefix=`tenant-${tenantHash}.`;
  if(prefix.length+providerId.length<=160)return `${prefix}${providerId}`;
  return `${prefix}${providerId.slice(0,110)}.${canonicalSha256(providerId).slice(0,16)}`;
}
function visibleToTenant(provider,tenantId){return provider.builtIn===true||provider.tenantId==='global'||provider.tenantId===tenantId;}
function assertMutableProvider(provider,tenantId,principal){
  if(provider.builtIn===true||provider.tenantId==='global'){
    if(principal?.type!=='system'||!principal.scopes?.includes('*'))throw new Error('Built-in federation providers are immutable outside the system release workflow');
    return;
  }
  if(provider.tenantId!==tenantId)throw new Error('Provider is not owned by this tenant');
}

export class FederationService {
  constructor({catalogStore,mcpRegistryClient=null,mcpBroker=null,evaluationStore=null,policyDecisionPoint=null,sourcesLoader=loadFederationSources,capabilityLoader=loadCapabilityCatalog,builtInProviderLoader=loadBuiltInProviders,materializationRoot=DEFAULT_MATERIALIZATION_ROOT}){
    if(!catalogStore) throw new TypeError('catalogStore is required');this.store=catalogStore;this.mcp=mcpRegistryClient;this.mcpBroker=mcpBroker;this.evaluations=evaluationStore;this.pdp=policyDecisionPoint;this.sourcesLoader=sourcesLoader;this.capabilityLoader=capabilityLoader;this.builtInProviderLoader=builtInProviderLoader;this.materializationRoot=path.resolve(materializationRoot);this.synchronizer=null;this.approvals=new Map();this.initialized=null;
  }
  async #ensure(){if(!this.initialized)this.initialized=(async()=>{await this.store.initialize();if(this.builtInProviderLoader&&typeof this.store.seedProviders==='function')await seedBuiltInProviders(this.store,await this.builtInProviderLoader());return this.store.read();})();await this.initialized;}
  async #providerList({capabilityId=null,status=null,tenantId=null}={}){await this.#ensure();const state=await this.store.read();return state.providers.filter(p=>(!tenantId||visibleToTenant(p,tenantId))&&(!capabilityId||p.capabilityId===capabilityId)&&(!status||p.status===status));}
  async #auditReport(providers,state){const [sources,capabilities]=await Promise.all([this.listSources(),this.capabilityLoader()]);const statusCounts={};for(const p of providers)statusCounts[p.status]=(statusCounts[p.status]??0)+1;return{sourceCount:sources.length,capabilityCount:capabilities.length,providerCount:providers.length,builtInProviderCount:providers.filter(p=>p.builtIn===true).length,externalProviderCount:providers.filter(p=>p.builtIn!==true).length,proceduralProviderCount:providers.filter(p=>p.kind==='skill').length,knowledgeProviderCount:providers.filter(p=>p.kind==='knowledge').length,statusCounts,catalogRevision:state.revision,blockerCount:providers.reduce((n,p)=>n+(p.trust?.blockers?.length??0),0)};}
  async initialize(){await this.#ensure();return this.status();}
  async listSources({kind=null,authority=null}={}){return (await this.sourcesLoader()).filter(s=>(!kind||s.kind===kind)&&(!authority||s.authority===authority));}
  async searchCapabilities({query,domain=null,tools=[],limit=20}){return searchCapabilities(await this.capabilityLoader(),query,{domain,tools,limit});}
  async getCapability(capabilityId){const item=(await this.capabilityLoader()).find(c=>c.capabilityId===capabilityId);if(!item)throw new Error(`Unknown capability: ${capabilityId}`);return item;}
  async listProviders({capabilityId=null,status=null,tenantId=null}={}, {principal}={}){if(!tenantId)throw new TypeError('tenantId is required for provider listing');const auth=authorizeFederationAction({principal,tenantId,action:'provider.read'});if(!auth.allow)throw new Error(auth.reason);return this.#providerList({capabilityId,status,tenantId});}
  async loadProvidersForTenant(tenantId){if(!tenantId)throw new TypeError('tenantId is required');return this.#providerList({tenantId});}
  async importProvider(input,{principal,tenantId}){await this.#ensure();
    const auth=authorizeFederationAction({principal,tenantId,action:'source.add',provider:{riskClass:input.riskClass??'medium'}});if(!auth.allow)throw new Error(auth.reason);
    const originalProviderId=String(input.providerId);
    const provider=normalizeProviderRecord({...input,providerId:scopedProviderId(tenantId,originalProviderId),status:'quarantined'});
    const stored={...provider,tenantId,originalProviderId,material:structuredClone(input.material??{files:[]}),importedBy:principalRecord(principal),importedAt:new Date().toISOString()};
    await this.store.importProvider(stored);return stored;
  }
  async intakeSkillBundle(input,{principal,tenantId}){
    const source=input?.source??{};
    const intake=assessSkillIntake({source,files:input?.files,existingContentDigests:(await this.#providerList({tenantId})).map((provider)=>provider.contentDigest)});
    if(intake.status==='duplicate')throw new Error('Duplicate skill content is already imported for this tenant');
    const blockers=intake.findings.filter((item)=>item.severity==='blocker').map((item)=>item.code);
    const imported=await this.importProvider({
      providerId:input?.providerId,capabilityId:input?.capabilityId,sourceId:source.sourceId,sourceCoordinate:source.sourceCoordinate,contentDigest:intake.contentDigest,
      kind:'skill',title:input?.title,license:intake.license,trust:{score:intake.status==='candidate'?40:0,blockers},compatibility:input?.compatibility??{agents:['*'],tools:[]},riskClass:input?.riskClass??'medium',
      material:{type:'external-agent-skill-intake-v1',files:structuredClone(input?.files??[]),intake:structuredClone(intake),source:{sourceId:source.sourceId,sourceCoordinate:source.sourceCoordinate,snapshotSha256:source.snapshotSha256,license:source.license,permissions:source.permissions??[]}},
    },{principal,tenantId});
    const scanned=await this.scanProvider(imported.providerId,{tenantId,principal});
    return {provider:scanned.provider,intake};
  }
  async scanProvider(providerId,{tenantId=null,principal=null}={}){await this.#ensure();const state=await this.store.read();const provider=state.providers.find(p=>p.providerId===providerId&&(!tenantId||visibleToTenant(p,tenantId)));if(!provider)throw new Error(`Unknown provider for tenant: ${providerId}`);
    if(tenantId){assertMutableProvider(provider,tenantId,principal);const auth=authorizeFederationAction({principal,tenantId,action:'source.add',provider:{riskClass:provider.riskClass??'medium'}});if(!auth.allow)throw new Error(auth.reason);}
    const report=provider.kind==='mcp'?assessMcpServer(provider.material?.server??{}, {sourceAuthority:provider.material?.sourceAuthority}):scanSkillPackage(provider.material?.files??[],{sourceId:provider.sourceId});
    const scanReceipt={id:`scan_${provider.providerDigest.slice(0,24)}`,status:report.blocked||report.status==='quarantined'?'fail':'pass',providerDigest:provider.providerDigest,at:new Date().toISOString(),report};
    const next=(report.blocked||report.status==='quarantined')?quarantineProvider(provider,{code:report.blockers?.[0]??report.findings?.[0]?.code??'scan-blocked',report}):{...provider,scanReceipt};
    await this.store.replaceProvider({...next,scanReceipt});return {provider:next,scanReceipt};
  }
  async requestProviderApproval({providerId,targetStatus,tenantId},{principal}){const auth=authorizeFederationAction({principal,tenantId,action:'provider.promote',provider:{riskClass:'medium'}});if(!auth.allow)throw new Error(auth.reason);const provider=(await this.#providerList({tenantId})).find(p=>p.providerId===providerId);if(!provider)throw new Error(`Unknown provider: ${providerId}`);assertMutableProvider(provider,tenantId,principal);const issued=issueFederationApproval(provider,targetStatus,principal);this.approvals.set(issued.record.id,issued.record);return {approval:{...issued.record,token:issued.token}};}
  async promote({providerId,targetStatus,approvalId,approvalToken,evaluationReceiptId,tenantId},{principal}){const provider=(await this.#providerList({tenantId})).find(p=>p.providerId===providerId);if(!provider)throw new Error(`Unknown provider: ${providerId}`);assertMutableProvider(provider,tenantId,principal);const auth=authorizeFederationAction({principal,tenantId,action:'provider.promote',provider:{riskClass:provider.riskClass??'medium'}});if(!auth.allow)throw new Error(auth.reason);if(this.pdp){const external=await this.pdp.decide({principal:{id:principal.id,type:principal.type,roles:principal.roles,scopes:principal.scopes,trustDomain:principal.trustDomain},action:'provider.promote',resource:{tenantId,providerId,targetStatus,providerDigest:provider.providerDigest}});if(!external.allow)throw new Error(`External policy denied promotion: ${external.reason}`);}if(!this.evaluations)throw new Error('Trusted federation evaluation store is not configured');const evaluationReceipt=await this.evaluations.get(evaluationReceiptId);const approval=this.approvals.get(approvalId);const promoted=promoteProvider(provider,{targetStatus,approval,token:approvalToken,principal,scanReceipt:provider.scanReceipt,evaluationReceipt});await this.store.replaceProvider(promoted);this.approvals.delete(approvalId);return promoted;}
  async resolve({capabilityId,tenantId=null,agent='generic',tools=[],allowExternal=false,activeProviders=[],assurance='A1'},{principal}={}){const auth=authorizeFederationAction({principal,tenantId,action:'provider.read'});if(!auth.allow)throw new Error(auth.reason);const capability=await this.getCapability(capabilityId);return compileCapabilityExecutionBundle(capability,{agent,tools,allowExternal,activeProviders,assurance},await this.#providerList({tenantId}));}
  async materialize({bundle,tenantId,maxBytes=256000},{principal}){
    const auth=authorizeFederationAction({principal,tenantId,action:'provider.read'});if(!auth.allow)throw new Error(auth.reason);
    return materializeCapabilityBundle(bundle,{providers:await this.#providerList({tenantId}),root:this.materializationRoot,maxBytes});
  }
  async searchMcp({query,limit=20,cursor=null}){if(!this.mcp)throw new Error('Official MCP Registry client is not configured');return this.mcp.search({query,limit,cursor});}
  assessMcp(server,input={}){return assessMcpServer(server,input);}
  setMcpBroker(broker){this.mcpBroker=broker;return this;}
  setSynchronizer(synchronizer){this.synchronizer=synchronizer;return this;}
  async syncSource(sourceId,{tenantId},{principal}){
    if(!this.synchronizer)throw new Error('Federation source synchronizer is not configured');
    const auth=authorizeFederationAction({principal,tenantId,action:'source.sync',provider:{riskClass:'high'}});
    if(!auth.allow)throw new Error(auth.reason);
    return this.synchronizer.sync(sourceId,{tenantId},{principal});
  }
  async executeMcp(input,context){if(!this.mcpBroker)throw new Error('MCP execution broker is not configured');return this.mcpBroker.execute(input,context);}
  async audit({tenantId}={}, {principal}={}){if(!tenantId)throw new TypeError('tenantId is required for federation audit');const auth=authorizeFederationAction({principal,tenantId,action:'provider.read'});if(!auth.allow)throw new Error(auth.reason);await this.#ensure();const state=await this.store.read();return this.#auditReport(state.providers.filter((provider)=>visibleToTenant(provider,tenantId)),state);}
  async status(){await this.#ensure();const state=await this.store.read();const report=await this.#auditReport(state.providers,state);const storeHealth=typeof this.store.health==='function'?await this.store.health():{ok:true};return{...report,healthy:Boolean(storeHealth.ok),store:storeHealth};}
  close(){try{this.store.close?.();}catch{}try{this.evaluations?.close?.();}catch{}}
}
