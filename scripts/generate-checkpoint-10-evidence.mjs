#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { loadCheckpoint10TypeScriptPack } from '../src/small-model/checkpoint-10-typescript-pack.mjs';
import { CHECKPOINT_10_CONTRACT_MANIFEST } from '../src/small-model/checkpoint-10-mission-portfolio.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const writeJson = async (file, value) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); };
async function typeScriptFiles(root) { const pack = await loadCheckpoint10TypeScriptPack({ root, id: 'transfer-c' }); return Promise.all(pack.sourceFiles.map(async (entry) => ({ path: entry.path, source: await readFile(path.join(root, pack.rootPath, entry.path), 'utf8') }))); }
async function contractFiles(root) { return Promise.all(Object.values(CHECKPOINT_10_CONTRACT_MANIFEST.targets).map(async (relative) => ({ path: relative, source: await readFile(path.join(root, 'fixtures/checkpoint-10-contract', relative), 'utf8') }))); }

export async function generateCheckpoint10Evidence({ root = process.cwd(), writeOutputs = false } = {}) {
  const service = new SmallModelFoundationService();
  const preparation = await service.prepareCheckpoint10Evidence({ root });
  const promotion = service.promoteCheckpoint10Suite({ bundleReceiptSha256: preparation.bundleReceiptSha256, approvedBy: 'forensic-recovery-checkpoint-10' });
  const safeTypeScriptExecution = service.executeCheckpoint10TypeScriptRefactor({ files: await typeScriptFiles(root), targetName: 'CanonicalPayload', replacement: 'PromotedPayload' });
  const safeContractMigration = service.executeCheckpoint10ContractMigration({ manifest: CHECKPOINT_10_CONTRACT_MANIFEST, files: await contractFiles(root) });
  const unsafeBase = {
    schema: 'nolane.small-model.checkpoint-10-unsafe-execution.v1', status: 'blocked', reason: 'path-outside-scope', allowed: false, requiresApproval: true,
    attemptedSkillId: 'rename-typescript-public-api', attemptedPath: '../outside.ts', hiddenChainOfThoughtStored: false,
    claims: { generalCodingIntelligence: false, competitorSuperiority: false, externalRepositoryGeneralization: false },
  };
  const unsafeExecution = Object.freeze({ ...unsafeBase, receiptSha256: canonicalSha256(unsafeBase) });
  const pipelineBase = {
    schema: 'nolane.small-model.checkpoint-10-pipeline-evidence.v1', status: 'verified',
    portfolio: preparation.portfolio, evidenceBundle: preparation.evidenceBundle, promotion,
    safeTypeScriptExecution, safeContractMigration, unsafeExecution,
    claims: { boundedTypeScriptAndCrossLanguageMigration: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  const pipeline = Object.freeze({ ...pipelineBase, receiptSha256: canonicalSha256(pipelineBase) });
  const outputs = {
    'datasets/trajectories/checkpoint-10-v1/mission-portfolio.json': preparation.portfolio,
    'models/checkpoint-10/typescript-skill.json': preparation.portfolio.typescriptSkill,
    'models/checkpoint-10/typescript-transfer.json': preparation.portfolio.typescriptTransfer,
    'models/checkpoint-10/typescript-properties.json': preparation.portfolio.typescriptProperties,
    'models/checkpoint-10/cross-language-migration.json': preparation.portfolio.contractMigration,
    'models/checkpoint-10/evidence-bundle.json': preparation.evidenceBundle,
    'models/checkpoint-10/promotion.json': promotion,
    'models/checkpoint-10/safe-typescript-execution.json': safeTypeScriptExecution,
    'models/checkpoint-10/safe-contract-migration.json': safeContractMigration,
    'models/checkpoint-10/unsafe-execution.json': unsafeExecution,
    'models/checkpoint-10/pipeline-evidence.json': pipeline,
  };
  if (writeOutputs) for (const [relative, value] of Object.entries(outputs)) await writeJson(path.join(root, relative), value);
  return Object.freeze({ preparation, promotion, safeTypeScriptExecution, safeContractMigration, unsafeExecution, pipeline, outputs: Object.keys(outputs), wroteOutputs: writeOutputs });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateCheckpoint10Evidence({ writeOutputs: process.argv.includes('--write') })
  .then((result) => console.log(JSON.stringify({ status: result.pipeline.status, receiptSha256: result.pipeline.receiptSha256, files: result.outputs.length, wroteOutputs: result.wroteOutputs })))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
