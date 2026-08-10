import test from 'node:test';
import assert from 'node:assert/strict';
import { runSkillIntelligenceAudit } from '../src/benchmarks/skill-intelligence-audit.mjs';

test('skill intelligence audit distinguishes outcomes, techniques, maturity, depth, boilerplate, and materialization',async()=>{
 const report=await runSkillIntelligenceAudit();
 assert.equal(report.graph.outcomeScaffolds,1024);
 assert.equal(report.graph.techniques,128);
 assert.equal(report.graph.l0Techniques,32);
 assert.equal(report.graph.l1Techniques,96);
 assert.equal(report.graph.kernelTechniques,128);
 assert.equal(report.graph.evaluators,128);
 assert.equal(report.skillsV2.total,128);
 assert.equal(report.skillsV2.stable,33);
 assert.equal(report.skillsV2.l0,32);
 assert.equal(report.skillsV2.l1,96);
 assert.equal(report.skillsV2.candidate,95);
 assert.equal(report.stableMaterialization.passed,33);
 assert.equal(report.stableMaterialization.failed,0);
 assert.equal(report.quality.invalidDepth,0);
 assert.equal(report.quality.boilerplateViolations,0);
 assert.ok(report.quality.minimumDepthScore>=60);
 assert.ok(report.quality.maximumBoilerplateRatio<=.35);
 assert.match(report.reportSha256,/^[a-f0-9]{64}$/);
});
