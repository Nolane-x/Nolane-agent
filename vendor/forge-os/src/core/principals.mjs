const TRUSTED_PRINCIPAL = Symbol('forgeos.trusted-principal');
const TYPES = new Set(['human','agent','service','system']);

function clean(value, label) {
  const result = String(value ?? '').trim();
  if (!result || result.length > 160) throw new TypeError(`${label} is invalid`);
  return result;
}

export function createPrincipal({ id, type, roles = [], scopes = ['*'], trustDomain = 'local', metadata = {} }) {
  const normalizedType = clean(type, 'principal.type');
  if (!TYPES.has(normalizedType)) throw new TypeError(`Unknown principal type: ${normalizedType}`);
  const principal = {
    id: clean(id, 'principal.id'),
    type: normalizedType,
    roles: [...new Set(roles.map((role) => clean(role, 'principal.role')))],
    scopes: [...new Set(scopes.map((scope) => clean(scope, 'principal.scope')))],
    trustDomain: clean(trustDomain, 'principal.trustDomain'),
    metadata: structuredClone(metadata),
  };
  Object.defineProperty(principal, TRUSTED_PRINCIPAL, { value: true, enumerable: false });
  return Object.freeze(principal);
}

export const SYSTEM_PRINCIPAL = createPrincipal({ id: 'forgeos-system', type: 'system', roles: ['system'], scopes: ['*'] });

export function assertPrincipal(principal, { type = null, role = null, scope = null } = {}) {
  if (!principal || principal[TRUSTED_PRINCIPAL] !== true) throw new Error('Authenticated principal is required');
  if (type && principal.type !== type) throw new Error(`${type} principal is required`);
  if (role && !principal.roles.includes(role)) throw new Error(`Principal role ${role} is required`);
  if (scope && !(principal.scopes.includes('*') || principal.scopes.includes(scope))) throw new Error(`Principal scope ${scope} is required`);
  return principal;
}

export function principalRecord(principal) {
  const trusted = assertPrincipal(principal);
  return { id: trusted.id, type: trusted.type, roles: [...trusted.roles], trustDomain: trusted.trustDomain };
}

export function samePrincipal(record, principal) {
  return Boolean(record?.principalId === assertPrincipal(principal).id || record?.id === principal.id);
}
