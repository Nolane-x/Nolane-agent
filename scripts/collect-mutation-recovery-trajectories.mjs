#!/usr/bin/env node
import path from 'node:path';
import { runMutationRecoveryLab, writeMutationRecoveryDataset } from '../src/small-model/mutation-recovery-lab.mjs';
import { MUTATION_RECOVERY_SCENARIOS } from '../src/small-model/mutation-recovery-scenarios.mjs';
const root = process.cwd();
const outputDir = path.join(root, 'datasets', 'trajectories', 'multi-runtime-v1');
const result = await runMutationRecoveryLab({ root, scenarios: MUTATION_RECOVERY_SCENARIOS, timeoutMs: 120_000 });
const receipt = await writeMutationRecoveryDataset({ outputDir, result });
console.log(JSON.stringify({ status: 'pass', outputDir: path.relative(root, outputDir), scenarios: result.scenarios.length, episodes: result.episodes.length, mutationFailures: receipt.mutationFailures, recoveryPasses: receipt.recoveryPasses, runtimes: receipt.runtimes, projects: receipt.projects, receiptSha256: receipt.receiptSha256 }));
