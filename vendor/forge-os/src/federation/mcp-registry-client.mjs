import { assertSafeFederationUrl } from './canonical-source.mjs';

export function normalizeRegistryServer(input) {
  const wrapper=input?.server?input:{server:input??{},_meta:input?._meta??{}};
  const server=wrapper.server??{};
  return {
    name:String(server.name??''),description:String(server.description??''),version:String(server.version??server._meta?.version??''),
    repository:server.repository?.url?{url:String(server.repository.url)}:null,
    packages:(server.packages??[]).map((item)=>({registryType:item.registryType??item.registry_type??null,identifier:item.identifier??item.name??null,version:item.version??null,transport:item.transport??null})),
    remotes:(server.remotes??[]).map((item)=>({type:item.type??item.transportType??null,url:item.url??null})),
    tools:(server.tools??[]).map((item)=>({name:String(item.name??''),description:String(item.description??''),annotations:item.annotations??{}})),
    publisherVerified:Boolean(wrapper._meta?.publisher?.verified??server._meta?.publisher?.verified),metadata:wrapper._meta??{},
  };
}

export class McpRegistryClient {
  constructor({baseUrl='https://registry.modelcontextprotocol.io',fetchImpl=globalThis.fetch}={}){
    this.baseUrl=assertSafeFederationUrl(baseUrl); if(typeof fetchImpl!=='function')throw new TypeError('fetchImpl is required'); this.fetchImpl=fetchImpl;
  }
  async #json(url){const response=await this.fetchImpl(url,{headers:{accept:'application/json'}});if(!response?.ok)throw new Error(`MCP Registry request failed: ${response?.status??'unknown'}`);return response.json();}
  async search({query='',limit=20,cursor=null}={}){
    const url=new URL('/v0.1/servers',`${this.baseUrl}/`); if(query)url.searchParams.set('search',query);url.searchParams.set('limit',String(Math.max(1,Math.min(100,limit))));if(cursor)url.searchParams.set('cursor',cursor);
    const payload=await this.#json(url); const rows=payload.servers??payload.data??[];
    return {servers:rows.map(normalizeRegistryServer),nextCursor:payload.metadata?.nextCursor??payload.meta?.next_cursor??null};
  }
  async latest(name){
    const safe=encodeURIComponent(String(name)); const payload=await this.#json(new URL(`/v0.1/servers/${safe}/versions/latest`,`${this.baseUrl}/`));return normalizeRegistryServer(payload);
  }
}
