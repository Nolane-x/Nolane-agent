import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../src/core/canonical-json.mjs';
import { canonicalTextContent } from '../src/core/canonical-text.mjs';
import { runAcceptanceCommand } from './archive-acceptance.mjs';
import { PRODUCT } from '../src/core/constants.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=(value)=>createHash('sha256').update(value).digest('hex');
export const RELEASE_COMMANDS=Object.freeze([
  'npm run generate:capabilities','npm run generate:knowledge','npm run generate:v06','npm run v06:audit',
  'npm run skills:v2:audit','npm run skills:certification-audit','npm run test:mutation-critical','npm run router:benchmark','npm run context:benchmark',
  'npm run federation:eval','npm run federation:audit',
  'npm test','npm run lint:syntax','npm run lint:json','npm run lint:docs','npm run lint:skills','npm run lint:adapters',
  'npm run smoke','npm run adapter:tck','npm run test:coverage','node scripts/capture-dashboard.mjs',
]);
const SOURCE_IGNORES=new Set(['.git','node_modules','dist','.forgeos-data','.forgeos-demo-data','coverage','.worktrees']);
const TEXT_SOURCE_EXTENSIONS=new Set(['.cjs','.css','.html','.js','.json','.md','.mjs','.svg','.toml','.txt','.yaml','.yml']);
function git(root,args){const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});return result.status===0?result.stdout.trim():null;}
function parseCount(output,label){for(const pattern of [new RegExp(`(?:ℹ|#)\\s*${label}\\s+(\\d+)`,'i'),new RegExp(`${label}:\\s*(\\d+)`,'i')]){const match=pattern.exec(output);if(match)return Number(match[1]);}return null;}
function parseCoverage(output){const match=/all files\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)/i.exec(output);return match?{lines:Number(match[1]),branches:Number(match[2]),functions:Number(match[3])}:null;}

async function walk(root,directory=root,prefix=''){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(SOURCE_IGNORES.has(entry.name))continue;
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;const full=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await walk(root,full,relative));else if(entry.isFile())files.push(relative);
  }
  return files;
}
export async function buildSourceManifest(root=ROOT){
  const entries=[];
  for(const relativePath of (await walk(root)).sort()){
    const raw=await readFile(path.join(root,relativePath));const data=TEXT_SOURCE_EXTENSIONS.has(path.extname(relativePath).toLowerCase())?Buffer.from(canonicalTextContent(raw.toString('utf8'))):raw;entries.push({relativePath,sizeBytes:data.byteLength,sha256:sha(data)});
  }
  return {algorithm:'sha256-canonical-text-v1',files:entries.length,entries,sha256:canonicalSha256(entries)};
}

async function inventory(root){
  const catalog=JSON.parse(await readFile(path.join(root,'skills/catalog.json'),'utf8'));
  const evalFiles=(await readdir(path.join(root,'evals/cases'))).filter((name)=>name.endsWith('.json'));
  const evalCases=await Promise.all(evalFiles.map((name)=>readFile(path.join(root,'evals/cases',name),'utf8').then(JSON.parse)));
  const adapters=JSON.parse(await readFile(path.join(root,'tck/platform-capabilities.json'),'utf8'));
  const references=[];async function refs(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isDirectory())await refs(full);else references.push(path.relative(root,full));}}await refs(path.join(root,'skills/references'));
  return {skills:{total:catalog.length,core:catalog.filter((item)=>item.kind==='core').length,domain:catalog.filter((item)=>item.kind==='domain').length,stable:catalog.filter((item)=>item.status==='stable').length,candidate:catalog.filter((item)=>item.status==='candidate').length,quarantined:catalog.filter((item)=>item.status==='quarantined').length,referencePlaybooks:references.length},adapters:{total:adapters.adapters.length,executable:adapters.adapters.filter((item)=>item.verification==='executable').length,documented:adapters.adapters.filter((item)=>item.verification==='documentation').length,capabilities:adapters.capabilities.length},evalCases:{total:evalCases.length,domains:new Set(evalCases.map((item)=>item.domain)).size}};
}

