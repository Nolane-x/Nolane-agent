import test from 'node:test';
import assert from 'node:assert/strict';
import {compileExecutionGraph,validateExecutionGraph} from '../src/fabric/execution-graph.mjs';
import {runExecutionGraph} from '../src/fabric/execution-graph-runner.mjs';

const technique={id:'review-code-safely',version:'1.0.0',executionProgram:{executionMode:'hybrid',hardPipeline:['scope-selection','work-unit-bundling','coverage-ledger','rule-resolution','output-anchoring','evidence-validation'],agentStages:['contextual-investigation','domain-judgment'],reflectionStages:['contradiction-check','false-positive-filter','actionability-check']}};
const units=[{unitId:'WU-a',files:['src/a.mjs']},{unitId:'WU-b',files:['src/b.mjs']}];

test('execution graph compiles deterministic preflight, parallel work units, reflection, join, and terminal gate',()=>{
  const first=compileExecutionGraph({technique,workUnits:units,retryBudget:1});
  const second=compileExecutionGraph({technique,workUnits:[...units].reverse(),retryBudget:1});
  assert.equal(first.graphSha256,second.graphSha256);
  assert.equal(validateExecutionGraph(first).status,'valid');
  assert.ok(first.nodes.some(n=>n.kind==='deterministic'&&n.stage==='scope-selection'));
  assert.equal(first.nodes.filter(n=>n.kind==='agent'&&n.stage==='contextual-investigation').length,2);
  assert.equal(first.nodes.filter(n=>n.kind==='reflection').length,6);
  assert.ok(first.nodes.some(n=>n.kind==='join'));
  assert.ok(first.nodes.some(n=>n.kind==='gate'&&n.stage==='coverage-complete'));
  assert.deepEqual(first.workUnitIds,['WU-a','WU-b']);
});

test('graph validator rejects dangling edges and cycles',()=>{
  const graph=structuredClone(compileExecutionGraph({technique,workUnits:units}));
  graph.edges.push({from:'missing',to:graph.nodes[0].id,type:'requires'});
  assert.throws(()=>validateExecutionGraph(graph),/dangling/i);
  const cycle=structuredClone(compileExecutionGraph({technique,workUnits:units}));
  const gate=cycle.nodes.find(item=>item.kind==='gate');
  const start=cycle.nodes.find(item=>item.kind==='deterministic'&&item.stage==='scope-selection');
  cycle.edges.push({from:gate.id,to:start.id,type:'requires'});
  assert.throws(()=>validateExecutionGraph(cycle),/cycle/i);
});

test('execution graph retries agent nodes, records receipts, and cannot hide deterministic failures',async()=>{
  const graph=compileExecutionGraph({technique,workUnits:units,retryBudget:1});
  const attempts=new Map();
  const result=await runExecutionGraph({graph,handlers:{
    deterministic:async(node)=>({status:'pass',stage:node.stage}),
    agent:async(node)=>{const count=(attempts.get(node.id)??0)+1;attempts.set(node.id,count);if(node.workUnitId==='WU-a'&&node.stage==='contextual-investigation'&&count===1)throw new Error('transient');return{status:'pass',findings:[]};},
    reflection:async()=>({status:'pass'}),
    join:async()=>({status:'pass'}),
    gate:async(node,ctx)=>({status:ctx.failedDeterministic.length?'fail':'pass'}),
  }});
  assert.equal(result.status,'pass');
  assert.equal(result.coverage.completed,result.coverage.total);
  assert.ok([...attempts.values()].some(v=>v===2));
  assert.ok(result.receipts.every(r=>/^[a-f0-9]{64}$/.test(r.receiptSha256)));

  const failed=await runExecutionGraph({graph,handlers:{
    deterministic:async(node)=>{if(node.stage==='evidence-validation')throw new Error('proof missing');return{status:'pass'};},
    agent:async()=>({status:'pass'}),reflection:async()=>({status:'pass'}),join:async()=>({status:'pass'}),gate:async()=>({status:'pass'}),
  }});
  assert.equal(failed.status,'failed');
  assert.ok(failed.failures.some(f=>f.kind==='deterministic'));
});
