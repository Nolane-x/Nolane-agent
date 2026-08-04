import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(args)=>{const result=spawnSync('git',args,{cwd:ROOT,encoding:'utf8'});return result.status===0?result.stdout.trim():null;};
const mime=(file)=>file.endsWith('.md')?'text/markdown':file.endsWith('.json')?'application/json':file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.pdf')?'application/pdf':file.endsWith('.html')?'text/html':file.endsWith('.yml')||file.endsWith('.yaml')?'application/yaml':file.endsWith('.sh')?'application/x-sh':file.endsWith('.lock')?'application/json':file==='LICENSE'||path.basename(file).startsWith('.')?'text/plain':'application/octet-stream';
const description=(file)=>{
  if(file==='README.md')return 'Primary ForgeOS project overview, verified capabilities, quickstart, architecture, and trust boundaries.';
  if(/^README-/.test(file))return 'Localized ForgeOS project overview and quickstart.';
  if(file.endsWith('/SKILL.md'))return 'Portable Agent Skill instructions with a typed contract and independent evidence gate.';
  if(file.endsWith('/contract.json'))return 'Machine-readable skill routing, tool, assurance, and handoff contract.';
  if(file.startsWith('src/'))return 'ForgeOS runtime source module.';
  if(file.startsWith('tests/'))return 'Automated invariant, protocol, security, lifecycle, or release test.';
  if(file.startsWith('schemas/'))return 'Generated public JSON Schema 2020-12 runtime contract.';
  if(file.startsWith('adapters/')||file.startsWith('.claude-plugin')||file==='.mcp.json')return 'Platform integration configuration or installation guidance.';
  if(file.startsWith('evals/'))return 'Behavioral evaluation case or utility rubric.';
  if(file.startsWith('evidence/'))return 'Generated release verification, compatibility, or visual evidence.';
  if(file.startsWith('docs/'))return 'ForgeOS architecture, security, protocol, testing, or governance documentation.';
  if(file.startsWith('scripts/'))return 'Generation, validation, smoke, TCK, capture, or release automation.';
  if(file.startsWith('assets/'))return 'Project visual asset.';
  if(file.startsWith('.github/'))return 'GitHub collaboration, security, or CI configuration.';
  return 'ForgeOS release file.';
};
const statusFor=(file)=>{
  if(file.startsWith('tests/'))return 'tested';
  if(file.endsWith('/contract.json')||file==='skills/catalog.json'||file.startsWith('schemas/'))return 'validated';
  if(file.endsWith('/SKILL.md'))return 'validated';
  if(file.startsWith('docs/')||file.startsWith('README')||file==='SECURITY.md'||file==='CONTRIBUTING.md'||file==='GOVERNANCE.md'||file==='CODE_OF_CONDUCT.md')return 'linted';
  if(file.startsWith('adapters/')||file==='.mcp.json'||file.startsWith('.claude-plugin/'))return file.endsWith('.json')?'tck-checked':'linted';
  if(file.startsWith('src/'))return 'release-checked';
  if(file.startsWith('evidence/'))return 'generated';
  return 'hashed';
};

async function archiveFiles(directory=ROOT,prefix=''){
  const ignored=new Set(['.git','node_modules','.forgeos-data','.forgeos-demo-data','coverage','.worktrees']);
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(ignored.has(entry.name))continue;
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;
    if(relative==='project-manifest.json')continue;
    if(entry.isDirectory())files.push(...await archiveFiles(path.join(directory,entry.name),relative));
    else if(entry.isFile())files.push(relative);
  }
  return files;
}

async function optionalJson(file){try{return JSON.parse(await readFile(path.join(ROOT,file),'utf8'));}catch{return null;}}

export async function buildProjectManifest({includeUntracked=true,useGit=true}={}){
  const pkg=JSON.parse(await readFile(path.join(ROOT,'package.json'),'utf8'));
  const command=includeUntracked?['ls-files','--cached','--others','--exclude-standard']:['ls-files'];
  const gitListing=useGit?git(command):null;
  const files=(gitListing!==null
    ? [...new Set(gitListing.split('\n').filter(Boolean))]
    : await archiveFiles())
    .filter((file)=>!file.startsWith('.git/')&&!file.startsWith('node_modules/')&&!file.startsWith('.forgeos-data/')&&file!=='project-manifest.json')
    .sort();
  const entries=[];
  for(const relativePath of files){
    const absolute=path.join(ROOT,relativePath);
    let data;let info;
    try{data=await readFile(absolute);info=await stat(absolute);}catch(error){if(error?.code==='ENOENT')continue;throw error;}
    entries.push({relativePath,fileName:path.basename(relativePath),mimeType:mime(relativePath),version:pkg.version,status:statusFor(relativePath),sizeBytes:info.size,sha256:createHash('sha256').update(data).digest('hex'),description:description(relativePath)});
  }
  entries.push({relativePath:'project-manifest.json',fileName:'project-manifest.json',mimeType:'application/json',version:pkg.version,status:'generated',sizeBytes:null,sha256:null,description:'Workspace export manifest generated from the current release tree.'});
  const report=await optionalJson('evidence/verification-report.json');
  const previous=await optionalJson('project-manifest.json');
  const verification=report?{status:report.status,sourceCommit:report.source?.commit,sourceTree:report.source?.tree,generatedAt:report.finishedAt}:null;
  const commit=useGit?git(['rev-parse','HEAD']):null;
  const tree=commit?git(['rev-parse','HEAD^{tree}']):null;
  const source={
    vcs:commit?'git':'archive',
    commit:commit??previous?.source?.commit??verification?.sourceCommit??null,
    tree:tree??previous?.source?.tree??verification?.sourceTree??null,
    dirty:commit?Boolean(git(['status','--porcelain'])):null,
  };
  return {schemaVersion:2,project:'ForgeOS',version:pkg.version,source,generatedAt:new Date().toISOString(),status:verification?.status==='pass'?'release-candidate':'development',verification,totalFiles:entries.length,files:entries};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const manifest=await buildProjectManifest();await writeFile(path.join(ROOT,'project-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);console.log(`Manifested ${manifest.totalFiles} files for ForgeOS ${manifest.version}.`);
}
