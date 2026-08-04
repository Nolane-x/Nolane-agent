import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
async function text(root, file, failures) { try { return await readFile(path.join(root,file),'utf8'); } catch { failures.push(`missing ${file}`); return ''; } }
async function present(root,file,failures){try{await access(path.join(root,file));}catch{failures.push(`missing ${file}`)}}
function need(value,re,label,failures){if(!re.test(value))failures.push(`missing behavior: ${label}`)}
export async function verifyContextEngineV3({ rootDirectory=process.cwd(), version, outputFile }={}) {
 const root=path.resolve(rootDirectory); const releaseVersion=String(version??''); const failures=[];
 for(const file of ['src/context/evidence-card.mjs','src/context/token-cost-adapter.mjs','src/context/context-utility-selector.mjs','src/context/context-escalation-controller.mjs','src/context/hybrid-evidence-retrieval-service.mjs','src/agent/context-orchestration-kernel.mjs','tests/evidence-card.test.mjs','tests/token-cost-adapter.test.mjs','tests/context-utility-selector.test.mjs','tests/context-escalation-controller.test.mjs','tests/agent-loop-context-escalation.test.mjs']) await present(root,file,failures);
 const selector=await text(root,'src/context/context-utility-selector.mjs',failures); const card=await text(root,'src/context/evidence-card.mjs',failures); const kernel=await text(root,'src/agent/context-orchestration-kernel.mjs',failures);
 need(selector,/(?=[\s\S]*relevance)(?=[\s\S]*trust)(?=[\s\S]*fresh)(?=[\s\S]*impact)(?=[\s\S]*coverage)(?=[\s\S]*counterEvidenceRatio)(?=[\s\S]*near-duplicate)(?=[\s\S]*marginal-utility-below-threshold)/,'utility/MMR/counter-evidence selection',failures);
 need(card,/(?=[\s\S]*evidenceId)(?=[\s\S]*sourceHash)(?=[\s\S]*branch)(?=[\s\S]*worktree)(?=[\s\S]*freshness)(?=[\s\S]*supports)(?=[\s\S]*contradicts)/,'provenance-rich Evidence Card',failures);
 need(kernel,/(?=[\s\S]*selectionMode)(?=[\s\S]*utility)(?=[\s\S]*sourceUsage)(?=[\s\S]*selectedIds)(?=[\s\S]*omissions)(?=[\s\S]*receiptSha256)/,'context selection receipt projection',failures);
 let measurement=null; try{measurement=JSON.parse(await text(root,`docs/decision-efficiency-loop-measurement-${releaseVersion}.json`,failures));}catch{failures.push('measurement JSON invalid')}
 if(measurement){ if(!(measurement.context?.selectedTokens < measurement.context?.baselineTokens)) failures.push('context reduction not measured'); if(measurement.context?.counterEvidenceIncluded!==true) failures.push('counter-evidence inclusion not measured'); if(measurement.context?.verifiedCriteriaPreserved!==true) failures.push('verified criteria preservation not measured'); if(measurement.tokenizer?.degraded!==false) failures.push('real tokenizer path not measured'); if(measurement.escalation?.initialBudgetTokens>4000 || measurement.escalation?.action!=='expand') failures.push('bounded context escalation not measured'); }
 const limitations=await text(root,`docs/LIMITATIONS-${releaseVersion}.md`,failures); need(limitations,/does not claim.*learned context|không.*tuyên bố.*context.*học/i,'learned context policy non-claim',failures); need(limitations,/tokenizer.*fallback|fallback.*token/i,'tokenizer fallback boundary',failures);
 const boundaries=Object.freeze({ learnedContextPolicyClaimed:false, contextAblationClaimed:false, modelTokenizerUniversalClaimed:false, semanticEmbeddingClaimed:false });
 const base={schema:'forge.studio.context-engine-v3-verification.v1',version:releaseVersion,status:failures.length?'fail':'pass',measurement,boundaries,failures:Object.freeze(failures)}; const report=Object.freeze({...base,receiptSha256:canonicalSha256(base)});
 if(outputFile){await mkdir(path.dirname(path.resolve(outputFile)),{recursive:true});await writeFile(path.resolve(outputFile),`${JSON.stringify(report,null,2)}\n`)}
 if(failures.length){const error=new Error(`Context Engine V3 verification failed with ${failures.length} issue(s)`);error.code='CONTEXT_ENGINE_V3_VERIFICATION_FAILED';error.report=report;throw error} return report;
}
