const SCIM_TYPE = 'application/scim+json; charset=utf-8';
function send(res, status, value, headers = {}) { if (status === 204) { res.writeHead(204, headers); res.end(); return; } const body = JSON.stringify(value); res.writeHead(status, { 'content-type': SCIM_TYPE, 'content-length': Buffer.byteLength(body), ...headers }); res.end(body); }
async function readJson(req, maxBytes = 1_000_000) { const chunks = []; let bytes = 0; for await (const chunk of req) { bytes += chunk.length; if (bytes > maxBytes) throw Object.assign(new Error('SCIM request is too large'), { statusCode: 413, code: 'scim-too-large' }); chunks.push(chunk); } if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Invalid SCIM JSON'), { statusCode: 400, code: 'scim-invalid-json' }); } }
function decode(value) { try { return decodeURIComponent(value); } catch { throw Object.assign(new Error('Invalid SCIM resource id'), { statusCode: 400, code: 'scim-invalid-id' }); } }

export class ScimHttpAdapter {
  constructor({ service, oauth } = {}) { if (!service || !oauth?.authenticate) throw new TypeError('service and oauth are required'); this.service = service; this.oauth = oauth; }
  writeError(res, error) { if (res.headersSent) { res.destroy(error); return; } send(res, error.statusCode ?? 500, { schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: String(error.statusCode ?? 500), scimType: error.code ?? undefined, detail: error.statusCode ? error.message : 'Internal SCIM error' }); }
  async #principal(req, scope) { const principal = await this.oauth.authenticate(req, { scopes: [scope] }); if (!principal.organizationId) throw Object.assign(new Error('SCIM token does not identify an organization'), { statusCode: 403, code: 'scim-tenant-missing' }); return principal; }
  async handle(req, res, url) {
    const method = req.method ?? 'GET'; const pathname = url.pathname;
    if (method === 'GET' && pathname === '/scim/v2/ServiceProviderConfig') { send(res, 200, { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'], patch: { supported: false }, bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 }, filter: { supported: false, maxResults: 1000 }, changePassword: { supported: false }, sort: { supported: false }, etag: { supported: false }, authenticationSchemes: [{ type: 'oauthbearertoken', name: 'OAuth Bearer Token', description: 'OAuth 2.0 bearer token', primary: true }] }); return true; }
    if (!pathname.startsWith('/scim/v2/')) return false;
    const userMatch = pathname.match(/^\/scim\/v2\/Users(?:\/([^/]+))?$/);
    const groupMatch = pathname.match(/^\/scim\/v2\/Groups(?:\/([^/]+))?$/);
    if (!userMatch && !groupMatch) return false;
    const write = ['POST', 'PUT', 'DELETE'].includes(method); const principal = await this.#principal(req, write ? 'scim.write' : 'scim.read'); const org = principal.organizationId;
    if (userMatch) {
      const id = userMatch[1] ? decode(userMatch[1]) : null;
      if (method === 'POST' && !id) { const record = this.service.createUser(org, await readJson(req)); send(res, 201, record, { location: `/scim/v2/Users/${encodeURIComponent(record.id)}` }); return true; }
      if (method === 'GET' && !id) { send(res, 200, this.service.listUsers(org, { startIndex: url.searchParams.get('startIndex') ?? 1, count: url.searchParams.get('count') ?? 100 })); return true; }
      if (method === 'GET' && id) { send(res, 200, this.service.getUser(org, id)); return true; }
      if (method === 'PUT' && id) { send(res, 200, this.service.replaceUser(org, id, await readJson(req))); return true; }
      if (method === 'DELETE' && id) { this.service.deleteUser(org, id); send(res, 204); return true; }
    }
    if (groupMatch) {
      const id = groupMatch[1] ? decode(groupMatch[1]) : null;
      if (method === 'POST' && !id) { const record = this.service.createGroup(org, await readJson(req)); send(res, 201, record, { location: `/scim/v2/Groups/${encodeURIComponent(record.id)}` }); return true; }
      if (method === 'GET' && !id) { send(res, 200, this.service.listGroups(org, { startIndex: url.searchParams.get('startIndex') ?? 1, count: url.searchParams.get('count') ?? 100 })); return true; }
      if (method === 'GET' && id) { send(res, 200, this.service.getGroup(org, id)); return true; }
      if (method === 'PUT' && id) { send(res, 200, this.service.replaceGroup(org, id, await readJson(req))); return true; }
      if (method === 'DELETE' && id) { this.service.deleteGroup(org, id); send(res, 204); return true; }
    }
    throw Object.assign(new Error('SCIM method is not supported'), { statusCode: 405, code: 'scim-method-not-supported' });
  }
}
