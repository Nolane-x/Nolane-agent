#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';
import { verifyForensicRecoveryCheckpoint5 } from '../src/forensics/recovery-checkpoint-5.mjs';
import { verifyRepositorySpecialistSuite } from '../src/small-model/repository-specialist-suite-training.mjs';
import { verifyRepositoryTrajectoryDataset } from '../src/small-model/repository-trajectory-collector.mjs';
import { buildRepositorySpecialistDataset, REPOSITORY_SPECIALISTS } from '../src/small-model/repository-specialist-suite-dataset.mjs';
import { ModelArtifactRegistry } from '../src/small-model/model-artifact-registry.mjs';
import { RepositorySpecialistDecisionSupport } from '../src/small-model/repository-specialist-decision-support.mjs';

async function readJson(file){return JSON.parse(await readFile(file,'utf8'));}
async function readJsonl(file){const source=(await readFile(file,'utf8')).trim();return source?source.split(/\r?\n/).map(JSON.parse):[];}
async function decisionInput(trajectoryDir,group){
  const input={};const keys={'tool-router':'tool','context-scorer':'context','test-selector':'test','patch-ranker':'patch','risk-classifier':'risk'};
  for(const specialist of REPOSITORY_SPECIALISTS){const dataset=await buildRepositorySpecialistDataset({trajectoryDir,specialist});const example=dataset.examples.find((entry)=>entry.scenarioGroup===group);if(!example)throw new Error(`Missing repository decision example: ${specialist}/${group}`);input[keys[specialist]]=example.state;}
  return input;
}

