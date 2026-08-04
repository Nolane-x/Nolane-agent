import path from 'node:path';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { assertSafeFederationUrl } from './canonical-source.mjs';
import { discoverAgentSkills, filesForSkillRoot } from './adapters/agent-skills-repo.mjs';
import { discoverSkillsCli } from './adapters/skills-cli-repo.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const SAFE_PATH=/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/@+-]+(?:\/[A-Za-z0-9._/@+-]+)*$/;
function githubRepo(url){const parsed=new URL(assertSafeFederationUrl(url));if(parsed.hostname!=='github.com')throw new Error('GitHubRepositoryFetcher only accepts github.com repositories');const parts=parsed.pathname.replace(/^\/|\/$/g,'').split('/');if(parts.length<2)throw new Error('GitHub repository URL must include owner and repository');return{owner:parts[0],repo:parts[1].replace(/\.git$/,'')};}
function responseError(response,label){if(!response?.ok)throw new Error(`${label} failed: ${response?.status??'unknown'}`);return response;}
function wantedFiles(tree){
  const skills=tree.filter((item)=>item.type==='blob'&&(item.path==='SKILL.md'||item.path.endsWith('/SKILL.md'))&&SAFE_PATH.test(item.path));
  const dirs=skills.map((item)=>path.posix.dirname(item.path)==='.'?'':path.posix.dirname(item.path));
  return tree
    .filter((item)=>item.type==='blob'&&SAFE_PATH.test(item.path)&&Number(item.size??0)<=1_000_000&&(dirs.some((dir)=>dir?item.path===`${dir}/SKILL.md`||item.path.startsWith(`${dir}/`):item.path==='SKILL.md')||/^LICENSE(?:\.|$)/i.test(item.path)))
    .sort((a,b)=>{
      const aManifest=a.path==='SKILL.md'||a.path.endsWith('/SKILL.md');
      const bManifest=b.path==='SKILL.md'||b.path.endsWith('/SKILL.md');
      if(aManifest!==bManifest)return aManifest?-1:1;
      return a.path.localeCompare(b.path);
    });
}

