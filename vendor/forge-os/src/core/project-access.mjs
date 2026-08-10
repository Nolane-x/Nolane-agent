import { assertPrincipal, principalRecord, SYSTEM_PRINCIPAL } from './principals.mjs';

export const PROJECT_CAPABILITIES = Object.freeze(['read','write','review','release','admin']);
const CAPABILITY_SET = new Set(PROJECT_CAPABILITIES);

function normalizeCapabilities(values) {
  const result=[...new Set((values??[]).map(String))];
  for(const capability of result) if(!CAPABILITY_SET.has(capability)) throw new TypeError(`Unknown project capability: ${capability}`);
  return result;
}

export function createProjectAccess(principal = SYSTEM_PRINCIPAL) {
  const owner=assertPrincipal(principal);
  return {
    ownerPrincipalId:owner.id,
    ownerTrustDomain:owner.trustDomain,
    entries:[{
      principalId:owner.id,
      trustDomain:owner.trustDomain,
      capabilities:[...PROJECT_CAPABILITIES],
      grantedBy:principalRecord(owner),
      grantedAt:new Date().toISOString(),
    }],
  };
}

export function normalizeProjectAccess(access, { fallbackPrincipal = SYSTEM_PRINCIPAL } = {}) {
  if(!access||typeof access!=='object'||Array.isArray(access)) return createProjectAccess(fallbackPrincipal);
  const ownerPrincipalId=String(access.ownerPrincipalId??fallbackPrincipal.id).trim();
  const ownerTrustDomain=String(access.ownerTrustDomain??fallbackPrincipal.trustDomain).trim();
  const entries=(access.entries??[]).map((entry)=>({
    principalId:String(entry.principalId??'').trim(),
    trustDomain:String(entry.trustDomain??'').trim(),
    capabilities:normalizeCapabilities(entry.capabilities),
    grantedBy:entry.grantedBy??principalRecord(fallbackPrincipal),
    grantedAt:entry.grantedAt??new Date(0).toISOString(),
  })).filter((entry)=>entry.principalId&&entry.trustDomain);
  if(!entries.some((entry)=>entry.principalId===ownerPrincipalId)) entries.unshift({
    principalId:ownerPrincipalId,trustDomain:ownerTrustDomain,capabilities:[...PROJECT_CAPABILITIES],grantedBy:principalRecord(fallbackPrincipal),grantedAt:new Date(0).toISOString(),
  });
  return {ownerPrincipalId,ownerTrustDomain,entries};
}

export function projectCapabilities(project, principal) {
  const actor=assertPrincipal(principal);
  if(actor.type==='system'||actor.roles.includes('system')) return new Set(PROJECT_CAPABILITIES);
  const access=normalizeProjectAccess(project.access);
  if(access.ownerPrincipalId===actor.id) return new Set(PROJECT_CAPABILITIES);
  const capabilities=new Set();
  for(const entry of access.entries){
    if(entry.principalId===actor.id || (entry.principalId==='*'&&entry.trustDomain===actor.trustDomain)) for(const capability of entry.capabilities) capabilities.add(capability);
  }
  return capabilities;
}

export function assertProjectAccess(project, principal, capability='read') {
  const capabilities=projectCapabilities(project,principal);
  if(!capabilities.size) throw new Error(`Project access denied: ${project.id}`);
  if(!capabilities.has(capability)&&!capabilities.has('admin')) throw new Error(`Project capability ${capability} is required`);
  return principal;
}

export function grantProjectAccess(project, input, principal) {
  const actor=assertPrincipal(principal);
  assertProjectAccess(project,actor,'admin');
  const principalId=String(input.principalId??'').trim();
  const trustDomain=String(input.trustDomain??'').trim();
  if(!principalId||!trustDomain) throw new TypeError('principalId and trustDomain are required');
  const capabilities=normalizeCapabilities(input.capabilities);
  if(!capabilities.length) throw new TypeError('At least one project capability is required');
  const entries=(project.access?.entries??[]).filter((entry)=>entry.principalId!==principalId);
  entries.push({principalId,trustDomain,capabilities,grantedBy:principalRecord(actor),grantedAt:new Date().toISOString()});
  return {...project,access:{...project.access,entries}};
}
