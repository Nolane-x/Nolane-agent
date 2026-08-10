import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(args){const result=spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',maxBuffer:16*1024*1024});if(result.status!==0)throw new Error(`${args.join(' ')} failed: ${result.stderr||result.stdout}`);return result.stdout.trim();}
export async function captureDashboard({outputDirectory=process.env.FORGEOS_DASHBOARD_OUTPUT??path.join(ROOT,'evidence')}={}){
  const dataDir=await mkdtemp(path.join(os.tmpdir(),'forgeos-dashboard-'));
  try{
    await mkdir(outputDirectory,{recursive:true});
    const projectId=run(['scripts/create-demo-project.mjs',dataDir]).split(/\s+/).at(-1);
    const html=path.join(outputDirectory,'dashboard.html');const svg=path.join(outputDirectory,'dashboard.svg');
    run(['scripts/render-demo-html.mjs',dataDir,projectId,html]);
    run(['scripts/render-dashboard-evidence.mjs',dataDir,projectId,svg]);
    await writeFile(path.join(outputDirectory,'dashboard-renderer.txt'),'forgeos-svg\n','utf8');
    return {projectId,html,svg,renderer:'forgeos-svg'};
  }finally{await rm(dataDir,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=await captureDashboard();console.log(`Captured ${result.svg} with ${result.renderer}`);}catch(error){console.error(error.stack??error.message);process.exitCode=1;}
}
