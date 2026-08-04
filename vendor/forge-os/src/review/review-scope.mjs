import {canonicalSha256} from '../core/canonical-json.mjs';

export function compileReviewScope({change,policy={}}={}){
  const included=[];const excluded=[];const files=[...(change?.files??[])].sort((a,b)=>String(a.path).localeCompare(String(b.path)));
  for(const file of files){if(!file?.path)throw new TypeError('Changed file path is required');if(policy.excludeGenerated&&file.generated){excluded.push({...file,reason:'generated-output'});continue;}if(file.deleted&&policy.excludeDeleted){excluded.push({...file,reason:'deleted-by-policy'});continue;}included.push({...file,reason:'review-required'});}
  const coverage={changed:files.length,accounted:included.length+excluded.length,unaccounted:files.length-included.length-excluded.length};
  if(coverage.unaccounted!==0)throw new Error('Review scope contains unaccounted changed files');
  const payload={schemaVersion:2,included,excluded,coverage,policy:{excludeGenerated:Boolean(policy.excludeGenerated),excludeDeleted:Boolean(policy.excludeDeleted)}};
  return Object.freeze({...payload,scopeSha256:canonicalSha256(payload)});
}
