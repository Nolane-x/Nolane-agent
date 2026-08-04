import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { loadModelArtifact } from '../small-model/model-artifact.mjs';
import { SUPPORTED_BOOTSTRAP_SPECIALISTS } from '../small-model/bootstrap-specialist-suite-dataset.mjs';

const SHA256=/^[a-f0-9]{64}$/;
const PROTECTED=['completeParityClaimAllowed','comparativeSuperiorityClaimAllowed','windowsUiCertified','providerRealCertified','smallModelSuperintelligenceImplemented','allOriginalGoalsComplete'];
function object(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} is required`);return value;}
function receipt(value,label){if(!SHA256.test(String(value??'')))throw new Error(`${label} receipt is invalid`);}
function verifyReceipt(value,label){const {receiptSha256,...base}=object(value,label);receipt(receiptSha256,label);if(canonicalSha256(base)!==receiptSha256)throw new Error(`${label} receipt mismatch`);}

export function verifyForensicRecoveryCheckpoint4(input={}){
  const custody=object(input.custody,'Source custody');
  const truthLedger=object(input.truthLedger,'Truth ledger');
  const assertionBaseline=object(input.assertionBaseline,'Assertion baseline');
  const masterAudit=object(input.masterAudit,'Master assertion audit');
  const artifacts=object(input.suiteArtifacts,'Specialist artifacts');
  const benchmarks=object(input.suiteBenchmarks,'Specialist benchmarks');
  const suiteVerification=object(input.suiteVerification,'Specialist suite verification');
  const decisionReceipt=object(input.decisionReceipt,'Decision support receipt');
  const claims=object(input.claims,'Recovery claims');

  if(!custody.records?.some((item)=>item.id==='nolane-native-canonical'&&item.status!=='verified'))throw new Error('Canonical NolaneNative source must remain explicitly unavailable');
  if(truthLedger.completeParityEligible!==false||Number(truthLedger.unresolved)<1)throw new Error('NolaneNative truth ledger must retain unresolved records');
  const ui=assertionBaseline.coverage?.summary;
  if(!ui||ui.requirementsTotal!==48||ui.requirementsBound!==48||ui.requirementsUnbound!==0||ui.requirementsPositiveBound!==48||ui.requirementsNegativeBound!==48||ui.overBroadTestFiles!==0||assertionBaseline.coverage?.certifiable!==true)throw new Error('UI/Audit assertion bindings are incomplete');
  receipt(assertionBaseline.receiptSha256,'Assertion baseline');

  const ledger=object(masterAudit.summary,'Master assertion audit summary');
  const total=Number(ledger.requirementsTotal),verified=Number(ledger.assertionVerified),unbound=Number(ledger.assertionUnbound),external=Number(ledger.externalUnverified);
  if(![total,verified,unbound,external].every(Number.isSafeInteger)||total!==1460||verified+unbound+external!==total)throw new Error('Master Ledger assertion disposition is incomplete');
  if(verified<900)throw new Error('Master Ledger assertion verified threshold is not met');
  if(unbound>450)throw new Error('Master Ledger assertion unbound threshold is exceeded');
  receipt(masterAudit.receiptSha256,'Master assertion audit');

  if(suiteVerification.schema!=='nolane.small-model.bootstrap-specialist-suite-verification.v1'||suiteVerification.status!=='pass')throw new Error('Specialist suite verification is invalid');
  verifyReceipt(suiteVerification,'Specialist suite verification');
  const specialistSummary=[];
  for(const specialist of SUPPORTED_BOOTSTRAP_SPECIALISTS){
    if(!artifacts[specialist]) throw new Error(`${specialist} artifact is required`);
    const artifact=loadModelArtifact(artifacts[specialist]);
    const benchmark=object(benchmarks[specialist],`${specialist} benchmark`);
    if(artifact.specialist!==specialist)throw new Error(`${specialist} artifact identity mismatch`);
    if(!artifact.model.weights.flat().some((value)=>Math.abs(Number(value))>0))throw new Error(`${specialist} artifact must contain trained weights`);
    const loss=artifact.model.training?.lossHistory;
    if(!Array.isArray(loss)||loss.length<2||!(Number(loss.at(-1))<Number(loss[0])))throw new Error(`${specialist} artifact must show loss reduction`);
    verifyReceipt(benchmark,`${specialist} benchmark`);
    if(benchmark.schema!=='nolane.small-model.bootstrap-specialist-benchmark.v1'||benchmark.specialist!==specialist||benchmark.artifactSha256!==artifact.artifactSha256)throw new Error(`${specialist} benchmark binding is invalid`);
    for(const evaluation of [benchmark.validation,benchmark.heldOut])if(evaluation?.independent!==true||evaluation?.heldOut!==true||evaluation?.allowed!==true||Number(evaluation.accuracy)<.95||Number(evaluation.safetyViolations)>Number(evaluation.baselineSafetyViolations))throw new Error(`${specialist} held-out evidence is insufficient`);
    if(benchmark.claims?.generalCodingIntelligence!==false||benchmark.claims?.frontierParity!==false||benchmark.claims?.competitorSuperiority!==false)throw new Error(`${specialist} benchmark non-claims must remain locked`);
    if(suiteVerification.artifactSha256BySpecialist?.[specialist]!==artifact.artifactSha256||suiteVerification.benchmarkReceiptSha256BySpecialist?.[specialist]!==benchmark.receiptSha256)throw new Error(`${specialist} suite verification binding mismatch`);
    specialistSummary.push({specialist,artifactSha256:artifact.artifactSha256,labels:artifact.model.labels,dimensions:artifact.model.dimensions,parameters:benchmark.resourceProfile?.parameters,heldOutAccuracy:benchmark.heldOut.accuracy,benchmarkReceiptSha256:benchmark.receiptSha256});
  }
  receipt(decisionReceipt.receiptSha256,'Decision support');
  if(decisionReceipt.schema!=='nolane.small-model.specialist-decision-support.v1'||decisionReceipt.status!=='allow'||decisionReceipt.allowed!==true||decisionReceipt.requiresApproval!==false)throw new Error('Safe decision support receipt is required');
  if(decisionReceipt.claims?.generalCodingIntelligence!==false||decisionReceipt.claims?.frontierParity!==false||decisionReceipt.claims?.competitorSuperiority!==false)throw new Error('Decision support non-claims must remain locked');
  for(const claim of PROTECTED)if(claims[claim]!==false)throw new Error(`Protected claim must remain false: ${claim}`);

  const base={schema:'nolane.forensics.recovery-checkpoint-4-verification.v1',status:'pass',uiAuditAssertionBindingsComplete:true,masterLedgerEvidenceReduced:true,boundedSpecialistSuiteVerified:true,specialistDecisionSupportVerified:true,generalCodingIntelligenceClaimAllowed:false,functionLevelNolaneNativeParityVerified:false,masterLedger:{total,assertionVerified:verified,assertionUnbound:unbound,externalUnverified:external,overBroadTestFiles:Number(ledger.overBroadTestFiles??0),missingNegativeAssertions:Number(ledger.missingNegativeAssertions??0)},specialists:specialistSummary,nolane_nativeTruth:{total:truthLedger.total,resolved:truthLedger.resolved,unresolved:truthLedger.unresolved},externalBlockers:['canonical-nolane-native-source-bytes','provider-real-certification','windows-8gb-performance','screen-reader-certification','visual-screenshot-certification','same-budget-comparative-benchmark','repository-disjoint-real-trajectory-specialist-benchmark'],claims:Object.fromEntries(PROTECTED.map((claim)=>[claim,false]))};
  return Object.freeze({...base,receiptSha256:canonicalSha256(base)});
}
