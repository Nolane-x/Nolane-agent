function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store', ...headers });
  res.end(body);
}

function required(value, name) { const text = String(value ?? '').trim(); if (!text) throw Object.assign(new TypeError(`${name} is required`), { statusCode: 400 }); return text; }
function safeReturnTo(value) {
  if (value == null || value === '') return '/';
  const text = String(value);
  if (!text.startsWith('/') || text.startsWith('//') || text.includes('\\') || /[\u0000-\u001f]/.test(text)) throw Object.assign(new Error('returnTo must be a local absolute path'), { statusCode: 400, code: 'oidc-return-to-invalid' });
  return text;
}
function cookieValue(req, name) {
  const header = String(req?.headers?.cookie ?? '');
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    if (pair.slice(0, index).trim() === name) {
      try { return decodeURIComponent(pair.slice(index + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
function sessionCookie(token, { secure, maxAgeSeconds }) {
  return [`forge_session=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', ...(secure ? ['Secure'] : []), `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`].join('; ');
}

export class OidcHttpAdapter {
  constructor({ loginManager, sessionService, enterpriseService, roleMapper = () => [], secureCookies = true, clock = () => Date.now() } = {}) {
    if (!loginManager?.begin || !loginManager?.complete || !sessionService?.issue || !sessionService?.authenticate || !sessionService?.revoke || !enterpriseService?.upsertMember) throw new TypeError('loginManager, sessionService and enterpriseService are required');
    this.loginManager = loginManager; this.sessionService = sessionService; this.enterpriseService = enterpriseService; this.roleMapper = roleMapper; this.secureCookies = secureCookies === true; this.clock = clock;
  }

  authenticateRequest(req) {
    const token = cookieValue(req, 'forge_session');
    if (!token) return null;
    const session = this.sessionService.authenticate(token);
    return session ? Object.freeze({ ...session, kind: 'enterprise-session' }) : null;
  }

  async handle(req, res, url) {
    const method = String(req.method ?? 'GET').toUpperCase();
    const pathname = url.pathname;
    if (method === 'GET' && pathname === '/api/enterprise/sso/login') {
      const organizationId = required(url.searchParams.get('organizationId'), 'organizationId');
      const returnTo = safeReturnTo(url.searchParams.get('returnTo') ?? '/');
      const started = this.loginManager.begin({ organizationId, returnTo });
      res.writeHead(302, { location: started.authorizationUrl, 'cache-control': 'no-store' }); res.end(); return true;
    }
    if (method === 'GET' && pathname === '/api/enterprise/sso/callback') {
      const state = required(url.searchParams.get('state'), 'state');
      const code = required(url.searchParams.get('code'), 'code');
      const principal = await this.loginManager.complete({ state, code });
      const roles = [...new Set((this.roleMapper(principal.organizationId, principal.groups ?? [], principal) ?? []).map(String).filter(Boolean))];
      this.enterpriseService.upsertMember({ organizationId: principal.organizationId, principalId: principal.subject, roles, active: true });
      const issued = this.sessionService.issue({ ...principal, roles });
      const maxAgeSeconds = Math.max(0, (Number(issued.session.expiresAt) - this.clock()) / 1_000);
      res.writeHead(302, { location: safeReturnTo(principal.returnTo ?? '/'), 'set-cookie': sessionCookie(issued.token, { secure: this.secureCookies, maxAgeSeconds }), 'cache-control': 'no-store' }); res.end(); return true;
    }
    if (method === 'GET' && pathname === '/api/enterprise/session') {
      const principal = this.authenticateRequest(req);
      if (!principal) { json(res, 401, { error: 'unauthorized' }); return true; }
      json(res, 200, principal); return true;
    }
    if (method === 'POST' && pathname === '/api/enterprise/sso/logout') {
      const token = cookieValue(req, 'forge_session');
      if (token) this.sessionService.revoke(token);
      res.writeHead(204, { 'set-cookie': sessionCookie('', { secure: this.secureCookies, maxAgeSeconds: 0 }), 'cache-control': 'no-store' }); res.end(); return true;
    }
    return false;
  }
}
