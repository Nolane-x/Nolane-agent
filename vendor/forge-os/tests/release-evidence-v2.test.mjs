import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createVerificationReport, summarizeCommand } from '../scripts/release-verify.mjs';

test('release evidence derives version, inventory, command hashes, and protocol targets from current source',async()=>{
  const fakeTest='ℹ tests 7\nℹ pass 7\nℹ fail 0\n';
  const fakeCoverage='# all files | 95.00 | 75.00 | 90.00 |\n';
  const results=[summarizeCommand('npm test',{status:0,stdout:fakeTest,stderr:''},10),summarizeCommand('npm run test:coverage',{status:0,stdout:fakeCoverage,stderr:''},20)];
  const report=await createVerificationReport({startedAt:new Date().toISOString(),sourceCommit:'a'.repeat(40),sourceTree:'b'.repeat(40),dirtyAtStart:false,results,status:'pass'});
  const packageJson=JSON.parse(await readFile('package.json','utf8'));
  assert.equal(report.version,packageJson.version);
  assert.equal(report.summary.tests.total,7);
  assert.equal(report.summary.coverage.lines,95);
  assert.equal(report.summary.skills.total,250);
  assert.equal(report.summary.protocols.mcp,'2025-11-25');
  assert.ok(report.commands.every((item)=>/^[a-f0-9]{64}$/.test(item.outputSha256)));
  assert.equal(report.source.commit,'a'.repeat(40));
  assert.equal(report.dashboardEvidence.renderer,'forgeos-svg');
  assert.equal(report.dashboardEvidence.path,'evidence/dashboard.svg');
  assert.equal(report.dashboardEvidence.mediaType,'image/svg+xml');
  assert.ok(report.dashboardEvidence.sha256.length===64);
  assert.ok(report.claimsBoundary.includes('does not prove defect-free'));
});


test('release report embeds certification and critical mutation evidence from the current run',async(t)=>{
 const output=await mkdtemp(path.join(os.tmpdir(),'forge-release-evidence-extra-'));t.after(()=>rm(output,{recursive:true,force:true}));
 await writeFile(path.join(output,'skill-certification-audit.json'),JSON.stringify({reportSha256:'a'.repeat(64),evidenceQualified:{stable:0,certified:0},claims:{allKernelStableOrCertified:false}}));
 await writeFile(path.join(output,'critical-mutation-report.json'),JSON.stringify({total:7,killed:7,survived:[]}));
 const report=await createVerificationReport({outputDirectory:output,startedAt:new Date().toISOString(),sourceCommit:null,sourceTree:null,dirtyAtStart:null,results:[],status:'pass'});
 assert.equal(report.summary.skillCertification.evidenceQualified.stable,0);
 assert.equal(report.summary.criticalMutation.killed,7);
 assert.deepEqual(report.summary.criticalMutation.survived,[]);
});
