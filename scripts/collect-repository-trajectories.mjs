#!/usr/bin/env node
import path from 'node:path';
import { collectRepositoryTrajectories, writeRepositoryTrajectoryDataset, verifyRepositoryTrajectoryDataset } from '../src/small-model/repository-trajectory-collector.mjs';
import { REPOSITORY_TRAJECTORY_PROBES } from '../src/small-model/repository-trajectory-probes.mjs';

const root = process.cwd();
const outputDir = path.join(root, 'datasets', 'trajectories', 'repository-v1');
const collection = await collectRepositoryTrajectories({ root, probes: REPOSITORY_TRAJECTORY_PROBES, timeoutMs: 120_000 });
if (collection.excluded.length) throw new Error(`Repository trajectory collection excluded ${collection.excluded.length} probes`);
const receipt = await writeRepositoryTrajectoryDataset({ outputDir, collection });
const verified = await verifyRepositoryTrajectoryDataset({ outputDir });
console.log(JSON.stringify({ status: 'pass', attempts: collection.attempts.length, episodes: verified.episodeCount, receiptSha256: receipt.receiptSha256 }));