export class GitHubRepositoryFetcher{
  constructor({fetchImpl=globalThis.fetch,maxFiles=1000,maxBytes=5_000_000,apiBase='https://api.github.com'}={}){if(typeof fetchImpl!=='function')throw new TypeError('fetchImpl is required');this.fetchImpl=fetchImpl;this.maxFiles=maxFiles;this.maxBytes=maxBytes;this.apiBase=assertSafeFederationUrl(apiBase);}
  async #json(url){const response=responseError(await this.fetchImpl(url,{headers:{accept:'application/vnd.github+json','user-agent':'forgeos-federation/0.4'}}),'GitHub request');return response.json();}
  async fetch(source){const {owner,repo}=githubRepo(source.url);let revision=source.revision;if(revision==='resolve-on-sync'){revision=(await this.#json(`${this.apiBase}/repos/${owner}/${repo}/commits/HEAD`)).sha;}else if(revision.startsWith('commit:'))revision=revision.slice(7);else if(!SHA40.test(revision))revision=(await this.#json(`${this.apiBase}/repos/${owner}/${repo}/commits/${encodeURIComponent(revision.replace(/^release:/,''))}`)).sha;if(!SHA40.test(revision))throw new Error('GitHub source did not resolve to a 40-character commit SHA');const treePayload=await this.#json(`${this.apiBase}/repos/${owner}/${repo}/git/trees/${revision}?recursive=1`);if(treePayload.truncated)throw new Error('GitHub tree is truncated; refuse incomplete federation snapshot');const selected=wantedFiles(treePayload.tree??[]);if(selected.length>this.maxFiles)throw new RangeError(`Federation snapshot exceeds ${this.maxFiles} files`);let total=0;const files=[];for(const item of selected){total+=Number(item.size??0);if(total>this.maxBytes)throw new RangeError(`Federation snapshot exceeds ${this.maxBytes} bytes`);const blob=await this.#json(item.url??`${this.apiBase}/repos/${owner}/${repo}/git/blobs/${item.sha}`);if(blob.encoding!=='base64')throw new Error(`Unsupported GitHub blob encoding for ${item.path}`);files.push({path:item.path,content:Buffer.from(String(blob.content).replace(/\s/g,''),'base64').toString('utf8'),sha:item.sha,size:Number(item.size??0)});}return Object.freeze({source,revision,observedAt:new Date().toISOString(),snapshotSha256:canonicalSha256(files.map(({path,sha,size})=>({path,sha,size}))),files:Object.freeze(files)});}
}

function terms(value){return new Set(String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean));}
const SOURCE_DOMAIN_ALIASES=Object.freeze({
  design:new Set(['ui-design','graphic-design','brand-design','motion-design','ux-research','industrial-design']),
  engineering:new Set(['software-architecture','backend-engineering','frontend-engineering','mobile-development','desktop-development','database-engineering','api-integration','software-testing']),
  testing:new Set(['software-testing','cybersecurity']),planning:new Set(['product-management','operations-leadership']),
  security:new Set(['cybersecurity','ai-agent-engineering']),ai:new Set(['machine-learning','ai-agent-engineering','data-science']),
  'physical-ai':new Set(['industrial-design','hardware-embedded','automation-robotics','machine-learning']),
  robotics:new Set(['automation-robotics','hardware-embedded','industrial-design']),
  '3d':new Set(['graphic-design','industrial-design','game-development','frontend-engineering']),
  platform:new Set(['cloud-platforms','devops-sre']),business:new Set(['product-management','finance-commerce','operations-leadership']),
  documents:new Set(['technical-writing','media-production']),enterprise:new Set(['operations-leadership','legal-compliance','cloud-platforms']),
});
function sourceSupportsDomain(domains,domain){return domains.has('all')||domains.has(domain)||[...domains].some((item)=>SOURCE_DOMAIN_ALIASES[item]?.has(domain));}
function mapCapability(discovered,catalog,source){const explicit=discovered.metadata?.['capability-id']??discovered.metadata?.capabilityId;if(explicit){const exact=catalog.find((item)=>item.capabilityId===explicit);if(!exact)throw new Error(`Skill ${discovered.name} declares unknown capability ${explicit}`);return{capability:exact,confidence:1,reviewRequired:false};}const query=terms(`${discovered.name} ${discovered.description}`);const sourceDomains=new Set(source.domains??[]);const ranked=catalog.map((capability)=>{let score=sourceSupportsDomain(sourceDomains,capability.domain)?5:0;for(const field of [capability.title,capability.capabilityId,...(capability.intentSignals??[]),...(capability.knowledgeTopics??[])])for(const token of terms(field))if(query.has(token))score++;return{capability,score};}).sort((a,b)=>b.score-a.score||a.capability.capabilityId.localeCompare(b.capability.capabilityId));return{capability:ranked[0]?.capability,confidence:ranked[0]?.score??0,reviewRequired:(ranked[0]?.score??0)<8};}
function relatedFiles(snapshot,root){return filesForSkillRoot(snapshot.files,root).map(({path,content})=>({path,content}));}

export class FederationSynchronizer{
  constructor({service,sourcesLoader,capabilityLoader,fetchers={}}={}){if(!service)throw new TypeError('service is required');this.service=service;this.sourcesLoader=sourcesLoader;this.capabilityLoader=capabilityLoader;this.fetchers=fetchers;}
  async sync(sourceId,{tenantId},{principal}){const source=(await this.sourcesLoader()).find((item)=>item.id===sourceId);if(!source)throw new Error(`Unknown federation source: ${sourceId}`);const fetcher=this.fetchers[source.kind];if(!fetcher)throw new Error(`No federation fetcher for source kind ${source.kind}`);const snapshot=await fetcher.fetch(source);if(source.syncPolicy?.pinOnImport!==false&&!SHA40.test(snapshot.revision))throw new Error('Federation source snapshot is not pinned to an immutable commit');const adapter=source.kind==='skills-cli-repository'?discoverSkillsCli:discoverAgentSkills;const discovered=adapter(snapshot);const catalog=await this.capabilityLoader();const providers=[];for(const item of discovered.providers){const mapping=mapCapability(item,catalog,source);if(!mapping.capability){discovered.findings.push({code:'capability-unmapped',severity:'blocker',providerId:item.providerId});continue;}const blockers=mapping.reviewRequired?['capability-mapping-review']:[];const input={providerId:item.providerId,capabilityId:mapping.capability.capabilityId,sourceId:source.id,sourceCoordinate:`${source.url}@${snapshot.revision}#${item.root}`,contentDigest:item.contentDigest,kind:'skill',title:item.name,license:{...item.license,ambiguous:Boolean(item.license?.ambiguous)},trust:{score:mapping.reviewRequired?35:55,blockers},compatibility:{agents:['*'],tools:[]},riskClass:mapping.capability.riskClass,material:{type:'external-agent-skill',root:item.root,files:relatedFiles(snapshot,item.root),metadata:item.metadata,references:item.references,executables:item.executables,snapshotSha256:snapshot.snapshotSha256,mappingConfidence:mapping.confidence}};const imported=await this.service.importProvider(input,{principal,tenantId});const scanned=await this.service.scanProvider(imported.providerId,{tenantId,principal});providers.push(scanned.provider);}return{sourceId,revision:snapshot.revision,snapshotSha256:snapshot.snapshotSha256,providers,findings:discovered.findings,autoPromoted:false};}
}
