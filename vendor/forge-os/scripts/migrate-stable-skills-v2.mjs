import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultTokenAccountingRegistry } from '../src/context/token-accounting.mjs';
import { buildSectionIndex } from '../src/skills/v2/section-index.mjs';
import { validateSkillContractV2 } from '../src/skills/v2/contracts.mjs';
import { loadPolicyProfiles, resolvePolicyProfileHashes } from '../src/skills/v2/policy-profiles.mjs';
import { canonicalSha256 } from '../src/core/canonical-json.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'skills-v2/stable');
const anti={
 'benchmarking-skill-utility':['single anecdotal success without a baseline','production promotion without paired runs'],
 'choosing-system-architecture':['a local implementation detail with no system trade-off','an architecture decision already fixed by a confirmed constraint'],
 'compiling-context-pack':['a request that fits safely without retrieval or omission','raw transcript archival with no model call'],
 'constructing-idea-genomes':['a single constrained implementation task','cosmetic renaming presented as novelty'],
 'defining-minimum-viable-product':['a mature product requiring full release scope','a prototype whose learning question is still unknown'],
 'designing-api-contracts':['internal code with no boundary or consumer','observability instrumentation without an API change'],
 'designing-api-versioning':['a private API with no compatibility obligation','a one-time data migration without an interface contract'],
 'designing-idempotent-automations':['read-only calculations without side effects','a manually triggered task that cannot retry'],
 'designing-interaction-contracts':['visual styling without user interaction states','backend-only behavior with no user-facing contract'],
 'designing-model-routing':['a single fixed model required by policy','prompt wording optimization within one model'],
 'designing-saas-tenancy':['a single-user local application','shared data with no tenant isolation requirement'],
 'detecting-fake-novelty':['routine implementation selection','ideas that have not yet been normalized to mechanisms'],
 'developing-features-with-tdd':['generated fixtures or disposable experiments','documentation-only changes with no executable behavior'],
 'fuzzing-untrusted-inputs':['fully enumerated finite inputs','performance load testing without malformed input risk'],
 'generating-divergent-concepts':['a confirmed implementation plan','a task where only one legally valid solution exists'],
 'managing-artifact-lineage':['ephemeral notes with no downstream consumer','independent artifacts with no dependency relation'],
 'measuring-mutation-resistance':['a project with no executable tests','coverage reporting without test-quality questions'],
 'modeling-security-threats':['a cosmetic UI change with no trust-boundary impact','a vulnerability already reproduced and ready for remediation'],
 'optimizing-context-budget':['a short request far below model limits','latency caused by external network execution rather than context'],
 'packaging-release-evidence':['an unreleased local experiment','a release whose source and verification subjects are not frozen'],
 'resolving-user-intent':['a fully specified deterministic command','minor wording preferences that do not affect behavior'],
 'reviewing-critical-code-line-by-line':['generated lockfiles with no manual logic','broad architectural review without critical code paths'],
 'routing-skill-graph':['a single explicitly selected skill','provider installation before capability intent is known'],
 'running-security-release-gate':['early ideation with no release candidate','non-security quality review without release authority'],
 'selecting-winning-concept':['unscored brainstorming output','implementation choice already constrained by regulation'],
 'testing-agent-tool-abuse':['a model with no tool access','ordinary input validation unrelated to agent authority'],
 'testing-cost-abuse':['fixed offline computation with no metered resource','performance tuning without adversarial consumption'],
 'testing-properties-and-invariants':['snapshot-only UI review','behavior with no stable invariant or generative input space'],
 'testing-skill-behavior':['a runtime code bug unrelated to agent instructions','a reference document with no behavioral expectation'],
 'using-forge-os':['a simple factual question with no product workflow','an existing non-ForgeOS workflow the user did not ask to migrate'],
 'validating-source-credibility':['purely creative writing with no factual claims','a source already authenticated and current by policy'],
 'writing-executable-plans':['a one-step reversible edit','work whose requirements are still materially ambiguous'],
 'writing-minimal-sufficient-code':['a deliberate framework migration requiring broader change','generated code whose size is fixed by schema']
};
function title(id){return id.split('-').map((word)=>word[0].toUpperCase()+word.slice(1)).join(' ');}
function mdList(items){return items.map((item)=>`- ${item}`).join('\n');}
function sectionText(contract,type){
 if(type==='procedure')return `# Procedure\n\n${contract.procedure.map((step,i)=>`${i+1}. ${step}`).join('\n')}\n`;
 if(type==='decision-tables')return `# Decision Rules\n\n| Signal | Decision |\n|---|---|\n| Preconditions missing | Stop and record the blocker. |\n| Required tool unavailable | Do not approximate the result. |\n| Multiple viable paths | Prefer the smallest path that satisfies the typed output and evidence contract. |\n| Critical uncertainty | Request an authenticated human decision. |\n`;
 if(type==='verification')return `# Verification\n\n${mdList(contract.method?.verification??contract.gate?.rules??[])}\n\nRequired evidence:\n${mdList(contract.method?.evidence??contract.handoff?.requiredEvidence??[])}\n`;
 if(type==='failure-modes')return `# Failure Modes\n\n${mdList(contract.failureModes??contract.method?.traps??[])}\n`;
 return `# Examples\n\n## Positive\nApply **${contract.name}** only after its typed inputs and entry conditions are present. Produce ${contract.produces.join(', ')} and attach current evidence.\n\n## Counter-example\nDo not activate this technique merely because its name resembles the request; stop when an anti-trigger or missing prerequisite applies.\n`;
}
async function run(){
 await rm(OUT,{recursive:true,force:true});await mkdir(OUT,{recursive:true});
 const [catalog,mappings,profiles]=await Promise.all([readFile(path.join(ROOT,'skills/catalog.json'),'utf8').then(JSON.parse),readFile(path.join(ROOT,'config/mappings/stable-skill-mappings.json'),'utf8').then(JSON.parse),loadPolicyProfiles()]);
 const map=new Map(mappings.map((item)=>[item.skillId,item]));const registry=createDefaultTokenAccountingRegistry();const built=[];
 for(const legacy of catalog.filter((skill)=>skill.status==='stable').sort((a,b)=>a.name.localeCompare(b.name))){
  const mapping=map.get(legacy.name);if(!mapping)throw new Error(`Missing stable mapping for ${legacy.name}`);
  const root=path.join(OUT,legacy.name);await mkdir(path.join(root,'sections'),{recursive:true});
  const focus=legacy.method?.focus??legacy.description.replace(/^Use when /,'').replace(/\.$/,'');
  const antiTriggers=anti[legacy.name]??['the required typed input does not exist','the task belongs to a materially different technique'];
  const description=`Use when ${focus}, especially when ${(legacy.method?.verification?.[0]??'the result requires independent verification').replace(/^./,(c)=>c.toLowerCase())}.`;
  const overview=`---\nname: ${legacy.name}\ndescription: ${JSON.stringify(description)}\nlicense: MIT\ncompatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.\nmetadata:\n  version: \"1.0.0\"\n  maturity: stable\n  skill-type: technique\n---\n\n# ${title(legacy.name)}\n\n## Core principle\n\n${focus[0].toUpperCase()+focus.slice(1)}. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.\n\n## When not to use\n\n${mdList(antiTriggers)}\n\nLoad only the sections selected by the RoutePlan.\n`;
  await writeFile(path.join(root,'SKILL.md'),overview);
  for(const section of ['procedure','decision-tables','verification','failure-modes','examples'])await writeFile(path.join(root,'sections',`${section}.md`),sectionText(legacy,section));
  const initialIndex=await buildSectionIndex(root,{registry});
  const model='gpt-5.6';const byId=new Map(initialIndex.sections.map((s)=>[s.id,s]));const defaults=['overview','procedure','verification'];const optional=['decision-tables','failure-modes','examples'];
  const targetTokens=defaults.reduce((sum,id)=>sum+(byId.get(id)?.tokens[model]??0),0)+96;const hardTokens=initialIndex.sections.reduce((sum,s)=>sum+(s.tokens[model]??0),0)+256;
  const v2=validateSkillContractV2({schemaVersion:2,id:legacy.name,version:'1.0.0',skillType:'technique',maturity:'stable',identity:{title:title(legacy.name),description,domains:legacy.domains?.length?legacy.domains:['all'],subdomains:[legacy.pack],keywords:[legacy.name,...String(focus).split(/\W+/).filter(Boolean).slice(0,8)],antiTriggers},relations:{requires:[...(legacy.consumes??[])],specializes:[],composedWith:[],conflictsWith:[...(legacy.conflicts??[])],alternativesTo:[],supersedes:[]},contract:{consumes:(legacy.consumes??[]).map((type)=>({type,schema:`artifact://forgeos/${type}/v1`})),produces:(legacy.produces??[]).map((type)=>({type,schema:`artifact://forgeos/${type}/v1`})),invariants:[`Output remains within the ${legacy.name} responsibility boundary`,'Every pass claim is backed by current trusted evidence'],requiredTools:[...(legacy.requiredTools??legacy.tools??[])],optionalTools:[...(legacy.optionalTools??[])]},procedure:{entryConditions:[...(legacy.preconditions?.length?legacy.preconditions:['typed inputs are present'])],steps:(legacy.method?.steps??legacy.procedure??[]).slice(0,8).map((action,index)=>({id:`step-${index+1}`,action,evidence:legacy.method?.evidence?.[Math.min(index,(legacy.method?.evidence?.length??1)-1)]??'contract-validation'})),fallbackPaths:[{condition:'required tool, input, or approval is unavailable',action:'stop and record a typed blocker'}],stopConditions:[legacy.handoff?.stopWhen??'output contract is satisfied or a blocker is recorded']},verification:{executableChecks:[...(legacy.method?.verification??legacy.gate?.rules??[]).slice(0,8)],reviewerRole:legacy.gate?.reviewerRole??'independent-reviewer',independentReview:true,evidenceTypes:[...(legacy.method?.evidence??legacy.handoff?.requiredEvidence??[]).slice(0,8)],evaluatorIds:[`${legacy.name}-evaluator`]},context:{defaultSections:defaults,optionalSections:optional,maxDirectArtifacts:legacy.context?.maxArtifacts??8,maxReferenceDepth:legacy.context?.maxReferenceDepth??1,targetTokens,hardTokens,outputReserveTokens:Math.min(700,Math.max(256,Math.floor(hardTokens*.25)))},quality:{benchmarkIds:[`v04-${legacy.name}-behavior`],minimumSkillDepthScore:82,compatibleModels:['frontier','mid-size','local-7b-plus'],knownLimitations:['Migrated from the v0.4 stable behavioral contract; independent v0.5 holdout expansion remains required.']},policyProfiles:['forgeos-artifact-envelope-v2','independent-review-v1','fresh-evidence-v2','bounded-context-v2']});
  const sectionIndex=await buildSectionIndex(root,{registry});const policyProfileHashes=resolvePolicyProfileHashes(v2.policyProfiles,profiles);const manifest={...v2,capabilityMappings:mapping.capabilityIds.map((capabilityId)=>({capabilityId,fitScore:mapping.fitScore,mappingEvidence:`reviewed:v0.5:${legacy.name}`,reviewer:'forgeos-release-reviewer',reviewedAt:'2026-07-25T00:00:00.000Z'})),policyProfileHashes,sectionIndex,manifestSha256:null};manifest.manifestSha256=canonicalSha256({...manifest,manifestSha256:null});await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');built.push({id:legacy.name,path:path.relative(ROOT,root).replaceAll(path.sep,'/'),manifestSha256:manifest.manifestSha256,maturity:manifest.maturity,capabilityIds:mapping.capabilityIds,defaultSections:defaults,targetTokens,hardTokens,sectionIndex});
 }
 await mkdir(path.join(ROOT,'skills-v2'),{recursive:true});await writeFile(path.join(ROOT,'skills-v2/catalog.json'),JSON.stringify(built,null,2)+'\n');console.log(`Migrated ${built.length} stable skills to Skill Contract v2.`);
}
run().catch((error)=>{console.error(error);process.exitCode=1;});
