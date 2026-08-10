const DANGEROUS=new Set(['provider.promote','provider.revoke','mcp.enable','source.add','source.sync']);
export function authorizeFederationAction({principal,tenantId,action,provider={}}){
  const roles=new Set(principal?.roles??[]);const scopes=new Set(principal?.scopes??[]);const tenantScope=`tenant:${tenantId}`;
  if(!principal?.id||!(scopes.has('*')||scopes.has(tenantScope))) return {allow:false,reason:'tenant scope denied'};
  if(DANGEROUS.has(action)&&!roles.has('federation-admin')) return {allow:false,reason:'federation-admin role required'};
  if(['critical','high'].includes(provider.riskClass)&&principal.type!=='human') return {allow:false,reason:'high-risk federation changes require a human principal'};
  if(action.startsWith('provider.')||action.startsWith('mcp.')||action.startsWith('source.')) return {allow:true,reason:'tenant-scoped federation policy passed'};
  return {allow:false,reason:'unsupported federation action'};
}
