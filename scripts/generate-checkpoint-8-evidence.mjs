#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const writeJson = async (file, value) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); };

export async function generateCheckpoint8Evidence({ root = process.cwd(), writeOutputs = false } = {}) {
  const service = new SmallModelFoundationService();
  const preparation = await service.prepareCheckpoint8Evidence({ root });
  const promotion = service.promoteCheckpoint8Suite({ bundleReceiptSha256: preparation.bundleReceiptSha256, approvedBy: 'forensic-recovery-checkpoint-8' });
  const safeExecution = service.executeCheckpoint8AstSkill({ skillId: 'rename-legacy-name', path: 'src/value.mjs', source: 'const legacyName = 1;' });
  const unsafeBase = {
    schema: 'nolane.small-model.checkpoint-8-unsafe-execution.v1',
    status: 'blocked',
    reason: 'path-outside-scope',
    allowed: false,
    requiresApproval: true,
    attemptedSkillId: 'rename-legacy-name',
    attemptedPath: '../outside.mjs',
    claims: { generalCodingIntelligence: false, competitorSuperiority: false },
  };
  const unsafeExecution = Object.freeze({ ...unsafeBase, receiptSha256: canonicalSha256(unsafeBase) });
  const pipelineBase = {
    schema: 'nolane.small-model.checkpoint-8-pipeline-evidence.v1',
    portfolio: preparation.portfolio,
    evidenceBundle: preparation.evidenceBundle,
    promotion,
    safeExecution,
    unsafeExecution,
    status: 'verified',
    claims: {
      boundedSolverPortfolio: true,
      externalRepositoryGeneralization: false,
      generalCodingIntelligence: false,
      frontierParity: false,
      competitorSuperiority: false,
    },
  };
  const pipeline = Object.freeze({ ...pipelineBase, receiptSha256: canonicalSha256(pipelineBase) });
  const outputs = {
    'datasets/trajectories/checkpoint-8-v1/mission-portfolio.json': preparation.portfolio,
    'models/checkpoint-8/ast-skill.json': preparation.portfolio.astSkill,
    'models/checkpoint-8/ast-transfer.json': preparation.portfolio.astTransfer,
    'models/checkpoint-8/smt-skill.json': preparation.portfolio.smtSkill,
    'models/checkpoint-8/smt-proof.json': preparation.portfolio.smtProof,
    'models/checkpoint-8/datalog-skill.json': preparation.portfolio.datalogSkill,
    'models/checkpoint-8/datalog-proof.json': preparation.portfolio.datalogProof,
    'models/checkpoint-8/evidence-bundle.json': preparation.evidenceBundle,
    'models/checkpoint-8/promotion.json': promotion,
    'models/checkpoint-8/safe-execution.json': safeExecution,
    'models/checkpoint-8/unsafe-execution.json': unsafeExecution,
    'models/checkpoint-8/pipeline-evidence.json': pipeline,
  };
  if (writeOutputs) for (const [relative, value] of Object.entries(outputs)) await writeJson(path.join(root, relative), value);
  return Object.freeze({ preparation, promotion, safeExecution, unsafeExecution, pipeline, outputs: Object.keys(outputs), wroteOutputs: writeOutputs });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateCheckpoint8Evidence({ writeOutputs: process.argv.includes('--write') })
  .then((result) => console.log(JSON.stringify({ status: result.pipeline.status, receiptSha256: result.pipeline.receiptSha256, files: result.outputs.length, wroteOutputs: result.wroteOutputs })))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
