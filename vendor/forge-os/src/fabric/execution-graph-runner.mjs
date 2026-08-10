import {canonicalSha256} from '../core/canonical-json.mjs';
import {validateExecutionGraph} from './execution-graph.mjs';

const freeze=(value)=>Object.freeze(value);
export async function runExecutionGraph({graph,handlers={},maxConcurrency=8}={}){
  validateExecutionGraph(graph);if(!Number.isInteger(maxConcurrency)||maxConcurrency<1)throw new TypeError('maxConcurrency must be positive');
  const byId=new Map(graph.nodes.map((item)=>[item.id,item]));const deps=new Map(graph.nodes.map((item)=>[item.id,[]]));
  for(const item of graph.edges)deps.get(item.to).push(item.from);
  const state=new Map(graph.nodes.map((item)=>[item.id,{status:item.kind==='rollback'?'disabled':'pending',attempts:0}]));
  const receipts=[];const failures=[];
  const context={graphSha256:graph.graphSha256,failedDeterministic:[],failures,receipts,state};
  async function execute(node){
    const record=state.get(node.id);record.status='running';let output=null;let error=null;const attempts=Math.max(1,(node.retryBudget??0)+1);
    for(let attempt=1;attempt<=attempts;attempt++){record.attempts=attempt;try{const handler=handlers[node.kind]??(async()=>({status:'pass'}));output=await handler(node,context);if(output?.status==='fail')throw new Error(output.reason??`${node.stage} failed`);error=null;break;}catch(cause){error=cause;if(attempt<attempts)continue;}}
    if(error){record.status='failed';const failure={nodeId:node.id,workUnitId:node.workUnitId,kind:node.kind,stage:node.stage,message:error.message,attempts:record.attempts};failures.push(failure);if(node.kind==='deterministic')context.failedDeterministic.push(failure);return;}
    record.status='completed';record.output=output;const subject={graphSha256:graph.graphSha256,nodeId:node.id,stage:node.stage,kind:node.kind,workUnitId:node.workUnitId,attempts:record.attempts,output};receipts.push(freeze({...subject,receiptSha256:canonicalSha256(subject)}));
  }
  while(true){
    const pending=[...state].filter(([,record])=>record.status==='pending').map(([id])=>id);if(!pending.length)break;
    let progressed=false;
    for(const id of pending){const predecessors=deps.get(id);if(predecessors.some((dep)=>['failed','skipped'].includes(state.get(dep).status))){state.get(id).status='skipped';progressed=true;}}
    const ready=pending.filter((id)=>state.get(id).status==='pending'&&deps.get(id).every((dep)=>state.get(dep).status==='completed')).sort();
    if(ready.length){progressed=true;for(let index=0;index<ready.length;index+=maxConcurrency)await Promise.all(ready.slice(index,index+maxConcurrency).map((id)=>execute(byId.get(id))));}
    if(!progressed)throw new Error('Execution graph stalled with unresolved dependencies');
  }
  const unitState=graph.workUnitIds.map((unitId)=>{const relevant=graph.nodes.filter((item)=>item.workUnitId===unitId&&item.required!==false);const completed=relevant.every((item)=>state.get(item.id).status==='completed');return{unitId,status:completed?'completed':'incomplete'};});
  const coverage={total:unitState.length,completed:unitState.filter((item)=>item.status==='completed').length,units:unitState};
  const terminal=graph.nodes.find((item)=>item.kind==='gate');const terminalState=state.get(terminal.id)?.status;const status=failures.length||coverage.completed!==coverage.total||terminalState!=='completed'?'failed':'pass';
  const result={schemaVersion:1,graphSha256:graph.graphSha256,status,coverage,receipts:[...receipts].sort((a,b)=>a.nodeId.localeCompare(b.nodeId)),failures:[...failures].sort((a,b)=>a.nodeId.localeCompare(b.nodeId)),nodeStates:[...state].map(([nodeId,value])=>({nodeId,...value,output:undefined})).sort((a,b)=>a.nodeId.localeCompare(b.nodeId))};
  return freeze({...result,runSha256:canonicalSha256(result)});
}
