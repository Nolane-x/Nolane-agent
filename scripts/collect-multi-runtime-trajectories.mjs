#!/usr/bin/env node
import path from 'node:path';
import { collectMultiRuntimeTrajectories, writeMultiRuntimeTrajectoryDataset } from '../src/small-model/multi-runtime-trajectory-collector.mjs';
import { MULTI_RUNTIME_TRAJECTORY_PROBES } from '../src/small-model/multi-runtime-trajectory-probes.mjs';
const root = process.cwd();
const outputDir = path.join(root, 'datasets', 'trajectories', 'multi-runtime-v1');
const collection = await collectMultiRuntimeTrajectories({ root, probes: MULTI_RUNTIME_TRAJECTORY_PROBES, timeoutMs: 120_000 });
const receipt = await writeMultiRuntimeTrajectoryDataset({ outputDir, collection });
console.log(JSON.stringify({ status: 'pass', outputDir: path.relative(root, outputDir), attempts: collection.attempts.length, episodes: collection.episodes.length, excluded: collection.excluded.length, runtimes: receipt.runtimes, projects: receipt.projects, receiptSha256: receipt.receiptSha256 }));
