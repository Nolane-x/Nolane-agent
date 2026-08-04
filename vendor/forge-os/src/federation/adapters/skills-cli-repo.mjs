import { discoverAgentSkills } from './agent-skills-repo.mjs';
export function discoverSkillsCli(snapshot){
  const result=discoverAgentSkills(snapshot);
  const seen=new Set();
  result.providers=result.providers.filter((provider)=>{if(seen.has(provider.name))return false;seen.add(provider.name);return true;});
  return result;
}