export function summarizeCommand(command,run,durationMs){const output=`${run.stdout??''}${run.stderr??''}`;return {command,exitCode:run.status??1,signal:run.signal??null,durationMs,outputSha256:sha(output),outputBytes:Buffer.byteLength(output),outputTail:output.trim().split('\n').slice(-30),rawOutput:output};}
function windowsNodeExpression(command){
  const value=String(command);const prefix=`${process.execPath} -e `;
  if(process.platform!=='win32'||!value.startsWith(prefix))return null;
  let source=value.slice(prefix.length).trim();
  for(let depth=0;depth<2&&source.startsWith('"')&&source.endsWith('"');depth++){
    try{const decoded=JSON.parse(source);if(typeof decoded!=='string')break;source=decoded;}catch{break;}
  }
  return {command:process.execPath,args:['-e',source]};
}
export async function runCommandMatrix(commands,{root=ROOT,env={},onProgress=()=>{},commandTimeoutMs=300_000}={}){
  const results=[];
  const shell=process.platform==='win32'?{command:'cmd.exe',args:(value)=>['/d','/s','/c',value]}:{command:'/bin/sh',args:(value)=>['-lc',value]};
  for(let index=0;index<commands.length;index++){const command=commands[index];const native=windowsNodeExpression(command);onProgress({phase:'start',command,index:index+1,total:commands.length});const started=Date.now();const run=await runAcceptanceCommand(native?.command??shell.command,native?.args??shell.args(command),root,env,{timeoutMs:commandTimeoutMs});const result=summarizeCommand(command,{status:run.code,signal:run.signal,stdout:run.stdout,stderr:run.stderr},Date.now()-started);if(run.timedOut)result.timedOut=true;onProgress({phase:'finish',command,index:index+1,total:commands.length,result});results.push(result);}
  return results;
}

