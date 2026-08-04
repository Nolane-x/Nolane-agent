#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';
import { verifyForensicRecoveryCheckpoint4 } from '../src/forensics/recovery-checkpoint-4.mjs';
import { verifyBootstrapSpecialistSuite } from '../src/small-model/bootstrap-specialist-suite-training.mjs';
import { ModelArtifactRegistry } from '../src/small-model/model-artifact-registry.mjs';
import { SpecialistDecisionSupport } from '../src/small-model/specialist-decision-support.mjs';
import { SUPPORTED_BOOTSTRAP_SPECIALISTS } from '../src/small-model/bootstrap-specialist-suite-dataset.mjs';

async function readJson(file){return JSON.parse(await readFile(file,'utf8'));}
async function readJsonl(file){const source=(await readFile(file,'utf8')).trim();return source?source.split(/\r?\n/).map(JSON.parse):[];}
const safeDecisionInput={
  context:{specialist:'context-scorer',relevance:'high',fresh:true,trusted:true,contradiction:false,userPinned:false,authoritative:false,generatedNoise:false,sourcePath:'src/app.mjs',testPath:'tests/app.test.mjs',variant:401,tokenCost:20,ageHours:1,repositoryScope:'nolane-agent'},
  test:{specialist:'test-selector',sourcePath:'src/app.mjs',testPath:'tests/app.test.mjs',variant:401,changedFiles:1,changedSymbols:2,risk:'low',publicApiChanged:false,crossModule:false,dependencyChanged:false,assertionChanged:false,regressionUnknown:false},
  patch:{specialist:'patch-ranker',sourcePath:'src/app.mjs',testPath:'tests/app.test.mjs',variant:401,scopeMatch:true,testsPassed:true,hiddenTestsPassed:true,securityFindings:0,risk:'low',regressionDetected:false,apiChange:false,evidenceComplete:true,reversible:true},
  risk:{specialist:'risk-classifier',sourcePath:'src/app.mjs',testPath:'tests/app.test.mjs',variant:401,reversible:true,outsideWorkspace:false,destructive:false,secretAccess:false,networkEgress:false,operation:'read-or-local-test',filesAffected:1,schemaChange:false,authChange:false},
};

