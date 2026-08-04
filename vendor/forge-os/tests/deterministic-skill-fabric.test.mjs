import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScope } from '../src/fabric/scope-compiler.mjs';
import { bundleWorkUnits } from '../src/fabric/work-unit-bundler.mjs';
import { CoverageLedger } from '../src/fabric/coverage-ledger.mjs';
import { resolveRules } from '../src/fabric/rule-resolver.mjs';
import { anchorFindings } from '../src/fabric/anchor-engine.mjs';
import { reflectFindings } from '../src/fabric/reflection-pipeline.mjs';
import { runHybridTechnique } from '../src/fabric/hybrid-runner.mjs';

test('scope compiler deterministically includes every changed file or records an explicit exclusion',()=>{
 const change={files:[{path:'src/a.mjs',status:'modified',sha256:'a'.repeat(64)},{path:'README.md',status:'modified',sha256:'b'.repeat(64)},{path:'dist/bundle.js',status:'generated',sha256:'c'.repeat(64)}]};
 const a=compileScope({change,policy:{include:['src/**','**/*.md'],exclude:['dist/**']}});const b=compileScope({change,policy:{include:['src/**','**/*.md'],exclude:['dist/**']}});
 assert.equal(a.scopeSha256,b.scopeSha256);
 assert.deepEqual(a.included.map(x=>x.path),['README.md','src/a.mjs']);
 assert.deepEqual(a.excluded.map(x=>x.path),['dist/bundle.js']);
 assert.equal(a.included.length+a.excluded.length,change.files.length);
});

test('work-unit bundler groups coupled files and coverage ledger prevents silent completion',()=>{
 const scope={included:[{path:'src/auth.mjs',sha256:'a'.repeat(64)},{path:'tests/auth.test.mjs',sha256:'b'.repeat(64)},{path:'src/payments.mjs',sha256:'c'.repeat(64)}]};
 const bundles=bundleWorkUnits({scope,relations:[{from:'tests/auth.test.mjs',to:'src/auth.mjs',type:'tests'}]});
 assert.equal(bundles.units.length,2);
 const auth=bundles.units.find(x=>x.files.includes('src/auth.mjs'));assert.ok(auth.files.includes('tests/auth.test.mjs'));
 const ledger=new CoverageLedger(bundles);ledger.start(auth.unitId,'worker-1');ledger.complete(auth.unitId,{receiptSha256:'d'.repeat(64)});
 assert.throws(()=>ledger.assertComplete(),/uncovered/i);
 const other=bundles.units.find(x=>x.unitId!==auth.unitId);ledger.start(other.unitId,'worker-2');ledger.complete(other.unitId,{receiptSha256:'e'.repeat(64)});
 assert.equal(ledger.assertComplete().status,'complete');
});

test('rule resolver selects only applicable rules and explains skipped rules',()=>{
 const rules=[
  {id:'js-security',fileGlobs:['src/**/*.mjs'],taskClasses:['security-review'],requires:['source']},
  {id:'docs-style',fileGlobs:['**/*.md'],taskClasses:['documentation'],requires:[]},
  {id:'database-plan',fileGlobs:['migrations/**'],taskClasses:['database'],requires:['database-plan']}
 ];
 const result=resolveRules({rules,unit:{files:['src/auth.mjs']},taskClass:'security-review',availableArtifacts:['source']});
 assert.deepEqual(result.selected.map(x=>x.id),['js-security']);
 assert.ok(result.skipped.some(x=>x.id==='docs-style'&&/task|file/.test(x.reason)));
 assert.ok(result.skipped.some(x=>x.id==='database-plan'));
});

test('anchor engine rejects stale or impossible locations',()=>{
 const files={'src/a.mjs':{sha256:'a'.repeat(64),lines:['one','dangerous()','three']}};
 const anchored=anchorFindings({findings:[{id:'F1',file:'src/a.mjs',line:2,message:'Unsafe call',evidenceText:'dangerous()'}],files});
 assert.equal(anchored.accepted[0].anchor.line,2);
 assert.equal(anchored.accepted[0].anchor.fileSha256,'a'.repeat(64));
 const stale=anchorFindings({findings:[{id:'F2',file:'src/a.mjs',line:9,message:'Bad',evidenceText:'none'}],files});
 assert.equal(stale.rejected[0].reason,'line-out-of-range');
});

test('reflection filters unsupported duplicates but never hides deterministic failures',()=>{
 const result=reflectFindings({deterministicFailures:[{id:'D1',severity:'critical',message:'Tests failed',receiptSha256:'a'.repeat(64)}],agentFindings:[{id:'A1',severity:'high',message:'Possible issue',evidenceSpans:[]},{id:'A2',severity:'medium',message:'Null dereference',evidenceSpans:[{file:'x',line:1}]},{id:'A3',severity:'medium',message:'Null dereference',evidenceSpans:[{file:'x',line:1}]}]});
 assert.ok(result.final.some(x=>x.id==='D1'));
 assert.ok(result.final.some(x=>x.id==='A2'));
 assert.ok(!result.final.some(x=>x.id==='A1'));
 assert.ok(result.rejected.some(x=>x.id==='A3'&&/duplicate/.test(x.reason)));
 assert.equal(result.status,'failed');
});

test('hybrid technique executes deterministic stages around agent reasoning with a frozen coverage receipt',async()=>{
 const technique={id:'review-code',hardPipeline:['scope-selection','work-unit-bundling','rule-resolution','output-anchoring','evidence-validation'],agentStages:['contextual-investigation'],reflectionStages:['false-positive-filter']};
 const result=await runHybridTechnique({technique,change:{files:[{path:'src/a.mjs',status:'modified',sha256:'a'.repeat(64)}]},files:{'src/a.mjs':{sha256:'a'.repeat(64),lines:['const x = dangerous()']}},rules:[{id:'secure-call',fileGlobs:['src/**'],taskClasses:['security-review'],requires:[]}],taskClass:'security-review',agent:async()=>[{id:'A1',severity:'high',file:'src/a.mjs',line:1,message:'Unsafe call',evidenceText:'dangerous()'}]});
 assert.equal(result.status,'passed-with-findings');
 assert.equal(result.coverage.status,'complete');
 assert.equal(result.findings[0].anchor.line,1);
 assert.match(result.runSha256,/^[a-f0-9]{64}$/);
});