export async function createVerificationReport({root=ROOT,outputDirectory=null,startedAt,sourceCommit=null,sourceTree=null,dirtyAtStart=null,sourceManifest=null,finalSourceManifest=null,results,status}){
  const packageJson=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));const inv=await inventory(root);
  const testOutput=results.find((item)=>item.command==='npm test')?.rawOutput??'';const coverageOutput=results.find((item)=>item.command==='npm run test:coverage')?.rawOutput??'';
  const evidenceRoot=outputDirectory??path.join(root,'evidence');let adapterTck;try{adapterTck=JSON.parse(await readFile(path.join(evidenceRoot,'adapter-tck.json'),'utf8'));}catch{adapterTck={summary:{total:inv.adapters.total,executed:0,documented:inv.adapters.documented,passed:0,failed:0},status:'not-run'};}
  let federationAudit=null;try{federationAudit=JSON.parse(await readFile(path.join(evidenceRoot,'federation-audit.json'),'utf8'));}catch{}
  let federationAdversarial=null;try{federationAdversarial=JSON.parse(await readFile(path.join(evidenceRoot,'federation-adversarial.json'),'utf8'));}catch{}
  let skillIntelligenceAudit=null;try{skillIntelligenceAudit=JSON.parse(await readFile(path.join(evidenceRoot,'skill-intelligence-audit.json'),'utf8'));}catch{}
  let routerBenchmark=null;try{routerBenchmark=JSON.parse(await readFile(path.join(evidenceRoot,'router-benchmark-v2.json'),'utf8'));}catch{}
  let contextBenchmark=null;try{contextBenchmark=JSON.parse(await readFile(path.join(evidenceRoot,'context-benchmark-v2.json'),'utf8'));}catch{}
  let skillCertification=null;try{skillCertification=JSON.parse(await readFile(path.join(evidenceRoot,'skill-certification-audit.json'),'utf8'));}catch{}
  let criticalMutation=null;try{criticalMutation=JSON.parse(await readFile(path.join(evidenceRoot,'critical-mutation-report.json'),'utf8'));}catch{}
  let dashboardEvidence=null;try{const artifactPath=path.join(evidenceRoot,'dashboard.svg');const image=await readFile(artifactPath);const renderer=(await readFile(path.join(evidenceRoot,'dashboard-renderer.txt'),'utf8')).trim();const info=await stat(artifactPath);dashboardEvidence={path:path.relative(root,artifactPath).replaceAll(path.sep,'/'),mediaType:'image/svg+xml',bytes:info.size,sha256:sha(image),renderer};}catch{}
  const manifest=sourceManifest??await buildSourceManifest(root);
  return {schemaVersion:3,project:PRODUCT.name,version:packageJson.version,status,startedAt,finishedAt:new Date().toISOString(),source:{mode:sourceCommit?'git':'archive',commit:sourceCommit,tree:sourceTree,dirtyAtStart,manifestAlgorithm:manifest.algorithm,manifestSha256:manifest.sha256,manifestFiles:manifest.files,stableAfterVerification:finalSourceManifest?finalSourceManifest.sha256===manifest.sha256:null,finalManifestSha256:finalSourceManifest?.sha256??null},environment:{node:process.version,platform:process.platform,arch:process.arch},summary:{tests:{total:parseCount(testOutput,'tests'),passed:parseCount(testOutput,'pass'),failed:parseCount(testOutput,'fail')},coverage:parseCoverage(coverageOutput),...inv,federation:federationAudit?{inventory:federationAudit.inventory,coverage:federationAudit.coverage,adversarial:federationAudit.adversarial,reportSha256:federationAudit.reportSha256}:null,federationAdversarial:federationAdversarial?.summary??null,skillIntelligence:skillIntelligenceAudit?{graph:skillIntelligenceAudit.graph,skillsV2:skillIntelligenceAudit.skillsV2,quality:skillIntelligenceAudit.quality,stableMaterialization:skillIntelligenceAudit.stableMaterialization,reportSha256:skillIntelligenceAudit.reportSha256}:null,routerBenchmark:routerBenchmark?{cases:routerBenchmark.cases,metrics:routerBenchmark.metrics,reportSha256:routerBenchmark.reportSha256}:null,contextBenchmark:contextBenchmark?{stableMaterialization:contextBenchmark.stableMaterialization,globalBudget:contextBenchmark.globalBudget,toolDistillation:contextBenchmark.toolDistillation,semanticAbi:contextBenchmark.semanticAbi,reportSha256:contextBenchmark.reportSha256}:null,skillCertification:skillCertification?{inventory:skillCertification.inventory,packageEvidence:skillCertification.packageEvidence,evidenceQualified:skillCertification.evidenceQualified,kernel:skillCertification.kernel,claims:skillCertification.claims,blockers:skillCertification.blockers,reportSha256:skillCertification.reportSha256}:null,criticalMutation:criticalMutation?{total:criticalMutation.total,killed:criticalMutation.killed,survived:criticalMutation.survived??[],schemaVersion:criticalMutation.schemaVersion??null}:null,protocols:PRODUCT.protocolTargets,adapterTck:adapterTck.summary},dashboardEvidence,commands:results.map(({rawOutput,...result})=>result),residualRisks:[{severity:'high',area:'distributed-storage',description:'The file backend uses fenced leases and audit hashes but is not a consensus database; production multi-node deployments require a transactional database backend.'},{severity:'high',area:'untrusted-execution',description:'Third-party executors require an external sandbox and capability policy.'},{severity:'medium',area:'transport',description:'Internet deployment requires trusted TLS termination and identity integration.'},{severity:'medium',area:'platforms',description:'Adapter TCK proves the declared protocol configuration, not vendor certification.'}],claimsBoundary:'This report proves only the canonical source manifest and commands recorded in this run. It does not prove defect-free software, external vendor certification, or environments outside the tested matrix.'};
}
function markdown(report){const tests=report.summary.tests;const coverage=report.summary.coverage;const testText=tests.total===null?'not run':`${tests.passed}/${tests.total} passed; ${tests.failed} failed`;return `# ForgeOS ${report.version} Verification Report\n\n- **Status:** ${report.status}\n- **Source mode:** ${report.source.mode}\n- **Source manifest:** \`${report.source.manifestSha256}\` (${report.source.manifestFiles} files; ${report.source.manifestAlgorithm})\n- **Source commit:** \`${report.source.commit??'not present in archive'}\`\n- **Dirty before verification:** ${report.source.dirtyAtStart===null?'not applicable':report.source.dirtyAtStart?'yes':'no'}\n- **Tests:** ${testText}\n- **Coverage:** ${coverage?`${coverage.lines}% lines · ${coverage.branches}% branches · ${coverage.functions}% functions`:'not available'}\n- **Evidence-qualified stable skills:** ${report.summary.skillCertification?.evidenceQualified?.stable??'not audited'}\n- **Certified skills:** ${report.summary.skillCertification?.evidenceQualified?.certified??'not audited'}\n- **Critical mutation matrix:** ${report.summary.criticalMutation?`${report.summary.criticalMutation.killed}/${report.summary.criticalMutation.total} killed`:'not run'}\n\n## Commands\n\n${report.commands.map((item)=>`- \`${item.command}\` — exit ${item.exitCode}, ${item.durationMs} ms, output \`${item.outputSha256}\``).join('\n')}\n\n## Claims boundary\n\n${report.claimsBoundary}\n`;}

