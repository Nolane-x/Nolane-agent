const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semver=/^[0-9]+\.[0-9]+\.[0-9]+$/;
const skillTypes=new Set(['discipline','technique','pattern','reference','tool','evaluator','recipe']);
const maturities=new Set(['experimental','candidate','validated','stable','certified','deprecated','quarantined']);
function array(value,name,{min=0}={}){if(!Array.isArray(value)||value.length<min)throw new TypeError(`${name} must be an array with at least ${min} item(s)`);return value;}
function text(value,name,{min=1}={}){if(typeof value!=='string'||value.trim().length<min)throw new TypeError(`${name} must be a specific non-empty string`);return value.trim();}
function object(value,name){if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(`${name} must be an object`);return value;}
export function validateSkillContractV2(input){
  const value=structuredClone(object(input,'skill contract'));
  if(value.schemaVersion!==2)throw new TypeError('schemaVersion must be 2');
  if(!idPattern.test(text(value.id,'id')))throw new TypeError('id must use lowercase kebab-case');
  if(!semver.test(text(value.version,'version')))throw new TypeError('version must use semantic versioning');
  if(!skillTypes.has(value.skillType))throw new TypeError('skillType is invalid');
  if(!maturities.has(value.maturity))throw new TypeError('maturity is invalid');
  const identity=object(value.identity,'identity');
  text(identity.title,'identity.title', {min:4});
  const description=text(identity.description,'identity.description',{min:32});
  if(!description.startsWith('Use when '))throw new TypeError('identity.description must begin with "Use when "');
  if(description.split(/\s+/).length<8)throw new TypeError('identity.description is not specific enough for discovery');
  array(identity.domains,'identity.domains',{min:1});array(identity.keywords,'identity.keywords',{min:2});array(identity.antiTriggers,'identity.antiTriggers',{min:1});
  object(value.relations,'relations');const contract=object(value.contract,'contract');array(contract.produces,'contract.produces',{min:1});array(contract.invariants,'contract.invariants',{min:1});array(contract.requiredTools??[],'contract.requiredTools');
  const procedure=object(value.procedure,'procedure');array(procedure.entryConditions,'procedure.entryConditions',{min:1});array(procedure.steps,'procedure.steps',{min:1});array(procedure.stopConditions,'procedure.stopConditions',{min:1});
  for(const step of procedure.steps){object(step,'procedure step');text(step.id,'procedure step id');text(step.action,'procedure step action',{min:8});text(step.evidence,'procedure step evidence');}
  const verification=object(value.verification,'verification');array(verification.executableChecks,'verification.executableChecks',{min:1});array(verification.evidenceTypes,'verification.evidenceTypes',{min:1});array(verification.evaluatorIds,'verification.evaluatorIds',{min:1});text(verification.reviewerRole,'verification.reviewerRole');
  const context=object(value.context,'context');array(context.defaultSections,'context.defaultSections',{min:1});
  for(const field of ['maxDirectArtifacts','maxReferenceDepth','targetTokens','hardTokens','outputReserveTokens'])if(!Number.isInteger(context[field])||context[field]<0)throw new TypeError(`context.${field} must be a non-negative integer`);
  if(context.targetTokens>context.hardTokens)throw new RangeError('context token target cannot exceed hard token budget');
  if(context.outputReserveTokens>=context.hardTokens)throw new RangeError('context output reserve must be smaller than hard token budget');
  object(value.quality,'quality');array(value.quality.benchmarkIds,'quality.benchmarkIds',{min:1});
  if(!Number.isFinite(value.quality.minimumSkillDepthScore)||value.quality.minimumSkillDepthScore<0||value.quality.minimumSkillDepthScore>100)throw new RangeError('minimumSkillDepthScore must be between 0 and 100');
  array(value.policyProfiles,'policyProfiles',{min:1});
  return Object.freeze(value);
}
