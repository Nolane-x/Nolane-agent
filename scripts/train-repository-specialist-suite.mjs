#!/usr/bin/env node
import path from 'node:path';
import { trainRepositorySpecialistSuite } from '../src/small-model/repository-specialist-suite-training.mjs';
const root = process.cwd();
const suite = await trainRepositorySpecialistSuite({
  trajectoryDir: path.join(root, 'datasets', 'trajectories', 'repository-v1'),
  outputRoot: path.join(root, 'models', 'specialists-repository'),
  writeOutputs: true,
});
console.log(JSON.stringify({ status: 'trained', specialists: suite.specialistSummary, receiptSha256: suite.receiptSha256 }));
