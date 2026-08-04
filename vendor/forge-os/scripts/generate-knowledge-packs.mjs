import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CAPABILITY_DOMAINS, CAPABILITY_OPERATIONS } from '../config/capability-domains.mjs';
const sources=[...JSON.parse(await readFile('config/federation-sources.json','utf8')),...JSON.parse(await readFile('config/knowledge-sources.json','utf8')),...JSON.parse(await readFile('config/mcp-registry-sources.json','utf8'))];
const byId=new Map(sources.map(s=>[s.id,s]));
await mkdir('knowledge/packs',{recursive:true});
for(const domain of CAPABILITY_DOMAINS){
  const pack={schemaVersion:1,id:`knowledge-pack.${domain.id}`,domain:domain.id,title:`${domain.label} Knowledge Pack`,loadingPolicy:'references-only-progressive-disclosure',topics:domain.topics,capabilities:CAPABILITY_OPERATIONS.map(([key])=>`${domain.id}.${key}`),sources:domain.sources.map(id=>byId.get(id)).filter(Boolean).map(({id,title,url,authority,trust,revision,license})=>({id,title,url,authority,trust,revision,license})),qualityPolicy:{minimumAuthoritativeSources:1,requirePinnedRevision:true,licenseAware:true,noRemoteContentVendoring:true}};
  await writeFile(`knowledge/packs/${domain.id}.json`,`${JSON.stringify(pack,null,2)}\n`);
}
console.log(`Generated ${CAPABILITY_DOMAINS.length} knowledge packs.`);