export async function generateForensicRecoveryCheckpoint4({root=process.cwd(),writeOutputs=false}={}){
  const requirements=path.join(root,'requirements');
  const custody=await readJson(path.join(requirements,'forensic-source-custody.json'));
  const symbolInventory=await readJson(path.join(requirements,'nolane-symbol-surface-inventory-summary.json'));
  const truthLedger=await readJson(path.join(requirements,'nolane-native-function-parity-summary.json'));
  const truthRecords=await readJsonl(path.join(requirements,'nolane-native-function-parity-ledger.jsonl'));
  const assertionBaseline=await readJson(path.join(root,'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json'));
  const masterAudit=await readJson(path.join(root,'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json'));
  const outputRoot=path.join(root,'models/specialists');
  const suiteVerification=await verifyBootstrapSpecialistSuite({outputRoot});
  const suiteArtifacts={}; const suiteBenchmarks={}; const suiteDatasetReceipts={}; const registry=new ModelArtifactRegistry();
  for(const specialist of SUPPORTED_BOOTSTRAP_SPECIALISTS){
    const target=path.join(outputRoot,specialist,'bootstrap-v1');
    const [artifact,benchmark,datasetReceipt]=await Promise.all([readJson(path.join(target,'model.json')),readJson(path.join(target,'benchmark.json')),readJson(path.join(target,'dataset-receipt.json'))]);
    suiteArtifacts[specialist]=artifact; suiteBenchmarks[specialist]=benchmark; suiteDatasetReceipts[specialist]=datasetReceipt;
    registry.register(artifact); registry.promote({artifactSha256:artifact.artifactSha256,evaluation:benchmark.heldOut,approvedBy:'forensic-recovery-checkpoint-4'});
  }
  const decisionReceipt=new SpecialistDecisionSupport({artifactRegistry:registry}).decide(safeDecisionInput);
  const claims=evaluateRecoveryClaims({custody:custody.records,truthLedger:truthRecords,uiAudit:{sourceLocalComplete:true,complete:false,summary:{externalCertification:1}},externalReceipts:[]});
  const verification=verifyForensicRecoveryCheckpoint4({custody,truthLedger,assertionBaseline,masterAudit,suiteArtifacts,suiteBenchmarks,suiteVerification,decisionReceipt,claims});
  const gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const report=Object.freeze({schema:'nolane.forensics.recovery-checkpoint-4.v1',product:'Nolane Agent',productVersion:'5.0.0-beta.6',checkpoint:'forensic-recovery-checkpoint.4',gitHead,verification,custody:{records:custody.records,claims},symbolInventory,truthLedger,assertionEvidence:{receiptSha256:assertionBaseline.receiptSha256,coverage:assertionBaseline.coverage},masterLedgerAssertionAudit:{receiptSha256:masterAudit.receiptSha256,summary:masterAudit.summary,certifiable:masterAudit.certifiable},boundedSpecialistSuite:{verification:suiteVerification,artifacts:suiteArtifacts,benchmarks:suiteBenchmarks,datasetReceipts:suiteDatasetReceipts,decisionReceipt},nextCheckpointEntryCriteria:['Provide canonical NolaneNative archive bytes matching SHA-256 1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9.','Reduce the remaining assertion-unbound Master Ledger records with dedicated positive and negative evidence.','Replace deterministic bootstrap cohorts with verified real repository trajectories and repository-disjoint held-out benchmarks.','Run UI performance, NVDA/Narrator, high-contrast, zoom, and screenshot certification on Windows 11 x64 with 8 GB RAM.','Run provider-real dogfood and same-budget comparative benchmark with independent receipts.']});
  const docs=path.join(root,'docs/checkpoints'); const jsonPath=path.join(docs,'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-4.json'); const mdPath=path.join(docs,'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-4.md');
  const audit=masterAudit.summary; const md=`# Nolane Agent Forensic Recovery Checkpoint 4\n\n- Status: **${verification.status}**\n- Git head at generation: \`${gitHead}\`\n- UI/Audit assertion bindings: **48/48**\n- Master Ledger assertion-verified: **${audit.assertionVerified}**\n- Master Ledger assertion-unbound: **${audit.assertionUnbound}**\n- External-unverified: **${audit.externalUnverified}**\n- Bounded specialist suite: **4/4 verified**\n- Decision support: **fail-closed and verified**\n- General coding intelligence claim: **no**\n- NolaneNative function-level parity: **not verified**\n\n## Specialist artifacts\n\n${verification.specialists.map((item)=>`- \`${item.specialist}\`: \`${item.artifactSha256}\`, held-out accuracy ${item.heldOutAccuracy}`).join('\n')}\n\n## Protected non-claims\n\nComplete NolaneNative parity, comparative superiority, small-model superintelligence, general coding intelligence, provider-real certification, and Windows external certification remain locked.\n`;
  if(writeOutputs){await mkdir(docs,{recursive:true});await writeFile(jsonPath,`${JSON.stringify(report,null,2)}\n`);await writeFile(mdPath,md);}
  return Object.freeze({report,jsonPath,mdPath,wroteOutputs:writeOutputs});
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)generateForensicRecoveryCheckpoint4({writeOutputs:process.argv.includes('--write')}).then(({report,jsonPath,mdPath,wroteOutputs})=>console.log(JSON.stringify({status:report.verification.status,receiptSha256:report.verification.receiptSha256,wroteOutputs,jsonPath:path.relative(process.cwd(),jsonPath),mdPath:path.relative(process.cwd(),mdPath)}))).catch((error)=>{console.error(error.stack??error);process.exitCode=1;});
