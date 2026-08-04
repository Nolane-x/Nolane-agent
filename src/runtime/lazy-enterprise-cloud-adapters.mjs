function scimError(res, error) {
  if (res.headersSent) { res.destroy(error); return; }
  const status = Number(error?.statusCode) || 500;
  const body = JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: String(status), scimType: error?.code ?? undefined, detail: status < 500 ? error.message : 'Internal SCIM error' });
  res.writeHead(status, { 'content-type': 'application/scim+json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

export function createLazyEnterpriseCloudAdapters({ moduleManager, oidcConfigured = false, scimConfigured = false } = {}) {
  if (!moduleManager?.activate) throw new TypeError('moduleManager is required');
  const activate = () => moduleManager.activate('enterprise-cloud');
  const enterpriseCloudRoutes = async (req, res, url) => {
    if (!url?.pathname?.startsWith('/api/enterprise/') && !url?.pathname?.startsWith('/api/cloud/')) return false;
    const module = await activate();
    return module.enterpriseCloudRoutes(req, res, url);
  };
  const requestAuthorizer = async (input = {}) => {
    if (input.principal?.kind === 'local-token') return Object.freeze({ decision: 'allow', code: 'local-token' });
    const module = await activate();
    return module.requestAuthorizer(input);
  };
  const oidcHttp = oidcConfigured ? Object.freeze({
    async handle(req, res, url) { const module = await activate(); if (!module.oidcHttp) throw Object.assign(new Error('OIDC is not configured'), { statusCode: 503 }); return module.oidcHttp.handle(req, res, url); },
    async authenticateRequest(req) { const module = await activate(); return module.oidcHttp?.authenticateRequest(req) ?? null; },
  }) : null;
  const scimHttp = scimConfigured ? Object.freeze({
    async handle(req, res, url) { const module = await activate(); if (!module.scimHttp) throw Object.assign(new Error('SCIM is not configured'), { statusCode: 503 }); return module.scimHttp.handle(req, res, url); },
    writeError: scimError,
  }) : null;
  return Object.freeze({ enterpriseCloudRoutes, requestAuthorizer, oidcHttp, scimHttp, activate });
}
