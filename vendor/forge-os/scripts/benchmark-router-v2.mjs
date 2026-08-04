#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runRouterBenchmark } from '../src/benchmarks/router-benchmark.mjs';
const output=path.resolve(process.env.FORGEOS_ROUTER_BENCHMARK_OUTPUT??'dist/router-benchmark-v2.json');
const report=await runRouterBenchmark();
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log(`Router benchmark: P@1=${report.metrics.precisionAt1} P@3=${report.metrics.precisionAt3} R@6=${report.metrics.recallAt6}`);
console.log(output);
