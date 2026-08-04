import test from 'node:test';
import assert from 'node:assert/strict';
import { runRouterBenchmark } from '../src/benchmarks/router-benchmark.mjs';
import { runContextBenchmark } from '../src/benchmarks/context-benchmark.mjs';

test('public router benchmark measures precision, recall, determinism, and unsafe activation',async()=>{
 const report=await runRouterBenchmark();
 assert.equal(report.cases,16);
 assert.ok(report.metrics.precisionAt1>=.85,JSON.stringify(report.metrics));
 assert.ok(report.metrics.precisionAt3>=.93,JSON.stringify(report.metrics));
 assert.ok(report.metrics.recallAt6>=.97,JSON.stringify(report.metrics));
 assert.equal(report.metrics.unsafeActivationRate,0);
 assert.equal(report.metrics.determinism,1);
 assert.match(report.reportSha256,/^[a-f0-9]{64}$/);
});

test('context benchmark proves stable materialization, omission accounting, and large-log distillation',async()=>{
 const report=await runContextBenchmark();
 assert.equal(report.stableMaterialization.failed,0);
 assert.equal(report.stableMaterialization.passed,33);
 assert.equal(report.globalBudget.overflowCount,0);
 assert.equal(report.globalBudget.unmanifestedOmissions,0);
 assert.ok(report.toolDistillation.reductionRatio>=.95,JSON.stringify(report.toolDistillation));
 assert.ok(report.semanticAbi.orientationReductionRatio>=.5,JSON.stringify(report.semanticAbi));
 assert.match(report.reportSha256,/^[a-f0-9]{64}$/);
});
