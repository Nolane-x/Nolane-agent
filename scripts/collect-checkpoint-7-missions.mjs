#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';

export async function collectCheckpoint7MissionArtifacts({ root = process.cwd(), outputDir = path.join(root, 'datasets/trajectories/checkpoint-7-v1'), writeOutputs = false } = {}) {
  const service = new SmallModelFoundationService();
  const collection = await service.collectCheckpoint7Missions({ root, trainingRepositoryIds: ['nolane-root', 'go-launcher', 'python-sdk'] });
  const collectionPath = path.join(outputDir, 'mission-collection.json');
  const primaryPath = path.join(outputDir, 'primary-missions.jsonl');
  const inductionPath = path.join(outputDir, 'induction-missions.jsonl');
  if (writeOutputs) {
    await mkdir(outputDir, { recursive: true });
    await Promise.all([
      writeFile(collectionPath, `${JSON.stringify(collection, null, 2)}\n`),
      writeFile(primaryPath, `${collection.primaryMissions.map((item) => JSON.stringify(item)).join('\n')}\n`),
      writeFile(inductionPath, `${collection.inductionMissions.map((item) => JSON.stringify(item)).join('\n')}\n`),
    ]);
  }
  return Object.freeze({ collection, collectionPath, primaryPath, inductionPath, wroteOutputs: writeOutputs });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  collectCheckpoint7MissionArtifacts({ writeOutputs: process.argv.includes('--write') })
    .then(({ collection, collectionPath, wroteOutputs }) => console.log(JSON.stringify({ receiptSha256: collection.receiptSha256, primaryMissions: collection.primaryMissions.length, inductionMissions: collection.inductionMissions.length, wroteOutputs, collectionPath: path.relative(process.cwd(), collectionPath) })))
    .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
}
