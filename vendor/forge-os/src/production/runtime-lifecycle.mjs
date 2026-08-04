export class RuntimeLifecycle {
  constructor({checks={},shutdownTimeoutMs=10_000}={}){this.checks=checks;this.shutdownTimeoutMs=shutdownTimeoutMs;this.state='starting';this.inFlight=0;this.waiters=[];}
  markStarted(){if(this.state!=='starting')throw new Error('Runtime cannot be started from current state');this.state='running';}
  beginRequest(){if(this.state!=='running')throw new Error(`Runtime is ${this.state}`);this.inFlight++;let done=false;return()=>{if(done)return;done=true;this.inFlight--;if(this.inFlight===0){for(const resolve of this.waiters.splice(0))resolve();}};}
  async status(){const results={};for(const [name,check] of Object.entries(this.checks)){try{results[name]=Boolean(await check());}catch{results[name]=false;}}
    const repository=results.repository!==false;const degraded=Object.entries(results).some(([name,ok])=>name!=='repository'&&!ok);return {state:this.state,live:this.state!=='stopped',ready:this.state==='running'&&repository,degraded,checks:results,inFlight:this.inFlight};}
  async shutdown({close=async()=>{}}={}){if(this.state==='stopped')return;this.state='draining';if(this.inFlight>0)await Promise.race([new Promise(resolve=>this.waiters.push(resolve)),new Promise(resolve=>setTimeout(resolve,this.shutdownTimeoutMs))]);await close();this.state='stopped';}
}
