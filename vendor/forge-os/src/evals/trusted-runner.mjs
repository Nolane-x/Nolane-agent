import { canonicalSha256 } from '../core/canonical-json.mjs';
import { createPrincipal, principalRecord } from '../core/principals.mjs';
import { compareRuns, evaluateCandidate, runBehavioralSuite } from './evaluator.mjs';

const TRUSTED_EXECUTOR=Symbol('forgeos.trusted-eval-executor');
const now=()=>new Date().toISOString();
function clean(value,label,max=200){const text=String(value??'').trim();if(!text||text.length>max)throw new TypeError(`${label} is invalid`);return text;}
function mean(values){return values.reduce((sum,value)=>sum+value,0)/values.length;}
function confidence(values,z=1.96){if(values.length===1)return {low:values[0],high:values[0]};const average=mean(values);const variance=values.reduce((sum,value)=>sum+(value-average)**2,0)/(values.length-1);const margin=z*Math.sqrt(variance/values.length);return {low:average-margin,high:average+margin};}
function pairedAnalysis(baseline,candidate){const byKey=new Map(baseline.map((row)=>[`${row.caseId}:${row.seed}`,row]));const quality=[];const pass=[];for(const row of candidate){const base=byKey.get(`${row.caseId}:${row.seed}`);quality.push(row.quality-base.quality);pass.push(Number(row.passed)-Number(base.passed));}return {samples:quality.length,qualityDelta:{mean:mean(quality),confidence95:confidence(quality)},passDelta:{mean:mean(pass),confidence95:confidence(pass)}};}

export class TrustedEvalExecutor{
  constructor({id,version='1.0.0',execute}){this.id=clean(id,'executor.id',100);this.version=clean(version,'executor.version',40);if(typeof execute!=='function')throw new TypeError('executor.execute is required');this.execute=execute;this.principal=createPrincipal({id:`eval-executor:${this.id}`,type:'service',roles:['eval-executor'],scopes:['eval:execute'],trustDomain:`eval-executor:${this.id}`});Object.defineProperty(this,TRUSTED_EXECUTOR,{value:true});}
}

export async function runTrustedSkillEvaluation({skillName,skillVersion,cases,seeds=[1,2,3],executor,store,policy={}}){
  if(executor?.[TRUSTED_EXECUTOR]!==true)throw new Error('A trusted EvalExecutor is required');
  if(!store?.put)throw new TypeError('EvalRunStore is required');
  skillName=clean(skillName,'skillName',100);skillVersion=clean(skillVersion,'skillVersion',40);
  const execute=({caseDefinition,seed,mode})=>executor.execute({caseDefinition,seed,mode,skillName,skillVersion});
  const baseline=await runBehavioralSuite({cases,executor:execute,mode:'baseline',seeds});
  const candidate=await runBehavioralSuite({cases,executor:execute,mode:'candidate',seeds});
  const comparison=compareRuns(baseline.rows,candidate.rows);const paired=pairedAnalysis(baseline.rows,candidate.rows);
  let decision=evaluateCandidate(comparison.baseline,comparison.candidate,policy);
  const minimumSamples=Number(policy.minimumSamples??3);
  if(decision.decision==='promote'&&(paired.samples<minimumSamples||(paired.qualityDelta.confidence95.low<=0&&paired.passDelta.confidence95.low<=0))){decision={...decision,decision:'quarantine',reasons:[...new Set([...(decision.reasons??[]),'insufficient-confidence'])]};}
  const run=await store.put({schemaVersion:1,skillName,skillVersion,executor:{id:executor.id,version:executor.version,principal:principalRecord(executor.principal)},corpusSha256:canonicalSha256(cases),matrix:{cases:cases.length,seeds:seeds.length,caseIds:cases.map((item)=>item.id).sort(),seedValues:[...seeds]},baseline,candidate,comparison,paired,decision,policy:structuredClone(policy),createdAt:now()});
  return {run};
}
