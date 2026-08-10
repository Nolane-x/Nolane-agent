import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { auditSkillDepth, auditBoilerplate } from '../evals/skill-depth-audit.mjs';
import { SkillIntelligenceService } from '../intelligence/service.mjs';
import { loadCapabilityGraphV2 } from '../capabilities/v2/compiler.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const json=(file)=>readFile(file,'utf8').then(JSON.parse);
function substantiveLines(markdown){let text=String(markdown).replace(/^---[\s\S]*?---\s*/,'');return text.split(/\r?\n/).map((line)=>line.trim()).filter((line)=>line&&!/^#{1,6}\s/.test(line)&&!/^```/.test(line)&&!/^[-*_]{3,}$/.test(line)).map((line)=>line.replace(/^[-*]\s+/,'').replace(/^\d+\.\s+/,''));}
export async function runSkillIntelligenceAudit({root=ROOT,model='gpt-5.6'}={}){
 const [catalog,kernelIndex,l1Index,graph]=await Promise.all([json(path.join(root,'skills-v2/catalog.json')),json(path.join(root,'skills-v2/kernel-index.json')),json(path.join(root,'skills-v2/l1-index.json')),loadCapabilityGraphV2(path.join(root,'capabilities-v2/graph.json'))]);
 const audits=[];const bodies=[];
 for(const entry of catalog){const directory=path.join(root,entry.path);const [manifest,body]=await Promise.all([json(path.join(directory,'manifest.json')),readFile(path.join(directory,'SKILL.md'),'utf8')]);const depth=auditSkillDepth(manifest);audits.push({id:manifest.id,maturity:manifest.maturity,kernelLevel:manifest.kernelLevel??null,score:depth.score,manifestSha256:manifest.manifestSha256});bodies.push({id:manifest.id,lines:substantiveLines(body)});}
 const boiler=auditBoilerplate(bodies,{commonThreshold:.8});const maximumBoilerplateRatio=Math.max(0,...boiler.skills.map((item)=>item.boilerplateRatio));const minimumDepthScore=Math.min(...audits.map((item)=>item.score));const invalidDepth=audits.filter((item)=>item.score<(item.maturity==='stable'?82:60));const boilerplateViolations=boiler.skills.filter((item)=>item.boilerplateRatio>.35);
 const service=new SkillIntelligenceService({root});const stableMaterialization=await service.auditStableMaterialization({model});
 const payload={schemaVersion:1,auditId:'forgeos-skill-intelligence-v06',graph:{outcomeScaffolds:graph.outcomes.length,deepOutcomes:graph.outcomes.filter((item)=>item.legacyScaffold!==true).length,techniques:graph.techniques.length,l0Techniques:graph.techniques.filter((item)=>item.kernelLevel==='L0').length,l1Techniques:graph.techniques.filter((item)=>item.kernelLevel==='L1').length,kernelTechniques:graph.techniques.filter((item)=>['L0','L1'].includes(item.kernelLevel)).length,evaluators:graph.evaluators.length,relations:graph.relations.length,graphSha256:graph.graphSha256},skillsV2:{total:catalog.length,stable:catalog.filter((item)=>item.maturity==='stable').length,candidate:catalog.filter((item)=>item.maturity==='candidate').length,l0:kernelIndex.count,l1:l1Index.count,kernel:kernelIndex.count+l1Index.count},quality:{minimumDepthScore,medianDepthScore:[...audits].sort((a,b)=>a.score-b.score)[Math.floor(audits.length/2)]?.score??0,invalidDepth:invalidDepth.length,invalidDepthSkills:invalidDepth,maximumBoilerplateRatio:Number(maximumBoilerplateRatio.toFixed(6)),boilerplateViolations:boilerplateViolations.length,boilerplateViolationSkills:boilerplateViolations},stableMaterialization};return Object.freeze({...payload,reportSha256:canonicalSha256(payload)});
}
