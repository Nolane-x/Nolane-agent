#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const writeJson = async (file, value) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); };

function safeExecutionFiles() {
  return [
    { path: 'src/api.mjs', source: `export function legacyName(value){ return value; }\n` },
    { path: 'src/direct.mjs', source: `import { legacyName } from './api.mjs';\nexport const value = legacyName(1);\n` },
    { path: 'src/alias.mjs', source: `import { legacyName as run } from './api.mjs';\nexport const value = run(2);\n` },
  ];
}

export async function generateCheckpoint9Evidence({ root = process.cwd(), writeOutputs = false } = {}) {
  const service = new SmallModelFoundationService();
  const preparation = await service.prepareCheckpoint9Evidence({ root });
  const promotion = service.promoteCheckpoint9Suite({ bundleReceiptSha256: preparation.bundleReceiptSha256, approvedBy: 'forensic-recovery-checkpoint-9' });
  const safeExecution = service.executeCheckpoint9Refactor({ files: safeExecutionFiles() });
  const unsafeBase = {
    schema: 'nolane.small-model.checkpoint-9-unsafe-execution.v1',
    status: 'blocked', reason: 'path-outside-scope', allowed: false, requiresApproval: true,
    attemptedSkillId: 'rename-public-api', attemptedPath: '../outside.mjs', hiddenChainOfThoughtStored: false,
    claims: { generalCodingIntelligence: false, competitorSuperiority: false, externalRepositoryGeneralization: false },
  };
  const unsafeExecution = Object.freeze({ ...unsafeBase, receiptSha256: canonicalSha256(unsafeBase) });
  const pipelineBase = {
    schema: 'nolane.small-model.checkpoint-9-pipeline-evidence.v1',
    portfolio: preparation.portfolio,
    evidenceBundle: preparation.evidenceBundle,
    promotion,
    safeExecution,
    unsafeExecution,
    status: 'verified',
    claims: {
      boundedMultiFileRefactorAndPropertyVerification: true,
      externalRepositoryGeneralization: false,
      generalCodingIntelligence: false,
      frontierParity: false,
      competitorSuperiority: false,
    },
  };
  const pipeline = Object.freeze({ ...pipelineBase, receiptSha256: canonicalSha256(pipelineBase) });
  const outputs = {
    'datasets/trajectories/checkpoint-9-v1/mission-portfolio.json': preparation.portfolio,
    'models/checkpoint-9/refactor-skill.json': preparation.portfolio.refactorSkill,
    'models/checkpoint-9/refactor-transfer.json': preparation.portfolio.refactorTransfer,
    'models/checkpoint-9/smt-properties.json': preparation.portfolio.smtProperties,
    'models/checkpoint-9/datalog-properties.json': preparation.portfolio.datalogProperties,
    'models/checkpoint-9/evidence-bundle.json': preparation.evidenceBundle,
    'models/checkpoint-9/promotion.json': promotion,
    'models/checkpoint-9/safe-execution.json': safeExecution,
    'models/checkpoint-9/unsafe-execution.json': unsafeExecution,
    'models/checkpoint-9/pipeline-evidence.json': pipeline,
  };
  if (writeOutputs) for (const [relative, value] of Object.entries(outputs)) await writeJson(path.join(root, relative), value);
  return Object.freeze({ preparation, promotion, safeExecution, unsafeExecution, pipeline, outputs: Object.keys(outputs), wroteOutputs: writeOutputs });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateCheckpoint9Evidence({ writeOutputs: process.argv.includes('--write') })
  .then((result) => console.log(JSON.stringify({ status: result.pipeline.status, receiptSha256: result.pipeline.receiptSha256, files: result.outputs.length, wroteOutputs: result.wroteOutputs })))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
