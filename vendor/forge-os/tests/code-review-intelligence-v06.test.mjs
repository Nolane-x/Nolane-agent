import test from 'node:test';
import assert from 'node:assert/strict';
import {compileReviewScope} from '../src/review/review-scope.mjs';
import {resolveReviewRules} from '../src/review/review-rule-pack.mjs';
import {anchorReviewFinding,relocateReviewAnchor} from '../src/review/review-anchor.mjs';
import {runCodeReviewIntelligence} from '../src/review/review-engine.mjs';
import {runCodeReviewBenchmark} from '../src/review/review-benchmark.mjs';

const change={files:[
  {path:'src/auth.mjs',status:'modified',language:'javascript',added:8,deleted:2,imports:['src/session.mjs']},
  {path:'src/session.mjs',status:'modified',language:'javascript',added:3,deleted:1,imports:[]},
  {path:'tests/auth.test.mjs',status:'modified',language:'javascript',added:12,deleted:0,tests:['src/auth.mjs']},
  {path:'dist/app.js',status:'modified',language:'javascript',generated:true,added:100,deleted:100},
]};
const files={
  'src/auth.mjs':{sha256:'a'.repeat(64),lines:['export function login(user) {','  if (!user) throw new Error("missing");','  return createSession(user);','}']},
  'src/session.mjs':{sha256:'b'.repeat(64),lines:['export function createSession(user) {','  return { user };','}']},
  'tests/auth.test.mjs':{sha256:'c'.repeat(64),lines:['test("login", () => {','  assert.ok(login({id:1}));','});']},
};

test('review scope excludes generated output but cannot silently omit changed source or tests',()=>{
  const scope=compileReviewScope({change,policy:{excludeGenerated:true}});
  assert.deepEqual(scope.included.map(x=>x.path),['src/auth.mjs','src/session.mjs','tests/auth.test.mjs']);
  assert.deepEqual(scope.excluded.map(x=>x.path),['dist/app.js']);
  assert.equal(scope.coverage.changed,4);
  assert.equal(scope.coverage.accounted,4);
  assert.equal(scope.coverage.unaccounted,0);
});

test('review rules match language, risk, path, and required evidence instead of loading every rule',()=>{
  const rules=[
    {id:'auth-no-plaintext-session',languages:['javascript'],fileGlobs:['src/**'],riskTags:['authentication'],requires:['diff']},
    {id:'sql-no-select-star',languages:['sql'],fileGlobs:['db/**'],riskTags:['database'],requires:['schema']},
  ];
  const selected=resolveReviewRules({rules,unit:{files:['src/auth.mjs'],languages:['javascript'],riskTags:['authentication']},availableArtifacts:['diff']});
  assert.deepEqual(selected.selected.map(x=>x.id),['auth-no-plaintext-session']);
  assert.match(selected.skipped[0].reason,/language|path|risk/i);
});

test('review anchor binds file hash and line, then relocates by unique evidence after edit',()=>{
  const finding={id:'F1',file:'src/auth.mjs',line:3,evidenceText:'return createSession',message:'Session creation bypasses policy',severity:'high'};
  const anchored=anchorReviewFinding({finding,file:files['src/auth.mjs']});
  assert.equal(anchored.anchor.line,3);
  const edited={sha256:'d'.repeat(64),lines:['// comment',...files['src/auth.mjs'].lines]};
  const relocated=relocateReviewAnchor({anchor:anchored.anchor,file:edited});
  assert.equal(relocated.line,4);
  assert.equal(relocated.relocation,'unique-evidence-match');
  assert.throws(()=>relocateReviewAnchor({anchor:{...anchored.anchor,lineText:'return',evidenceText:'return'},file:{sha256:'e'.repeat(64),lines:['return a','return b']}}),/ambiguous/i);
});

test('code review engine proves file coverage, anchors findings, and reflection removes unsupported noise',async()=>{
  const rules=[{id:'auth-review',languages:['javascript'],fileGlobs:['src/**'],riskTags:['authentication'],requires:['diff']}];
  const result=await runCodeReviewIntelligence({change,files,rules,availableArtifacts:['diff'],agent:async({unit})=>{
    if(unit.files.includes('src/auth.mjs'))return[
      {id:'real',file:'src/auth.mjs',line:3,evidenceText:'return createSession',message:'Verify session policy before creation',severity:'high'},
      {id:'noise',file:'src/auth.mjs',line:99,message:'Maybe unsafe',severity:'medium'},
    ];
    return[];
  }});
  assert.equal(result.coverage.status,'complete');
  assert.equal(result.coverage.accountedFiles,3);
  assert.equal(result.findings.length,2); // real finding + deterministic anchor failure
  assert.ok(result.findings.some(x=>x.id==='real'));
  assert.ok(result.findings.some(x=>x.source==='deterministic'));
  assert.equal(result.status,'failed');
});

test('code review benchmark reports coverage, anchor accuracy, noise, and deterministic corpus hash',async()=>{
  const report=await runCodeReviewBenchmark();
  assert.ok(report.cases>=12);
  assert.equal(report.fileCoverage,1);
  assert.ok(report.anchorAccuracy>=0.95);
  assert.ok(report.precision>=0.9);
  assert.ok(report.noisyCommentRate<=0.1);
  assert.match(report.corpusSha256,/^[a-f0-9]{64}$/);
});
