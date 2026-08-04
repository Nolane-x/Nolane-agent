import test from 'node:test';
import assert from 'node:assert/strict';
import {runV06ReleaseAudit} from '../src/benchmarks/v06-release-audit.mjs';

test('v0.6 release audit reports deterministic fabric without overstating maturity',async()=>{
 const report=await runV06ReleaseAudit();
 assert.equal(report.version,'0.6.1');
 assert.equal(report.kernel.total,128);
 assert.equal(report.kernel.l0,32);
 assert.equal(report.kernel.l1,96);
 assert.equal(report.graph.techniques,128);
 assert.equal(report.graph.evaluators,128);
 assert.equal(report.review.cases,12);
 assert.equal(report.security.passed,20);
 assert.equal(report.security.missed,0);
 assert.equal(report.claims.proceduralSkillsProductionGrade1024,false);
 assert.equal(report.claims.fullPostgresLifecycleHA,false);
 assert.equal(report.claims.universalMicroVmSandbox,false);
 assert.equal(report.certification.evidenceQualified.stable,0);
 assert.equal(report.certification.evidenceQualified.certified,0);
 assert.equal(report.claims.allKernelStableOrCertified,false);
 assert.match(report.reportSha256,/^[a-f0-9]{64}$/);
});
