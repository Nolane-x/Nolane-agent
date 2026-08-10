import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintIdea, scoreIdea, clusterIdeas, rankIdeas } from '../src/core/scoring.mjs';
import { validateIdea } from '../src/core/contracts.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const input={id:'a',title:'A',thesis:'Compile traces',targetUser:'developers',hiddenProblem:'lost knowledge',mechanism:'compile execution traces into reusable procedures',interface:'cli',valueModel:'time saved',distribution:'github',assumptions:['trace access'],closestPattern:'macro recorder',differences:['semantic'],cheapestExperiment:'one trace',failureModes:['noise']};
const base=validateIdea(input); const evaluator=createPrincipal({id:'judge-1',type:'agent',roles:['reviewer'],scopes:['*']});
test('fingerprint is stable across superficial title changes',()=>assert.equal(fingerprintIdea(base),fingerprintIdea({...base,id:'b',title:'Renamed'})));
test('scoreIdea calculates a bounded weighted score with evaluator and idea-hash provenance',()=>{const scored=scoreIdea(base,{novelty:90,usefulness:80,feasibility:70,leverage:60,defensibility:50,testability:90,clarity:80,evidence:40},{principal:evaluator});assert.equal(scored.total,73.5);assert.equal(scored.ideaSha256,base.sha256);assert.equal(scored.evaluator.id,'judge-1');});
test('clusterIdeas groups paraphrased mechanisms but separates unrelated mechanisms',()=>{const same=validateIdea({...input,id:'b',title:'B',mechanism:'turn recorded program executions into procedures that agents can reuse'});const other=validateIdea({...input,id:'c',title:'C',targetUser:'retail buyers',hiddenProblem:'uncertain demand',mechanism:'run sealed-bid demand auctions before inventory is manufactured',interface:'marketplace',valueModel:'inventory risk reduction',distribution:'merchant networks',closestPattern:'prediction market',differences:['pre-commitment market']});const clusters=clusterIdeas([base,same,other]);assert.equal(clusters.length,2);assert.ok(clusters.some(c=>c.ideaIds.includes('a')&&c.ideaIds.includes('b')));});
test('rankIdeas sorts by total without mutating input',()=>{const items=[{ideaId:'a',total:40},{ideaId:'b',total:90}];assert.deepEqual(rankIdeas(items).map(x=>x.ideaId),['b','a']);assert.equal(items[0].ideaId,'a');});