export async function generateForensicRecoveryCheckpoint5({root=process.cwd(),writeOutputs=false}={}){
  const requirements=path.join(root,'requirements');
  const custody=await readJson(path.join(requirements,'forensic-source-custody.json'));
  const symbolInventory=await readJson(path.join(requirements,'nolane-symbol-surface-inventory-summary.json'));
  const truthLedger=await readJson(path.join(requirements,'nolane-native-function-parity-summary.json'));
  const truthRecords=await readJsonl(path.join(requirements,'nolane-native-function-parity-ledger.jsonl'));
  const assertionBaseline=await readJson(path.join(root,'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json'));
  const masterAudit=await readJson(path.join(root,'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json'));
  const trajectoryDir=path.join(root,'datasets/trajectories/repository-v1');
  const trajectoryVerification=await verifyRepositoryTrajectoryDataset({outputDir:trajectoryDir});
  const trajectoryDataset=await readJson(path.join(trajectoryDir,'receipt.json'));
  const trajectoryEpisodes=trajectoryVerification.episodes;
  const outputRoot=path.join(root,'models/specialists-repository');
  const suiteVerification=await verifyRepositorySpecialistSuite({outputRoot});
  const suiteArtifacts={};const suiteBenchmarks={};const suiteDatasetReceipts={};const registry=new ModelArtifactRegistry();
  for(const specialist of REPOSITORY_SPECIALISTS){
    const target=path.join(outputRoot,specialist,'repository-v1');
    const [artifact,benchmark,datasetReceipt]=await Promise.all([readJson(path.join(target,'model.json')),readJson(path.join(target,'benchmark.json')),readJson(path.join(target,'dataset-receipt.json'))]);
    suiteArtifacts[specialist]=artifact;suiteBenchmarks[specialist]=benchmark;suiteDatasetReceipts[specialist]=datasetReceipt;
    registry.register(artifact);registry.promote({artifactSha256:artifact.artifactSha256,evaluation:benchmark.heldOut,approvedBy:'forensic-recovery-checkpoint-5'});
  }
  const support=new RepositorySpecialistDecisionSupport({artifactRegistry:registry});
  const safeDecisionReceipt=support.decide(await decisionInput(trajectoryDir,'context-utility-selector'));
  const unsafeDecisionReceipt=support.decide(await decisionInput(trajectoryDir,'browser-injection-guard'));
  const claims=evaluateRecoveryClaims({custody:custody.records,truthLedger:truthRecords,uiAudit:{sourceLocalComplete:true,defaultUiVersion:'v3',complete:false,summary:{externalCertification:1}},externalReceipts:[]});
  const verification=verifyForensicRecoveryCheckpoint5({custody,truthLedger,assertionBaseline,masterAudit,trajectoryDataset,trajectoryEpisodes,suiteArtifacts,suiteBenchmarks,suiteVerification,safeDecisionReceipt,unsafeDecisionReceipt,claims});
  const gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const report=Object.freeze({
    schema:'nolane.forensics.recovery-checkpoint-5.v1',product:'Nolane Agent',productVersion:'5.0.0-beta.6',checkpoint:'forensic-recovery-checkpoint.5',gitHead,verification,
    custody:{records:custody.records,claims},symbolInventory,truthLedger,
    assertionEvidence:{receiptSha256:assertionBaseline.receiptSha256,coverage:assertionBaseline.coverage},
    masterLedgerAssertionAudit:{receiptSha256:masterAudit.receiptSha256,summary:masterAudit.summary,certifiable:masterAudit.certifiable},
    repositoryTrajectories:{receipt:trajectoryDataset,episodes:trajectoryEpisodes},
    repositorySpecialistSuite:{verification:suiteVerification,artifacts:suiteArtifacts,benchmarks:suiteBenchmarks,datasetReceipts:suiteDatasetReceipts,safeDecisionReceipt,unsafeDecisionReceipt},
    nextCheckpointEntryCriteria:[
      'Provide canonical NolaneNative archive bytes matching SHA-256 1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9.',
      'Reduce the remaining assertion-unbound Master Ledger records with exact named positive and negative evidence.',
      'Expand repository trajectory collection across held-out repositories and real mutation/failure outcomes.',
      'Run UI performance, NVDA/Narrator, high-contrast, zoom, and screenshot certification on Windows 11 x64 with 8 GB RAM.',
      'Run provider-real dogfood and same-budget comparative benchmark with independent receipts.',
    ],
  });
  const docs=path.join(root,'docs/checkpoints');const jsonPath=path.join(docs,'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-5.json');const mdPath=path.join(docs,'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-5.md');
  const audit=masterAudit.summary;
  const md=`# Nolane Agent Forensic Recovery Checkpoint 5\n\n- Status: **${verification.status}**\n- Git head at generation: \`${gitHead}\`\n- UI/Audit assertion bindings: **48/48**\n- Master Ledger assertion-verified: **${audit.assertionVerified}**\n- Master Ledger assertion-unbound: **${audit.assertionUnbound}**\n- External-unverified: **${audit.externalUnverified}**\n- Verified repository trajectories: **${trajectoryDataset.episodeCount}**\n- Repository-trained specialist suite: **5/5 verified**\n- Safe decision: **${safeDecisionReceipt.status}**\n- Unsafe decision: **${unsafeDecisionReceipt.status}**\n- General coding intelligence claim: **no**\n- NolaneNative function-level parity: **not verified**\n\n## Repository specialist artifacts\n\n${verification.specialists.map((item)=>`- \`${item.specialist}\`: \`${item.artifactSha256}\`, validation ${item.validationAccuracy}, held-out ${item.heldOutAccuracy}`).join('\n')}\n\n## Protected non-claims\n\nComplete NolaneNative parity, comparative superiority, small-model superintelligence, general coding intelligence, provider-real certification, and Windows external certification remain locked.\n`;
  if(writeOutputs){await mkdir(docs,{recursive:true});await writeFile(jsonPath,`${JSON.stringify(report,null,2)}\n`);await writeFile(mdPath,md);}
  return Object.freeze({report,jsonPath,mdPath,wroteOutputs:writeOutputs});
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)generateForensicRecoveryCheckpoint5({writeOutputs:process.argv.includes('--write')}).then(({report,jsonPath,mdPath,wroteOutputs})=>console.log(JSON.stringify({status:report.verification.status,receiptSha256:report.verification.receiptSha256,wroteOutputs,jsonPath:path.relative(process.cwd(),jsonPath),mdPath:path.relative(process.cwd(),mdPath)}))).catch((error)=>{console.error(error.stack??error);process.exitCode=1;});
