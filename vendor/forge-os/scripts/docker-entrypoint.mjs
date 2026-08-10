import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const host=process.env.HOST||'0.0.0.0';
const port=String(process.env.FORGEOS_PORT||process.env.PORT||8787);
let apiKey=String(process.env.FORGEOS_API_KEY||'').trim();
if(!apiKey&&process.env.FORGEOS_API_KEY_FILE){
  apiKey=String(await readFile(process.env.FORGEOS_API_KEY_FILE,'utf8')).trim();
  if(!apiKey)throw new Error('FORGEOS_API_KEY_FILE is empty');
}
const generated=!apiKey;
if(!apiKey)apiKey=randomBytes(32).toString('base64url');
const publicBaseUrl=process.env.FORGEOS_PUBLIC_BASE_URL||`http://${host}:${port}`;
const allowedOrigins=process.env.FORGEOS_ALLOWED_ORIGINS||publicBaseUrl;
const config={host,port:Number(port),publicBaseUrl,allowedOrigins,apiKey,generated};

if(process.env.FORGEOS_DRY_RUN==='1'){
  process.stdout.write(`${JSON.stringify(config)}\n`);
  process.exit(0);
}
if(generated)process.stderr.write(`[ForgeOS] Generated an ephemeral API key for this container: ${apiKey}\n[ForgeOS] Set FORGEOS_API_KEY explicitly for stable production credentials.\n`);
const child=spawn(process.execPath,['src/server/http-server.mjs'],{stdio:'inherit',env:{...process.env,HOST:host,FORGEOS_PORT:port,FORGEOS_API_KEY:apiKey,FORGEOS_PUBLIC_BASE_URL:publicBaseUrl,FORGEOS_ALLOWED_ORIGINS:allowedOrigins}});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>process.exitCode=signal?1:(code??1));
