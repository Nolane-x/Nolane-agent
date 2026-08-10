import {canonicalSha256} from '../core/canonical-json.mjs';
import {bundleWorkUnits} from '../fabric/work-unit-bundler.mjs';
import {reflectFindings} from '../fabric/reflection-pipeline.mjs';
import {compileReviewScope} from './review-scope.mjs';
import {resolveReviewRules} from './review-rule-pack.mjs';
import {anchorReviewFinding} from './review-anchor.mjs';

const riskFor=(file)=>{const text=file.path.toLowerCase();const tags=[];if(/auth|session|token|permission/.test(text))tags.push('authentication');if(/db|sql|migration/.test(text))tags.push('database');if(/crypto|secret|security/.test(text))tags.push('security');return tags;};
export async function runCodeReviewIntelligence({change,files,rules=[],availableArtifacts=[],agent,policy={excludeGenerated:true}}={}){
  if(typeof agent!=='function')throw new TypeError('Review agent is required');const scope=compileReviewScope({change,policy});const relations=[];for(const item of scope.included){for(const target of [...(item.imports??[]),...(item.tests??[])])relations.push({from:item.path,to:target,type:'related'});}const bundles=bundleWorkUnits({scope:{included:scope.included},relations});const deterministicFailures=[];const anchored=[];const unitReceipts=[];
  for(const unit of bundles.units){const metadata=scope.included.filter(item=>unit.files.includes(item.path));const enriched={...unit,languages:[...new Set(metadata.map(x=>x.language).filter(Boolean))],riskTags:[...new Set(metadata.flatMap(riskFor))]};const resolution=resolveReviewRules({rules,unit:enriched,availableArtifacts});let findings=[];try{findings=await agent({unit:enriched,rules:resolution.selected,scope})??[];}catch(error){deterministicFailures.push({id:`agent-${unit.unitId}`,severity:'critical',message:`Review agent failed: ${error.message}`,receiptSha256:canonicalSha256({unitId:unit.unitId,error:error.message})});}
    for(const finding of findings){try{anchored.push(anchorReviewFinding({finding,file:files?.[finding.file]}));}catch(error){deterministicFailures.push({id:`anchor-${finding.id}`,severity:'high',message:`Finding could not be anchored: ${error.message}`,receiptSha256:canonicalSha256({finding,error:error.message})});}}
    unitReceipts.push({unitId:unit.unitId,receiptSha256:canonicalSha256({unitId:unit.unitId,rules:resolution.selected.map(x=>x.id),findings})});
  }
  const reflected=reflectFindings({deterministicFailures,agentFindings:anchored.map(item=>({...item,evidenceSpans:[item.anchor]}))});const accountedFiles=[...new Set(bundles.units.flatMap(x=>x.files))].sort();const coverage={status:accountedFiles.length===scope.included.length&&scope.coverage.unaccounted===0?'complete':'incomplete',accountedFiles:accountedFiles.length,requiredFiles:scope.included.length,unitReceipts};if(coverage.status!=='complete')throw new Error('Review coverage incomplete');const payload={schemaVersion:1,status:reflected.status,scope,bundles,coverage,findings:reflected.final,rejected:reflected.rejected};return Object.freeze({...payload,reviewSha256:canonicalSha256(payload)});
}
