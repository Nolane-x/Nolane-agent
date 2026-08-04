import { assertSafeFederationUrl } from '../canonical-source.mjs';
export function discoverKnowledgeEntries(snapshot){
  return (snapshot.entries??[]).map((entry)=>({
    providerId:`${snapshot.source?.id??'knowledge'}.${entry.id}`,name:String(entry.id),title:String(entry.title),kind:'knowledge',status:'quarantined',
    sourceId:snapshot.source?.id??'unknown',authority:snapshot.source?.authority??'community',url:assertSafeFederationUrl(entry.url),
    domains:[...(entry.domains??[])],topics:[...(entry.topics??[])],freshnessHours:Number(entry.freshnessHours??168),
    license:{spdx:'Reference',mode:'link-only'},
  }));
}
