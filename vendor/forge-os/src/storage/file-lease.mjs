import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const timestamp=()=>new Date().toISOString();

export class LeaseLostError extends Error {
  constructor(message='Filesystem lease is no longer owned by this writer') { super(message); this.name='LeaseLostError'; }
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file,'utf8')); }
  catch (error) { if (error.code==='ENOENT') return null; throw error; }
}

async function durableJson(file,value) {
  await mkdir(path.dirname(file),{recursive:true});
  const temp=`${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle=await open(temp,'wx',0o600);
  try { await handle.writeFile(`${JSON.stringify(value)}\n`,'utf8'); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temp,file);
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid<1) return false;
  try { process.kill(pid,0); return true; }
  catch (error) { return error.code==='EPERM'; }
}

async function nextFence(lockDir) {
  const file=`${lockDir}.fence`;
  let current=0;
  try { current=Number((await readFile(file,'utf8')).trim())||0; } catch (error) { if(error.code!=='ENOENT') throw error; }
  const next=current+1;
  const temp=`${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle=await open(temp,'wx',0o600);
  try { await handle.writeFile(`${next}\n`,'utf8'); await handle.sync(); } finally { await handle.close(); }
  await rename(temp,file);
  return next;
}

export async function acquireFileLease(lockDir,{
  acquireTimeoutMs=10_000,
  leaseMs=15_000,
  heartbeatMs=Math.max(250,Math.floor(leaseMs/3)),
  allowRemoteSteal=false,
  remoteStaleMs=leaseMs*10,
}={}) {
  const directory=path.resolve(lockDir);
  const ownerFile=path.join(directory,'owner.json');
  await mkdir(path.dirname(directory),{recursive:true});
  const token=randomUUID();
  const host=hostname();
  const started=Date.now();
  let fence=null;

  while (true) {
    try {
      await mkdir(directory,{recursive:false,mode:0o700});
      fence=await nextFence(directory);
      const owner={token,fence,pid:process.pid,host,acquiredAt:timestamp(),heartbeatAt:timestamp(),expiresAt:new Date(Date.now()+leaseMs).toISOString()};
      await durableJson(ownerFile,owner);
      break;
    } catch (error) {
      if (error.code!=='EEXIST') throw error;
      const owner=await readJson(ownerFile).catch(()=>null);
      const directoryStat=await stat(directory).catch(()=>null);
      const initializationAge=directoryStat?Date.now()-directoryStat.mtimeMs:0;
      const expired=owner?Date.parse(owner.expiresAt)<=Date.now():initializationAge>leaseMs;
      const sameHost=owner?.host===host;
      const safelyDead=Boolean(owner)&&sameHost && !pidAlive(Number(owner?.pid));
      const remotelyAbandoned=Boolean(owner)&&!sameHost && allowRemoteSteal && expired && Date.now()-Date.parse(owner?.heartbeatAt??owner?.acquiredAt??0)>remoteStaleMs;
      const abandonedInitialization=!owner&&initializationAge>leaseMs;
      if (expired && (safelyDead || remotelyAbandoned || abandonedInitialization)) {
        const quarantine=`${directory}.stale.${randomUUID()}`;
        try { await rename(directory,quarantine); await rm(quarantine,{recursive:true,force:true}); }
        catch (renameError) { if (!['ENOENT','EEXIST','ENOTEMPTY'].includes(renameError.code)) throw renameError; }
        continue;
      }
      if (Date.now()-started>acquireTimeoutMs) {
        const detail=sameHost&&pidAlive(Number(owner?.pid))?'live owner':'unavailable owner';
        throw new Error(`Timed out acquiring lease (${detail}): ${directory}`);
      }
      await sleep(Math.min(50,Math.max(5,Math.floor(heartbeatMs/3))));
    }
  }

  let stopped=false;
  let heartbeatBusy=false;
  const assertOwned=async()=>{
    const owner=await readJson(ownerFile);
    if (!owner || owner.token!==token || owner.fence!==fence) throw new LeaseLostError();
    return owner;
  };
  const beat=async()=>{
    if(stopped||heartbeatBusy)return;
    heartbeatBusy=true;
    try {
      const owner=await assertOwned();
      await durableJson(ownerFile,{...owner,heartbeatAt:timestamp(),expiresAt:new Date(Date.now()+leaseMs).toISOString()});
    } catch (error) {
      if (!(error instanceof LeaseLostError)) throw error;
      stopped=true;
    } finally { heartbeatBusy=false; }
  };
  const timer=setInterval(()=>{beat().catch(()=>{stopped=true;});},heartbeatMs);
  timer.unref?.();
  const stopHeartbeat=async()=>{stopped=true;clearInterval(timer);while(heartbeatBusy)await sleep(1);};
  const release=async()=>{
    await stopHeartbeat();
    const owner=await readJson(ownerFile).catch(()=>null);
    if(owner?.token===token&&owner?.fence===fence)await rm(directory,{recursive:true,force:true});
  };
  return {token,fence,ownerFile,assertOwned,stopHeartbeat,release};
}
