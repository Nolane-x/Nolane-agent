import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../core/canonical-json.mjs';

function finiteMetric(run,key,{min=0,max=Infinity}={}) {
  const value=Number(run?.[key]);
  if(!Number.isFinite(value)||value<min||value>max)throw new TypeError(`${key} must be between ${min} and ${max}`);
  return value;
}
function normalizedText(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('en-US');}
function wilson(successes,total,z=1.96){
  if(!total)return {low:0,high:0};
  const p=successes/total;const denominator=1+z*z/total;const center=(p+z*z/(2*total))/denominator;const margin=z*Math.sqrt((p*(1-p)+z*z/(4*total))/total)/denominator;
  return {low:Math.max(0,center-margin),high:Math.min(1,center+margin)};
}

export function evaluateCaseOutput(caseDefinition,output) {
  if(!caseDefinition?.id||!caseDefinition?.rubric)throw new TypeError('A valid eval case is required');
  const failures=[];const text=normalizedText(`${output?.text??''}\n${JSON.stringify(output?.structuredContent??{})}`);
  for(const pattern of caseDefinition.forbiddenPatterns??[])if(text.includes(normalizedText(pattern)))failures.push(`forbidden-pattern:${pattern}`);
  const evidence=(output?.evidence??[]).map(normalizedText);
  for(const required of caseDefinition.requiredEvidence??[]){const expected=normalizedText(required);if(!evidence.some((item)=>item===expected||item.includes(expected))&&!text.includes(expected))failures.push(`missing-evidence:${required}`);}
  let weighted=0;let totalWeight=0;
  for(const [metric,rule] of Object.entries(caseDefinition.rubric??{})){
    const value=Number(output?.metrics?.[metric]);
    if(!Number.isFinite(value)||value<0||value>100){failures.push(`invalid-metric:${metric}`);continue;}
    const weight=Number(rule.weight??0);if(!Number.isFinite(weight)||weight<0){failures.push(`invalid-weight:${metric}`);continue;}
    weighted+=value*weight;totalWeight+=weight;
    if(value<Number(rule.min??0))failures.push(`rubric-below-minimum:${metric}`);
  }
  const tokens=Number(output?.tokens);
  if(!Number.isFinite(tokens)||tokens<0||!Number.isInteger(tokens))failures.push('invalid-token-count');
  const criticalFailures=(output?.criticalFailures??0)+failures.filter((failure)=>failure.startsWith('forbidden-pattern:')).length;
  return {
    caseId:caseDefinition.id,passed:failures.length===0,quality:totalWeight?weighted/totalWeight:0,
    tokens:Number.isInteger(tokens)&&tokens>=0?tokens:0,criticalFailures,failures,
    outputSha256:canonicalSha256(output??{}),
  };
}

export async function runBehavioralSuite({cases,executor,mode,seeds=[1,2,3]}) {
  if(!Array.isArray(cases)||!cases.length)throw new TypeError('eval cases are required');
  if(typeof executor!=='function')throw new TypeError('eval executor is required');
  if(!['baseline','candidate'].includes(mode))throw new TypeError('eval mode must be baseline or candidate');
  if(!Array.isArray(seeds)||!seeds.length||seeds.some((seed)=>!Number.isInteger(seed)))throw new TypeError('integer seeds are required');
  const rows=[];
  for(const caseDefinition of [...cases].sort((a,b)=>a.id.localeCompare(b.id))){
    for(const seed of seeds){
      const output=await executor({caseDefinition:structuredClone(caseDefinition),seed,mode});
      rows.push({...evaluateCaseOutput(caseDefinition,output),seed,mode});
    }
  }
  return {mode,seeds:[...seeds],rows,runSha256:canonicalSha256(rows)};
}

