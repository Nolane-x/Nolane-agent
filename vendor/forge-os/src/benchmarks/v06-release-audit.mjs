import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {V06RuntimeService} from '../v06/service.mjs';
import {runSkillIntelligenceAudit} from './skill-intelligence-audit.mjs';
import {runSkillCertificationAudit} from './skill-certification-audit.mjs';
import {canonicalSha256} from '../core/canonical-json.mjs';
import {PRODUCT} from '../core/constants.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function runV06ReleaseAudit({root=ROOT}={}){
 const v06=new V06RuntimeService({root});const [status,skillAudit,certification]=await Promise.all([v06.status(),runSkillIntelligenceAudit({root}),runSkillCertificationAudit({root})]);
 const payload={schemaVersion:1,version:PRODUCT.version,kernel:{total:status.kernelTechniqueCount,l0:status.l0TechniqueCount,l1:status.l1TechniqueCount,stable:skillAudit.skillsV2.stable,candidate:skillAudit.skillsV2.candidate},graph:{outcomes:status.outcomeCount,techniques:status.techniqueCount,evaluators:status.evaluatorCount},review:{...status.reviewBenchmark,groundTruth:'deterministic-conformance-corpus',expertLabeledRepositories:false},security:status.agentSurfaceAdversarial,quality:skillAudit.quality,stableMaterialization:skillAudit.stableMaterialization,certification,features:{executionGraph:true,fencedCoverageLedger:true,codeReviewVerticalSlice:true,continuousLearningQuarantine:true,harnessRuntimeV2:true,agentSurfaceSecurity:true,globalContextKernelV2:true,brokeredLocalProcessRunner:true},claims:{proceduralSkillsProductionGrade1024:false,fullPostgresLifecycleHA:false,universalMicroVmSandbox:false,expertLabeledCodeReviewBenchmark:false,tenThousandPairedRuns:false,allKernelStableOrCertified:false}};
 return Object.freeze({...payload,reportSha256:canonicalSha256(payload)});
}
