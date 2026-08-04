import {canonicalSha256} from '../core/canonical-json.mjs';
import {matchesAny} from '../fabric/glob.mjs';

export function resolveReviewRules({rules=[],unit,availableArtifacts=[]}={}){
  const artifacts=new Set(availableArtifacts);const languages=new Set(unit?.languages??[]);const risks=new Set(unit?.riskTags??[]);const selected=[];const skipped=[];
  for(const rule of [...rules].sort((a,b)=>a.id.localeCompare(b.id))){const reasons=[];const pathMatch=(unit?.files??[]).some(file=>matchesAny(file,rule.fileGlobs??['**']));if(!pathMatch)reasons.push('path mismatch');if(rule.languages?.length&&!rule.languages.some(x=>languages.has(x)))reasons.push('language mismatch');if(rule.riskTags?.length&&!rule.riskTags.some(x=>risks.has(x)))reasons.push('risk mismatch');const missing=(rule.requires??[]).filter(x=>!artifacts.has(x));if(missing.length)reasons.push(`missing evidence: ${missing.join(', ')}`);if(reasons.length)skipped.push({id:rule.id,reason:reasons.join('; ')});else selected.push(rule);}
  const payload={selected,skipped};return Object.freeze({...payload,resolutionSha256:canonicalSha256(payload)});
}