export function evaluateCandidate(baseline,candidate,policy={}) {
  const rules={minimumPassRateDelta:.02,minimumQualityDelta:2,maximumTokenGrowth:.35,...policy};
  const basePass=finiteMetric(baseline,'passRate',{min:0,max:1});
  const nextPass=finiteMetric(candidate,'passRate',{min:0,max:1});
  const baseQuality=finiteMetric(baseline,'quality',{min:0,max:100});
  const nextQuality=finiteMetric(candidate,'quality',{min:0,max:100});
  const baseTokens=finiteMetric(baseline,'tokenCount');
  const nextTokens=finiteMetric(candidate,'tokenCount');
  const criticalFailures=finiteMetric(candidate,'criticalFailures');
  if(!Number.isInteger(criticalFailures))throw new TypeError('criticalFailures must be a non-negative integer');
  const deltas={passRate:nextPass-basePass,quality:nextQuality-baseQuality,tokenGrowth:baseTokens===0?(nextTokens===0?0:Infinity):(nextTokens-baseTokens)/baseTokens};
  const reasons=[];
  if(criticalFailures>0)reasons.push('critical-failure');
  if(deltas.passRate<0)reasons.push('pass-rate-regression');
  if(deltas.tokenGrowth>rules.maximumTokenGrowth&&deltas.passRate<rules.minimumPassRateDelta&&deltas.quality<rules.minimumQualityDelta)reasons.push('token-only-growth');
  const materiallyBetter=deltas.passRate>=rules.minimumPassRateDelta||deltas.quality>=rules.minimumQualityDelta;
  return {decision:reasons.length>0||!materiallyBetter?'quarantine':'promote',deltas,reasons:reasons.length?reasons:materiallyBetter?['measurable-improvement']:['no-measurable-improvement']};
}

function summarize(rows) {
  if(!Array.isArray(rows)||rows.length===0)throw new TypeError('run rows are required');
  const passes=rows.filter((row)=>row.passed===true).length;
  const passRate=passes/rows.length;
  const quality=rows.reduce((sum,row)=>sum+finiteMetric(row,'quality',{min:0,max:100}),0)/rows.length;
  const tokenCount=rows.reduce((sum,row)=>sum+finiteMetric(row,'tokens'),0);
  const criticalFailures=rows.reduce((sum,row)=>sum+finiteMetric(row,'criticalFailures'),0);
  return {cases:rows.length,passRate,quality,tokenCount,criticalFailures,tokenEfficiency:tokenCount?quality/tokenCount:0,confidence95:wilson(passes,rows.length)};
}

export function compareRuns(baselineRows,candidateRows) {
  const key=(row)=>`${row.caseId}:${row.seed}`;
  const baselineKeys=[...baselineRows].map(key).sort();const candidateKeys=[...candidateRows].map(key).sort();
  if(JSON.stringify(baselineKeys)!==JSON.stringify(candidateKeys))throw new TypeError('Baseline and candidate must use the same case and seed matrix');
  if(new Set(baselineKeys).size!==baselineKeys.length)throw new TypeError('Run matrix contains duplicate case and seed entries');
  const baseline=summarize(baselineRows);const candidate=summarize(candidateRows);
  return {baseline,candidate,delta:{passRate:candidate.passRate-baseline.passRate,quality:candidate.quality-baseline.quality,tokens:candidate.tokenCount-baseline.tokenCount,tokenEfficiency:candidate.tokenEfficiency-baseline.tokenEfficiency}};
}

export async function applySkillEvaluation({catalogPath,skillName,evalRunId,store}) {
  if(!store?.read)throw new TypeError('Trusted EvalRunStore is required');
  const evalRun=await store.read(evalRunId);
  if(evalRun.skillName!==skillName)throw new Error('EvalRun skill does not match catalog skill');
  if(!['promote','quarantine'].includes(evalRun.decision?.decision))throw new TypeError('EvalRun decision is invalid');
  const file=path.resolve(catalogPath);const catalog=JSON.parse(await readFile(file,'utf8'));
  const index=catalog.findIndex((skill)=>skill.name===skillName);if(index<0)throw new TypeError(`Unknown skill: ${skillName}`);
  if(catalog[index].version!==evalRun.skillVersion)throw new Error('EvalRun skill version does not match catalog version');
  catalog[index]={...catalog[index],status:evalRun.decision.decision==='promote'?'stable':'quarantined',evaluation:{decision:evalRun.decision.decision,reasons:[...(evalRun.decision.reasons??[])],deltas:structuredClone(evalRun.decision.deltas??evalRun.comparison?.delta??{}),runId:evalRun.id,runSha256:evalRun.sha256,executor:structuredClone(evalRun.executor),corpusSha256:evalRun.corpusSha256,evaluatedAt:new Date().toISOString()}};
  const temp=`${file}.${process.pid}.${Date.now()}.tmp`;await writeFile(temp,`${JSON.stringify(catalog,null,2)}\n`,'utf8');await rename(temp,file);
  return structuredClone(catalog[index]);
}
