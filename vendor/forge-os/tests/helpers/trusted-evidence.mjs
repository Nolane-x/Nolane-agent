import path from 'node:path';
import { canonicalSha256 } from '../../src/core/canonical-json.mjs';
import { BlobStore } from '../../src/storage/blob-store.mjs';
import { CommandEvidenceProvider, EvidenceProviderRegistry } from '../../src/evidence/providers.mjs';

export const ALL_TEST_EVIDENCE_TYPES = [
  'research-source','ux-evidence','build-output','feature-test','verification-report','security-review',
  'artifact-verification','artifact-review','finding-resolution','signed-provenance','independent-security-review',
  'formal-invariant-evidence','supply-chain-attestation','integration-test','end-to-end-test','tenant-isolation-test','property-test','mutation-test','fuzz-test','resilience-test','rollback-proof',
];

export function createTestEvidenceRegistry(root,{evidenceTypes=ALL_TEST_EVIDENCE_TYPES}={}){
  const registry=new EvidenceProviderRegistry({blobStore:new BlobStore(path.join(root,'.blobs'))});
  registry.register(new CommandEvidenceProvider({id:'test-command',version:'1.0.0',recipes:{pass:{evidenceTypes,command:[process.execPath,'-e','process.stdout.write("forgeos trusted test receipt\\n")']}}}));
  return registry;
}

export function trustedEvidenceRecord(type,project,overrides={}){
  const sha256=overrides.sha256??'a'.repeat(64);
  const issuedBy={id:'evidence-provider:test-command',type:'service',roles:['evidence-provider'],trustDomain:'evidence-provider:test-command'};
  const requestedBy={id:'agent:test-requester',type:'agent',roles:['reviewer'],trustDomain:'test-suite'};
  const receiptCore={executionId:`run_${type}`,trusted:true,providerId:'test-command',providerVersion:'1.0.0',payloadSha256:sha256,requestedBy,issuedBy,completedAt:'2026-07-24T00:00:00.000Z'};
  return {
    id:`evidence_${type}`,
    type,
    title:`${type} evidence`,
    summary:'Trusted provider executed verification and retained its payload.',
    status:'pass',
    uri:`forge://blob/${sha256}`,
    sha256,
    subject:{projectId:project.id,revision:project.revision,semanticRevision:project.semanticRevision,artifactId:null,artifactSha256:null,findingId:null,sourceCommit:'abc1234'},
    producer:issuedBy,
    requestedBy,
    method:{kind:'command-test',providerId:'test-command',providerVersion:'1.0.0',recipeId:'pass',exitCode:0,signal:null},
    receipt:{...receiptCore,receiptSha256:canonicalSha256(receiptCore)},
    metadata:{},
    createdAt:'2026-07-24T00:00:00.000Z',
    ...overrides,
  };
}
