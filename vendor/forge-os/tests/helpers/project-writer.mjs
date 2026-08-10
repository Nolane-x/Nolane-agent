import { ProjectStore } from '../../src/core/project-store.mjs';
const [dir,id,label,delayRaw]=process.argv.slice(2);
const delay=Number(delayRaw);
const store=new ProjectStore(dir,{lockTimeoutMs:2_000,leaseMs:60,heartbeatMs:20});
await store.update(id,async(state)=>{
  process.send?.('entered');
  if(delay)await new Promise((resolve)=>setTimeout(resolve,delay));
  state.history.push({type:label,at:new Date().toISOString()});
  return state;
});
process.send?.('done');
