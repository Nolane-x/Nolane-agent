import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT } from '../src/core/constants.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'tck/platform-capabilities.json');
const MCP_VERSION = '2025-11-25';

export async function loadAdapterTckManifest() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.adapters)) throw new Error('Unsupported adapter TCK manifest');
  return manifest;
}

function commandFromConfig(config) {
  const mcp = config.mcpServers?.forgeos;
  if (mcp) return { command:mcp.command, args:mcp.args ?? [], env:mcp.env ?? {} };
  const openCode = config.mcp?.forgeos;
  if (openCode) {
    const command = openCode.command;
    if (!Array.isArray(command) || command.length === 0) throw new Error('OpenCode command must be a non-empty array');
    return { command:command[0], args:command.slice(1), env:openCode.environment ?? {} };
  }
  throw new Error('No ForgeOS MCP server declaration found');
}

async function gitSha() {
  try { return (await execFileAsync('git',['rev-parse','HEAD'],{cwd:ROOT})).stdout.trim(); }
  catch { return null; }
}

async function executeStdioAdapter(adapter, timeoutMs) {
  const configPath = path.join(ROOT, adapter.config);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const declaration = commandFromConfig(config);
  const tempData = await mkdtemp(path.join(os.tmpdir(), `forgeos-tck-${adapter.id}-`));
  const child = spawn(declaration.command, declaration.args, {
    cwd:ROOT,
    env:{...process.env,...declaration.env,FORGEOS_DATA_DIR:tempData,FORGEOS_STDIO_PRINCIPAL:`service:tck:${adapter.id}`},
    stdio:['pipe','pipe','pipe'],
  });
  const pending = new Map();
  let buffer=''; let stderr='';
  const settle = (message) => {
    const entry=pending.get(String(message.id));
    if(entry){pending.delete(String(message.id));entry.resolve(message);}
  };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',(chunk)=>{buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);if(!line)continue;try{settle(JSON.parse(line));}catch{/* malformed output handled by timeout */}}});
  child.stderr.setEncoding('utf8'); child.stderr.on('data',(chunk)=>{stderr+=chunk;});
  let nextId=1;
  const send = (method, params, { notification=false }={}) => {
    const request={jsonrpc:'2.0',...(notification?{}:{id:nextId++}),method,...(params===undefined?{}:{params})};
    child.stdin.write(`${JSON.stringify(request)}\n`);
    if(notification)return Promise.resolve(null);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(String(request.id));reject(new Error(`Timed out waiting for ${method}; stderr=${stderr.slice(-1000)}`));},timeoutMs);
      pending.set(String(request.id),{resolve:(value)=>{clearTimeout(timer);resolve(value);}});
    });
  };
  try {
    const initialize=await send('initialize',{protocolVersion:MCP_VERSION,capabilities:{},clientInfo:{name:`forgeos-tck-${adapter.id}`,version:'1.0.0'}});
    if(initialize.error)throw new Error(`initialize failed: ${JSON.stringify(initialize.error)}`);
    await send('notifications/initialized',undefined,{notification:true});
    const tools=await send('tools/list',{});
    if(tools.error)throw new Error(`tools/list failed: ${JSON.stringify(tools.error)}`);
    const toolCount=tools.result?.tools?.length ?? 0;
    if(toolCount===0)throw new Error('tools/list returned no tools');
    return {status:'pass',protocolVersion:initialize.result.protocolVersion,toolCount,checks:{processStarted:true,initialize:true,readyNotification:true,toolsList:true}};
  } finally {
    child.stdin.end();
    child.kill('SIGTERM');
    await rm(tempData,{recursive:true,force:true});
  }
}

export async function runAdapterTck({ outputFile=process.env.FORGEOS_ADAPTER_TCK_OUTPUT??path.join(ROOT,'evidence/adapter-tck.json'), timeoutMs=10_000 }={}) {
  const manifest=await loadAdapterTckManifest();
  const results=[];
  for(const adapter of manifest.adapters){
    const missing=[];
    for(const evidence of adapter.evidence ?? []){try{await access(path.join(ROOT,evidence));}catch{missing.push(evidence);}}
    if(missing.length){results.push({...adapter,status:'fail',error:`Missing evidence: ${missing.join(', ')}`});continue;}
    if(adapter.verification==='documentation'){results.push({...adapter,status:'documented',checks:{evidenceFiles:true}});continue;}
    try{results.push({...adapter,...await executeStdioAdapter(adapter,timeoutMs)});}catch(error){results.push({...adapter,status:'fail',error:error.message});}
  }
  const executed=results.filter((item)=>item.verification==='executable').length;
  const failed=results.filter((item)=>item.status==='fail').length;
  const report={schemaVersion:1,productVersion:PRODUCT.version,sourceCommit:await gitSha(),generatedAt:new Date().toISOString(),scope:'Local executable protocol checks and documentation presence; not external vendor certification.',capabilities:manifest.capabilities,adapters:results,summary:{total:results.length,executed,documented:results.length-executed,passed:results.filter((item)=>item.status==='pass').length,failed}};
  await mkdir(path.dirname(outputFile),{recursive:true});
  await writeFile(outputFile,`${JSON.stringify(report,null,2)}\n`);
  if(failed)throw Object.assign(new Error(`${failed} adapter TCK checks failed`),{report});
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const report=await runAdapterTck(); console.log(`Adapter TCK: ${report.summary.passed}/${report.summary.executed} executable adapters passed; ${report.summary.documented} documented.`); }
  catch(error){console.error(error.report ? JSON.stringify(error.report,null,2) : error.stack);process.exitCode=1;}
}
