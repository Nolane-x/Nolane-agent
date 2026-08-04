#!/usr/bin/env node
import path from 'node:path';
import { trainCheckpoint6SpecialistSuite } from '../src/small-model/checkpoint-6-specialist-training.mjs';

const root = process.cwd();
const result = await trainCheckpoint6SpecialistSuite({
  repositoryTrajectoryDir: path.join(root, 'datasets', 'trajectories', 'repository-v1'),
  multiRuntimeDir: path.join(root, 'datasets', 'trajectories', 'multi-runtime-v1'),
  outputRoot: path.join(root, 'models', 'specialists-checkpoint-6'),
  writeOutputs: true,
});
console.log(JSON.stringify({ status: 'pass', receiptSha256: result.receiptSha256, specialists: result.specialistSummary }, null, 2));
