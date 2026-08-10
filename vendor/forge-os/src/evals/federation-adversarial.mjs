import { canonicalSha256 } from '../core/canonical-json.mjs';
import { scanSkillPackage } from '../federation/security-scanner.mjs';
import { classifyLicense } from '../federation/license-policy.mjs';
import { assessMcpServer } from '../federation/mcp-assessor.mjs';
import { clusterProviders } from '../federation/deduplicator.mjs';
import { evaluateFederatedProvider } from './federation-evaluator.mjs';

const CATEGORIES=new Set(['skill-scan','license','mcp-assess','provider-eval','dedup']);

export function validateFederationAdversarialCorpus(cases){
  const errors=[];const ids=new Set();const categories=new Set();
  if(!Array.isArray(cases))return{errors:['corpus must be an array'],categories:[]};
  for(const [index,item] of cases.entries()){
    if(!item||typeof item!=='object'){errors.push(`case ${index} must be an object`);continue;}
    if(typeof item.id!=='string'||!item.id)errors.push(`case ${index} requires id`);
    else if(ids.has(item.id))errors.push(`duplicate case id: ${item.id}`);else ids.add(item.id);
    if(!CATEGORIES.has(item.category))errors.push(`${item.id??index}: unsupported category ${item.category}`);else categories.add(item.category);
    if(!item.input||typeof item.input!=='object'||Array.isArray(item.input))errors.push(`${item.id??index}: input must be an object`);
    if(!item.expected||typeof item.expected!=='object'||Array.isArray(item.expected))errors.push(`${item.id??index}: expected must be an object`);
  }
  for(const category of CATEGORIES)if(!categories.has(category))errors.push(`missing category: ${category}`);
  return{errors,categories:[...categories].sort(),caseCount:cases.length};
}

function resultCodes(findings){return[...new Set((findings??[]).map((item)=>item.code))].sort();}
function execute(item){
  switch(item.category){
    case 'skill-scan':{const report=scanSkillPackage(item.input.files??[],{sourceId:item.id});return{blocked:report.blocked,codes:resultCodes(report.findings)};}
    case 'license':return classifyLicense(item.input);
    case 'mcp-assess':{const report=assessMcpServer(item.input.server,{sourceAuthority:item.input.sourceAuthority});return{status:report.status,codes:resultCodes(report.findings),trustScore:report.trustScore};}
    case 'provider-eval':{const input={...item.input,now:Date.parse(item.input.now)};const report=evaluateFederatedProvider(input);return{status:report.status,codes:resultCodes(report.findings),receiptSha256:report.receiptSha256};}
    case 'dedup':{const clusters=clusterProviders(item.input.providers??[]);const sizes=clusters.map((cluster)=>cluster.providers.length).sort((a,b)=>b-a);return{clusterSizes:sizes,duplicateClusterCount:sizes.filter((size)=>size>1).length};}
    default:throw new Error(`Unsupported adversarial category: ${item.category}`);
  }
}
function expectedMatches(actual,expected){
  for(const [key,value] of Object.entries(expected)){
    if(Array.isArray(value)){
      const actualValues=Array.isArray(actual[key])?actual[key]:[];
      if(key==='codes'){if(!value.every((item)=>actualValues.includes(item)))return false;}
      else if(JSON.stringify(actualValues)!==JSON.stringify(value))return false;
    }else if(actual[key]!==value)return false;
  }
  return true;
}

export function runFederationAdversarialCorpus(cases){
  const validation=validateFederationAdversarialCorpus(cases);
  if(validation.errors.length)throw new TypeError(`Invalid federation adversarial corpus: ${validation.errors.join('; ')}`);
  const results=cases.map((item)=>{try{const actual=execute(item);const passed=expectedMatches(actual,item.expected);return{id:item.id,category:item.category,passed,expected:item.expected,actual};}catch(error){return{id:item.id,category:item.category,passed:false,expected:item.expected,error:error instanceof Error?error.message:String(error)};}});
  const failures=results.filter((item)=>!item.passed);
  return Object.freeze({schemaVersion:1,corpusSha256:canonicalSha256(cases),summary:{total:results.length,passed:results.length-failures.length,failed:failures.length},results:Object.freeze(results),failures:Object.freeze(failures)});
}
