import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evaluateCaseOutput, runBehavioralSuite, compareRuns, evaluateCandidate, applySkillEvaluation } from '../src/evals/evaluator.mjs';
import { EvalRunStore } from '../src/evals/eval-run-store.mjs';
import { TrustedEvalExecutor, runTrustedSkillEvaluation } from '../src/evals/trusted-runner.mjs';

const evalCase={
  id:'case-1',domain:'saas',mode:'divergence',prompt:'Create something',
  forbiddenPatterns:['generic chatbot'],
  requiredEvidence:['closest existing pattern','cheapest falsifiable experiment'],
  rubric:{novelty:{weight:.5,min:70},usefulness:{weight:.5,min:60}},
};

test('eval runner automatically checks forbidden patterns, evidence, rubric, and metric bounds', () => {
  const passing=evaluateCaseOutput(evalCase,{text:'Distinct coordination mechanism',evidence:['closest existing pattern','cheapest falsifiable experiment'],metrics:{novelty:80,usefulness:70},tokens:500});
  assert.equal(passing.passed,true);
  assert.equal(passing.criticalFailures,0);
  assert.equal(passing.quality,75);

  const failing=evaluateCaseOutput(evalCase,{text:'A generic chatbot',evidence:[],metrics:{novelty:200,usefulness:-1},tokens:-5});
  assert.equal(failing.passed,false);
  assert.ok(failing.failures.includes('forbidden-pattern:generic chatbot'));
  assert.ok(failing.failures.some((item)=>item.startsWith('invalid-metric:')));
  assert.ok(failing.failures.includes('invalid-token-count'));
});

test('behavioral suite executes identical case/seed matrix and reports uncertainty', async () => {
  const executor=async({caseDefinition,seed,mode})=>({text:`${mode}-${seed}`,evidence:caseDefinition.requiredEvidence,metrics:{novelty:mode==='candidate'?80:70,usefulness:70},tokens:100+seed});
  const baseline=await runBehavioralSuite({cases:[evalCase],executor,mode:'baseline',seeds:[1,2,3]});
  const candidate=await runBehavioralSuite({cases:[evalCase],executor,mode:'candidate',seeds:[1,2,3]});
  const compared=compareRuns(baseline.rows,candidate.rows);
  assert.equal(compared.baseline.cases,3);
  assert.equal(compared.candidate.cases,3);
  assert.ok(compared.candidate.confidence95);
  assert.ok(compared.delta.quality>0);
  assert.throws(()=>compareRuns(baseline.rows,candidate.rows.slice(1)),/same case and seed matrix/i);
});

test('candidate decision rejects invalid pass rates and token-only growth', () => {
  assert.throws(()=>evaluateCandidate({passRate:2,quality:50,tokenCount:10},{passRate:.8,quality:60,tokenCount:10,criticalFailures:0}),/passRate/i);
  const decision=evaluateCandidate({passRate:.8,quality:70,tokenCount:100},{passRate:.8,quality:70,tokenCount:1000,criticalFailures:0});
  assert.equal(decision.decision,'quarantine');
  assert.ok(decision.reasons.includes('token-only-growth'));
});

test('eval decision updates catalog status with provenance instead of remaining advisory', async (t) => {
  const dir=await mkdtemp(path.join(tmpdir(),'forge-eval-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'catalog.json');
  await writeFile(file,JSON.stringify([{name:'example-skill',status:'candidate',version:'1.0.0'}]));
  const store=new EvalRunStore(path.join(dir,'runs'));
  const executor=new TrustedEvalExecutor({id:'catalog-judge',execute:async({caseDefinition,mode})=>({text:mode,evidence:caseDefinition.requiredEvidence,metrics:{novelty:mode==='candidate'?50:80,usefulness:mode==='candidate'?50:80},tokens:100,criticalFailures:mode==='candidate'?1:0})});
  const evaluation=await runTrustedSkillEvaluation({skillName:'example-skill',skillVersion:'1.0.0',cases:[evalCase],seeds:[1,2,3],executor,store});
  assert.equal(store.durability()?.fileSync,'completed');
  assert.ok(['completed','unsupported'].includes(store.durability()?.directorySync));
  await applySkillEvaluation({catalogPath:file,skillName:'example-skill',evalRunId:evaluation.run.id,store});
  const catalog=JSON.parse(await readFile(file,'utf8'));
  assert.equal(catalog[0].status,'quarantined');
  assert.equal(catalog[0].evaluation.runSha256,evaluation.run.sha256);
});
