#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runContextBenchmark } from '../src/benchmarks/context-benchmark.mjs';
const output=path.resolve(process.env.FORGEOS_CONTEXT_BENCHMARK_OUTPUT??'dist/context-benchmark-v2.json');
const report=await runContextBenchmark();
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log(`Context benchmark: stable=${report.stableMaterialization.passed}/${report.stableMaterialization.total} toolReduction=${report.toolDistillation.reductionRatio.toFixed(4)} abiReduction=${report.semanticAbi.orientationReductionRatio.toFixed(4)}`);
console.log(output);
