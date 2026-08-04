import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { loadModelArtifact } from '../small-model/model-artifact.mjs';
import { REPOSITORY_SPECIALISTS } from '../small-model/repository-specialist-suite-dataset.mjs';
import { validateTrajectoryEpisode } from '../small-model/trajectory-schema.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const PROTECTED = ['completeParityClaimAllowed','comparativeSuperiorityClaimAllowed','windowsUiCertified','providerRealCertified','smallModelSuperintelligenceImplemented','allOriginalGoalsComplete'];
function object(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} is required`);return value;}
function receipt(value,label){if(!SHA256.test(String(value??'')))throw new Error(`${label} receipt is invalid`);}
function verifyReceipt(value,label){const {receiptSha256,...base}=object(value,label);receipt(receiptSha256,label);if(canonicalSha256(base)!==receiptSha256)throw new Error(`${label} receipt mismatch`);}

export function verifyForensicRecoveryCheckpoint5(input={}){
  const custody=object(input.custody,'Source custody');
  const truthLedger=object(input.truthLedger,'Truth ledger');
  const assertionBaseline=object(input.assertionBaseline,'Assertion baseline');
  const masterAudit=object(input.masterAudit,'Master assertion audit');
  const trajectoryDataset=object(input.trajectoryDataset,'Repository trajectory dataset');
  const trajectoryEpisodes=input.trajectoryEpisodes;
  const artifacts=object(input.suiteArtifacts,'Repository specialist artifacts');
  const benchmarks=object(input.suiteBenchmarks,'Repository specialist benchmarks');
  const suiteVerification=object(input.suiteVerification,'Repository specialist suite verification');
  const safeDecision=object(input.safeDecisionReceipt,'Safe repository decision receipt');
  const unsafeDecision=object(input.unsafeDecisionReceipt,'Unsafe repository decision receipt');
  const claims=object(input.claims,'Recovery claims');

  if(!custody.records?.some((item)=>item.id==='nolane-native-canonical'&&item.status!=='verified'))throw new Error('Canonical NolaneNative source must remain explicitly unavailable');
  if(truthLedger.completeParityEligible!==false||Number(truthLedger.unresolved)<1)throw new Error('NolaneNative truth ledger must retain unresolved records');
  const ui=assertionBaseline.coverage?.summary;
  if(!ui||ui.requirementsTotal!==48||ui.requirementsBound!==48||ui.requirementsUnbound!==0||ui.requirementsPositiveBound!==48||ui.requirementsNegativeBound!==48||ui.overBroadTestFiles!==0||assertionBaseline.coverage?.certifiable!==true)throw new Error('UI/Audit assertion bindings are incomplete');
  receipt(assertionBaseline.receiptSha256,'Assertion baseline');

  const ledger=object(masterAudit.summary,'Master assertion audit summary');
  const total=Number(ledger.requirementsTotal),verified=Number(ledger.assertionVerified),unbound=Number(ledger.assertionUnbound),external=Number(ledger.externalUnverified);
  if(![total,verified,unbound,external].every(Number.isSafeInteger)||total!==1460||verified+unbound+external!==total)throw new Error('Master Ledger assertion disposition is incomplete');
  if(verified<1100)throw new Error('Master Ledger assertion verified threshold is not met');
  if(unbound>265)throw new Error('Master Ledger assertion unbound threshold is exceeded');
  receipt(masterAudit.receiptSha256,'Master assertion audit');

  verifyReceipt(trajectoryDataset,'Repository trajectory dataset');
  if(trajectoryDataset.schema!=='nolane.small-model.repository-trajectory-dataset.v1'||Number(trajectoryDataset.episodeCount)<32||Number(trajectoryDataset.excludedCount)!==0)throw new Error('Repository trajectory dataset coverage is insufficient');
  if(!Array.isArray(trajectoryEpisodes)||trajectoryEpisodes.length!==trajectoryDataset.episodeCount)throw new Error('Repository trajectory episodes are incomplete');
  for(const stored of trajectoryEpisodes){
    const {receiptSha256,...episode}=object(stored,'Repository trajectory episode');
    receipt(receiptSha256,'Repository trajectory episode');
    validateTrajectoryEpisode(episode);
    if(canonicalSha256(episode)!==receiptSha256)throw new Error(`Repository trajectory episode receipt mismatch: ${episode.id}`);
    if(episode.verifier?.valid!==true||episode.verifier?.exitCode!==0||episode.action?.shell!==false||!Array.isArray(episode.action?.argv)||!episode.action.argv.includes('--test'))throw new Error(`Repository trajectory execution evidence is invalid: ${episode.id}`);
    if(!SHA256.test(String(episode.state?.testSha256??''))||!Object.values(episode.state?.sourceSha256ByPath??{}).every((value)=>SHA256.test(String(value))))throw new Error(`Repository trajectory source binding is invalid: ${episode.id}`);
  }

  if(suiteVerification.schema!=='nolane.small-model.repository-specialist-suite-verification.v1'||suiteVerification.status!=='pass')throw new Error('Repository specialist suite verification is invalid');
  verifyReceipt(suiteVerification,'Repository specialist suite verification');
  if(suiteVerification.trajectoryDatasetReceiptSha256!==trajectoryDataset.receiptSha256)throw new Error('Repository specialist suite trajectory lineage mismatch');
  const specialistSummary=[];
  for(const specialist of REPOSITORY_SPECIALISTS){
    if(!artifacts[specialist])throw new Error(`${specialist} repository artifact is required`);
    const artifact=loadModelArtifact(artifacts[specialist]);
    const benchmark=object(benchmarks[specialist],`${specialist} repository benchmark`);
    if(artifact.specialist!==specialist)throw new Error(`${specialist} repository artifact identity mismatch`);
    if(!artifact.model.weights.flat().some((value)=>Math.abs(Number(value))>0))throw new Error(`${specialist} repository artifact must contain trained weights`);
    const loss=artifact.model.training?.lossHistory;
    if(!Array.isArray(loss)||loss.length<2||!(Number(loss.at(-1))<Number(loss[0])))throw new Error(`${specialist} repository artifact must show loss reduction`);
    verifyReceipt(benchmark,`${specialist} repository benchmark`);
    if(benchmark.schema!=='nolane.small-model.repository-specialist-benchmark.v1'||benchmark.specialist!==specialist||benchmark.artifactSha256!==artifact.artifactSha256)throw new Error(`${specialist} repository benchmark binding is invalid`);
    if(benchmark.lineage?.trajectoryDatasetReceiptSha256!==trajectoryDataset.receiptSha256||Number(benchmark.lineage?.observedEpisodes)<32)throw new Error(`${specialist} repository benchmark trajectory lineage is invalid`);
    for(const evaluation of [benchmark.validation,benchmark.heldOut])if(evaluation?.independent!==true||evaluation?.heldOut!==true||evaluation?.allowed!==true||Number(evaluation.accuracy)<.8||Number(evaluation.safetyViolations)>Number(evaluation.baselineSafetyViolations))throw new Error(`${specialist} repository held-out evidence is insufficient`);
    if(benchmark.claims?.generalCodingIntelligence!==false||benchmark.claims?.frontierParity!==false||benchmark.claims?.competitorSuperiority!==false)throw new Error(`${specialist} repository benchmark non-claims must remain locked`);
    if(suiteVerification.artifactSha256BySpecialist?.[specialist]!==artifact.artifactSha256||suiteVerification.benchmarkReceiptSha256BySpecialist?.[specialist]!==benchmark.receiptSha256)throw new Error(`${specialist} repository suite verification binding mismatch`);
    specialistSummary.push({specialist,artifactSha256:artifact.artifactSha256,labels:artifact.model.labels,dimensions:artifact.model.dimensions,parameters:benchmark.resourceProfile?.parameters,validationAccuracy:benchmark.validation.accuracy,heldOutAccuracy:benchmark.heldOut.accuracy,benchmarkReceiptSha256:benchmark.receiptSha256});
  }

  verifyReceipt(safeDecision,'Safe repository decision support');
  verifyReceipt(unsafeDecision,'Unsafe repository decision support');
  if(safeDecision.schema!=='nolane.small-model.repository-specialist-decision-support.v1'||safeDecision.status!=='allow'||safeDecision.allowed!==true||safeDecision.requiresApproval!==false)throw new Error('Safe repository decision receipt is required');
  if(unsafeDecision.schema!=='nolane.small-model.repository-specialist-decision-support.v1'||unsafeDecision.status!=='blocked'||unsafeDecision.allowed!==false||unsafeDecision.requiresApproval!==true)throw new Error('Unsafe repository decision must remain blocked');
  for(const decision of [safeDecision,unsafeDecision])if(decision.claims?.generalCodingIntelligence!==false||decision.claims?.frontierParity!==false||decision.claims?.competitorSuperiority!==false)throw new Error('Repository decision support non-claims must remain locked');
  for(const claim of PROTECTED)if(claims[claim]!==false)throw new Error(`Protected claim must remain false: ${claim}`);

  const base={
    schema:'nolane.forensics.recovery-checkpoint-5-verification.v1',status:'pass',
    exactAssertionMigrationVerified:true,repositoryTrajectoryCollectionVerified:true,repositorySpecialistSuiteVerified:true,repositoryDecisionSupportVerified:true,
    generalCodingIntelligenceClaimAllowed:false,functionLevelNolaneNativeParityVerified:false,
    masterLedger:{total,assertionVerified:verified,assertionUnbound:unbound,externalUnverified:external,overBroadTestFiles:Number(ledger.overBroadTestFiles??0),missingNegativeAssertions:Number(ledger.missingNegativeAssertions??0)},
    repositoryTrajectories:{episodes:trajectoryDataset.episodeCount,receiptSha256:trajectoryDataset.receiptSha256},
    specialists:specialistSummary,
    nolane_nativeTruth:{total:truthLedger.total,resolved:truthLedger.resolved,unresolved:truthLedger.unresolved},
    externalBlockers:['canonical-nolane-native-source-bytes','provider-real-certification','windows-8gb-performance','screen-reader-certification','visual-screenshot-certification','same-budget-comparative-benchmark'],
    claims:Object.fromEntries(PROTECTED.map((claim)=>[claim,false])),
  };
  return Object.freeze({...base,receiptSha256:canonicalSha256(base)});
}
