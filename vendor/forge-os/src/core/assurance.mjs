const freeze=(value)=>Object.freeze(value);
const evidence=(type,options={})=>freeze({type,maxAgeMs:options.maxAgeMs??7*24*60*60*1000,allowedMethodKinds:freeze(options.allowedMethodKinds??['command-test','external-attestation','human-review']),independent:options.independent??false});

const ARTIFACT_STATE_POLICY=freeze({
  A0:freeze({}),
  A1:freeze({'product-definition':'review','ux-design':'review',architecture:'review',planning:'review','release-readiness':'verified'}),
  A2:freeze({'product-definition':'review','ux-design':'review',architecture:'verified',planning:'verified','release-readiness':'verified'}),
  A3:freeze({'product-definition':'verified','ux-design':'verified',architecture:'verified',planning:'verified','release-readiness':'verified'}),
  A4:freeze({'product-definition':'verified','ux-design':'verified',architecture:'verified',planning:'verified','release-readiness':'verified'}),
});

export const ASSURANCE_PROFILES=freeze({
  A0:freeze({blockHighAtRelease:false,acceptedCriticalAllowed:true,artifactStates:ARTIFACT_STATE_POLICY.A0,requiredEvidence:freeze([])}),
  A1:freeze({blockHighAtRelease:false,acceptedCriticalAllowed:false,artifactStates:ARTIFACT_STATE_POLICY.A1,requiredEvidence:freeze([evidence('integration-test'),evidence('rollback-proof')])}),
  A2:freeze({blockHighAtRelease:true,acceptedCriticalAllowed:false,artifactStates:ARTIFACT_STATE_POLICY.A2,requiredEvidence:freeze([evidence('integration-test'),evidence('end-to-end-test'),evidence('tenant-isolation-test'),evidence('property-test'),evidence('rollback-proof')])}),
  A3:freeze({blockHighAtRelease:true,acceptedCriticalAllowed:false,artifactStates:ARTIFACT_STATE_POLICY.A3,requiredEvidence:freeze([evidence('integration-test'),evidence('end-to-end-test'),evidence('tenant-isolation-test'),evidence('property-test'),evidence('mutation-test'),evidence('fuzz-test'),evidence('resilience-test'),evidence('rollback-proof'),evidence('signed-provenance',{independent:true})])}),
  A4:freeze({blockHighAtRelease:true,acceptedCriticalAllowed:false,artifactStates:ARTIFACT_STATE_POLICY.A4,requiredEvidence:freeze([evidence('integration-test'),evidence('end-to-end-test'),evidence('tenant-isolation-test'),evidence('property-test'),evidence('mutation-test'),evidence('fuzz-test'),evidence('resilience-test'),evidence('rollback-proof'),evidence('signed-provenance',{independent:true}),evidence('independent-security-review',{independent:true}),evidence('formal-invariant-evidence',{independent:true}),evidence('supply-chain-attestation',{independent:true})])}),
});

export function assuranceProfile(level){const profile=ASSURANCE_PROFILES[level];if(!profile)throw new TypeError(`Unknown assurance level: ${level}`);return profile;}
export function requiredArtifactState(level,stage){return assuranceProfile(level).artifactStates[stage]??'draft';}
export function requiredEvidencePolicies(level){return assuranceProfile(level).requiredEvidence;}
