import { assertSafeFederationUrl } from './canonical-source.mjs';
const HIGH_RISK=/(?:execute|shell|command|terminal|delete|destroy|write_file|filesystem|admin|sudo|credential|secret)/i;
export function assessMcpServer(server,{sourceAuthority='community'}={}){
  const findings=[];const add=(code,severity,message)=>findings.push({code,severity,message});
  if(!server.name)add('missing-name','blocker','Server name is required');
  if(!server.publisherVerified)add('unverified-publisher',sourceAuthority==='official'?'warning':'blocker','Publisher ownership is not verified');
  for(const remote of server.remotes??[]){try{assertSafeFederationUrl(remote.url);}catch(error){add('unsafe-transport-url','blocker',error.message);}}
  for(const tool of server.tools??[])if(HIGH_RISK.test(tool.name))add('high-risk-tool-name','blocker',`Tool ${tool.name} requires manual permission review`);
  if(!server.repository?.url)add('missing-source-repository','warning','No source repository is declared');
  const blockers=findings.filter((f)=>f.severity==='blocker');
  const permissions=(server.tools??[]).map((tool)=>`tool:${tool.name}:${tool.annotations?.readOnlyHint===true?'read':'write'}`);
  return {server,status:blockers.length?'quarantined':'candidate',findings,permissions,trustScore:Math.max(0,100-blockers.length*40-findings.filter((f)=>f.severity==='warning').length*10)};
}
