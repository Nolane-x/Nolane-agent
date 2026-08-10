import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCapabilityGraphV2, loadCapabilityGraphV2, techniquesForOutcome, outcomesForTechnique } from '../src/capabilities/v2/compiler.mjs';

test('Capability Graph v2 separates legacy outcome scaffolds from deep techniques and evaluators',async()=>{
 const graph=await loadCapabilityGraphV2();
 assert.equal(graph.outcomes.length,1024);
 assert.ok(graph.outcomes.every((item)=>item.kind==='outcome'&&item.legacyScaffold===true));
 assert.equal(graph.techniques.length,128);
 assert.ok(graph.techniques.every((item)=>item.kind==='technique'&&item.skillContractVersion===2));
 assert.equal(graph.evaluators.length,128);
 assert.ok(graph.relations.some((edge)=>edge.type==='satisfies'));
 assert.ok(graph.relations.some((edge)=>edge.type==='validatedBy'));
});

test('stable mappings are explicit many-to-many and do not require unique capability ownership',async()=>{
 const graph=await loadCapabilityGraphV2();
 const api=outcomesForTechnique(graph,'technique.designing-api-contracts');
 assert.ok(api.some((id)=>id.includes('api-integration.define-requirements')));
 const shared=techniquesForOutcome(graph,'outcome.product-management.compare-alternatives');
 assert.ok(shared.includes('technique.generating-divergent-concepts'));
 assert.ok(shared.includes('technique.selecting-winning-concept'));
 assert.ok(shared.includes('technique.detecting-fake-novelty'));
});

test('compiler rejects missing mapping evidence and dangling evaluator relations',()=>{
 const graph={schemaVersion:2,outcomes:[{outcomeId:'outcome.a',kind:'outcome',domain:'x',title:'A',consumes:[],produces:['a'],evidence:['e'],requiredTools:[],riskClass:'low',legacyScaffold:false,contractSha256:'a'.repeat(64)}],techniques:[{techniqueId:'technique.t',kind:'technique',skillId:'t',skillContractVersion:2,maturity:'candidate',triggers:['x'],antiTriggers:['y'],consumes:[],produces:['a'],requiredTools:[],sectionIndexSha256:'b'.repeat(64),contractSha256:'c'.repeat(64)}],providers:[],evaluators:[],relations:[{type:'satisfies',from:'technique.t',to:'outcome.a'}]};
 assert.throws(()=>compileCapabilityGraphV2(graph),/mapping evidence|evaluator/i);
});