export async function runReleaseVerification({commands=RELEASE_COMMANDS,root=ROOT,outputRoot=process.env.FORGEOS_VERIFICATION_OUTPUT_ROOT??path.join(ROOT,'dist','verification-runs'),allowDirty=process.env.FORGEOS_ALLOW_DIRTY_RELEASE==='1',onProgress=()=>{}}={}){
  const startedAt=new Date().toISOString();const sourceManifest=await buildSourceManifest(root);const sourceCommit=git(root,['rev-parse','HEAD']);const sourceTree=sourceCommit?git(root,['rev-parse','HEAD^{tree}']):null;const porcelain=sourceCommit?git(root,['status','--porcelain']):null;const dirtyAtStart=sourceCommit?Boolean(porcelain):null;
  const runId=`verify_${startedAt.replaceAll(/[:.]/g,'-')}_${sourceManifest.sha256.slice(0,12)}`;const outputDirectory=path.join(outputRoot,runId);await mkdir(outputDirectory,{recursive:true});
  const results=await runCommandMatrix(commands,{root,onProgress,env:{FORGEOS_VERIFICATION_RUN:'1',FORGEOS_ADAPTER_TCK_OUTPUT:path.join(outputDirectory,'adapter-tck.json'),FORGEOS_DASHBOARD_OUTPUT:outputDirectory,FORGEOS_FEDERATION_AUDIT_OUTPUT:path.join(outputDirectory,'federation-audit.json'),FORGEOS_FEDERATION_EVAL_OUTPUT:path.join(outputDirectory,'federation-adversarial.json'),FORGEOS_FEDERATION_DATA:path.join(outputDirectory,'federation-data'),FORGEOS_SKILL_INTELLIGENCE_AUDIT_OUTPUT:path.join(outputDirectory,'skill-intelligence-audit.json'),FORGEOS_ROUTER_BENCHMARK_OUTPUT:path.join(outputDirectory,'router-benchmark-v2.json'),FORGEOS_CONTEXT_BENCHMARK_OUTPUT:path.join(outputDirectory,'context-benchmark-v2.json'),FORGEOS_SKILL_CERTIFICATION_AUDIT_OUTPUT:path.join(outputDirectory,'skill-certification-audit.json'),FORGEOS_MUTATION_OUTPUT:path.join(outputDirectory,'critical-mutation-report.json')}});
  const finalSourceManifest=await buildSourceManifest(root);
  const sourceStable=finalSourceManifest.sha256===sourceManifest.sha256;
  const status=results.some((item)=>item.exitCode!==0)||!sourceStable||(dirtyAtStart&&!allowDirty)?'fail':'pass';
  const report=await createVerificationReport({root,outputDirectory,startedAt,sourceCommit,sourceTree,dirtyAtStart,sourceManifest,finalSourceManifest,results,status});await writeFile(path.join(outputDirectory,'source-manifest.json'),`${JSON.stringify(sourceManifest,null,2)}\n`);await writeFile(path.join(outputDirectory,'verification-report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(path.join(outputDirectory,'verification-report.md'),markdown(report));
  if(status!=='pass'){const failed=results.filter((item)=>item.exitCode!==0).map((item)=>item.command);throw Object.assign(new Error(`Release verification failed${dirtyAtStart&&!allowDirty?' because the source tree was dirty':''}${!sourceStable?' because generated or verification commands changed canonical source content':''}${failed.length?` at: ${failed.join(', ')}`:''}`),{report,outputDirectory});}
  const testSummary=report.summary.tests.total===null?'tests not run':`${report.summary.tests.passed}/${report.summary.tests.total} tests`;
  console.log(`ForgeOS ${report.version} verified: ${testSummary}; source manifest ${sourceManifest.sha256}.`);return {report,outputDirectory};
}
export async function runReleaseCli({verify=runReleaseVerification,exit=(code)=>process.exit(code),logError=(message)=>console.error(message)}={}){
  try{await verify({onProgress:({phase,index,total,command,result})=>{if(phase==='start')console.error(`[${index}/${total}] ${command}`);else console.error(`[${index}/${total}] ${command} -> ${result.exitCode} (${result.durationMs} ms)`);}});exit(0);}
  catch(error){logError(error.message);exit(1);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){await runReleaseCli();}
