import {canonicalSha256} from '../core/canonical-json.mjs';

const POST_STAGES=new Set(['output-anchoring','evidence-validation','verification','coverage-check']);
const safe=(value)=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const node=(kind,stage,{workUnitId=null,retryBudget=0,required=true}={})=>({id:`${kind}:${workUnitId?`${safe(workUnitId)}:`:''}${safe(stage)}`,kind,stage,workUnitId,retryBudget,required});
const edge=(from,to,type='requires')=>({from,to,type});

export function compileExecutionGraph({technique,workUnits=[],retryBudget=0}={}){
  if(!technique?.id||!technique.executionProgram)throw new TypeError('Technique executionProgram is required');
  const units=[...(workUnits??[])].map((item)=>({unitId:String(item.unitId),files:[...(item.files??[])].sort()})).sort((a,b)=>a.unitId.localeCompare(b.unitId));
  if(!units.length)throw new TypeError('At least one work unit is required');
  const program=technique.executionProgram;
  const hard=[...(program.hardPipeline??[])];
  const pre=hard.filter((stage)=>!POST_STAGES.has(stage));
  const post=hard.filter((stage)=>POST_STAGES.has(stage));
  const nodes=[];const edges=[];
  let previous=null;
  for(const stage of pre){const current=node('deterministic',stage);nodes.push(current);if(previous)edges.push(edge(previous.id,current.id));previous=current;}
  const preTail=previous?.id??null;const unitTails=[];
  for(const unit of units){
    let tail=preTail;
    for(const stage of program.agentStages??[]){const current=node('agent',stage,{workUnitId:unit.unitId,retryBudget});nodes.push(current);if(tail)edges.push(edge(tail,current.id));tail=current.id;}
    for(const stage of post.filter((item)=>item==='output-anchoring')){const current=node('deterministic',stage,{workUnitId:unit.unitId});nodes.push(current);if(tail)edges.push(edge(tail,current.id));tail=current.id;}
    for(const stage of program.reflectionStages??[]){const current=node('reflection',stage,{workUnitId:unit.unitId,retryBudget});nodes.push(current);if(tail)edges.push(edge(tail,current.id));tail=current.id;}
    for(const stage of post.filter((item)=>item!=='output-anchoring')){const current=node('deterministic',stage,{workUnitId:unit.unitId});nodes.push(current);if(tail)edges.push(edge(tail,current.id));tail=current.id;}
    unitTails.push(tail);
  }
  const join=node('join','work-units-complete');nodes.push(join);for(const tail of unitTails)edges.push(edge(tail,join.id));
  const gate=node('gate','coverage-complete');nodes.push(gate);edges.push(edge(join.id,gate.id));
  const rollback=node('rollback','rollback-on-failure',{required:false});nodes.push(rollback);
  const payload={schemaVersion:2,technique:{id:technique.id,version:technique.version??'0.0.0'},executionMode:program.executionMode??'hybrid',workUnits:units,workUnitIds:units.map((item)=>item.unitId),nodes:nodes.sort((a,b)=>a.id.localeCompare(b.id)),edges:edges.sort((a,b)=>`${a.from}>${a.to}`.localeCompare(`${b.from}>${b.to}`)),failurePolicy:{rollbackNodeId:rollback.id,deterministicFailure:'fail-closed',agentRetries:retryBudget}};
  validateExecutionGraph(payload);
  return Object.freeze({...payload,graphSha256:canonicalSha256(payload)});
}

export function validateExecutionGraph(graph){
  if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))throw new TypeError('Execution graph nodes and edges are required');
  const ids=new Set();for(const item of graph.nodes){if(!item.id||ids.has(item.id))throw new Error(`Duplicate execution node: ${item.id}`);ids.add(item.id);}
  for(const item of graph.edges)if(!ids.has(item.from)||!ids.has(item.to))throw new Error(`Dangling execution edge: ${item.from} -> ${item.to}`);
  const incoming=new Map([...ids].map((id)=>[id,0]));const next=new Map([...ids].map((id)=>[id,[]]));
  for(const item of graph.edges){incoming.set(item.to,incoming.get(item.to)+1);next.get(item.from).push(item.to);}
  const queue=[...ids].filter((id)=>incoming.get(id)===0).sort();let visited=0;
  while(queue.length){const id=queue.shift();visited++;for(const target of next.get(id).sort()){incoming.set(target,incoming.get(target)-1);if(incoming.get(target)===0){queue.push(target);queue.sort();}}}
  if(visited!==ids.size)throw new Error('Execution graph contains a cycle');
  const gates=graph.nodes.filter((item)=>item.kind==='gate');if(gates.length!==1)throw new Error('Execution graph requires exactly one terminal gate');
  return Object.freeze({status:'valid',nodes:ids.size,edges:graph.edges.length});
}
