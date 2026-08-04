function json(res, status, value, headers = {}) { const body = JSON.stringify(value); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), ...headers }); res.end(body); }
async function readJson(req, maxBytes = 1_000_000) { let bytes = 0; const chunks = []; for await (const chunk of req) { bytes += chunk.length; if (bytes > maxBytes) throw Object.assign(new Error('Request body too large'), { statusCode: 413 }); chunks.push(chunk); } if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }); } }
function isEnterpriseSession(req) { return req?.forgePrincipal?.kind === 'enterprise-session'; }
function tenant(req, requested, { required = true } = {}) {
  const principalTenant = String(req?.forgePrincipal?.organizationId ?? '').trim();
  const requestedTenant = String(requested ?? '').trim();
  if (isEnterpriseSession(req)) {
    if (requestedTenant && requestedTenant !== principalTenant) throw Object.assign(new Error('Cross-tenant access is denied'), { statusCode: 403, code: 'tenant-mismatch' });
    return principalTenant;
  }
  if (!requestedTenant && required) throw Object.assign(new Error('organizationId is required'), { statusCode: 400 });
  return requestedTenant || null;
}
function bodyForTenant(req, body) { return { ...body, organizationId: tenant(req, body?.organizationId) }; }
function assertRecordTenant(req, record) { if (isEnterpriseSession(req) && record?.organizationId !== req.forgePrincipal.organizationId) throw Object.assign(new Error('Cross-tenant access is denied'), { statusCode: 403, code: 'tenant-mismatch' }); return record; }

export function createEnterpriseCloudRoutes({ enterpriseService, cloudQueue, autoscaler, sandboxService = null } = {}) {
  return async function enterpriseCloudRoute(req, res, url) {
    const method = req.method ?? 'GET'; const pathname = url.pathname;
    if (method === 'POST' && pathname === '/api/enterprise/organizations') { if (!enterpriseService) throw Object.assign(new Error('Enterprise service is not configured'), { statusCode: 503 }); json(res, 201, enterpriseService.createOrganization(await readJson(req))); return true; }
    if (method === 'PUT' && pathname === '/api/enterprise/members') { if (!enterpriseService) throw Object.assign(new Error('Enterprise service is not configured'), { statusCode: 503 }); json(res, 200, enterpriseService.upsertMember(bodyForTenant(req, await readJson(req)))); return true; }
    if (method === 'POST' && pathname === '/api/enterprise/policies') { if (!enterpriseService) throw Object.assign(new Error('Enterprise service is not configured'), { statusCode: 503 }); json(res, 201, enterpriseService.bindPolicy(bodyForTenant(req, await readJson(req)))); return true; }
    if (method === 'POST' && pathname === '/api/enterprise/authorize') { if (!enterpriseService) throw Object.assign(new Error('Enterprise service is not configured'), { statusCode: 503 }); json(res, 200, enterpriseService.authorize(bodyForTenant(req, await readJson(req)))); return true; }
    if (method === 'GET' && pathname === '/api/enterprise/audit') { if (!enterpriseService) throw Object.assign(new Error('Enterprise service is not configured'), { statusCode: 503 }); json(res, 200, enterpriseService.listAuditEvents({ organizationId: tenant(req, url.searchParams.get('organizationId') || undefined), limit: url.searchParams.get('limit') || undefined })); return true; }
    if (method === 'POST' && pathname === '/api/cloud/jobs') { if (!cloudQueue) throw Object.assign(new Error('Cloud queue is not configured'), { statusCode: 503 }); json(res, 201, cloudQueue.enqueue(bodyForTenant(req, await readJson(req)))); return true; }
    if (method === 'GET' && pathname === '/api/cloud/jobs/metrics') { if (!cloudQueue) throw Object.assign(new Error('Cloud queue is not configured'), { statusCode: 503 }); json(res, 200, cloudQueue.metrics({ organizationId: tenant(req, url.searchParams.get('organizationId') || undefined, { required: false }) || undefined })); return true; }
    const jobById = pathname.match(/^\/api\/cloud\/jobs\/([^/]+)$/);
    if (method === 'GET' && jobById) { if (!cloudQueue) throw Object.assign(new Error('Cloud queue is not configured'), { statusCode: 503 }); const job = cloudQueue.get(decodeURIComponent(jobById[1])); if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 }); json(res, 200, assertRecordTenant(req, job)); return true; }
    if (method === 'POST' && pathname === '/api/cloud/workers/lease') { if (!cloudQueue) throw Object.assign(new Error('Cloud queue is not configured'), { statusCode: 503 }); const lease = cloudQueue.lease(bodyForTenant(req, await readJson(req))); json(res, 200, lease); return true; }
    if (method === 'POST' && pathname === '/api/cloud/workers/heartbeat') { if (!cloudQueue) throw Object.assign(new Error('Cloud queue is not configured'), { statusCode: 503 }); const body = await readJson(req); if (isEnterpriseSession(req)) assertRecordTenant(req, cloudQueue.get(body.jobId)); json(res, 200, cloudQueue.heartbeat(body)); return true; }
    if (method === 'POST' && pathname === '/api/cloud/workers/complete') { if (!cloudQueue) throw Object.assign(new Error('Cloud queue is not configured'), { statusCode: 503 }); const body = await readJson(req); if (isEnterpriseSession(req)) assertRecordTenant(req, cloudQueue.get(body.jobId)); json(res, 200, cloudQueue.complete(body)); return true; }
    if (method === 'POST' && pathname === '/api/cloud/workers/fail') { if (!cloudQueue) throw Object.assign(new Error('Cloud queue is not configured'), { statusCode: 503 }); const body = await readJson(req); if (isEnterpriseSession(req)) assertRecordTenant(req, cloudQueue.get(body.jobId)); json(res, 200, cloudQueue.fail(body)); return true; }
    const cancelJob = pathname.match(/^\/api\/cloud\/jobs\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancelJob) { if (!cloudQueue) throw Object.assign(new Error('Cloud queue is not configured'), { statusCode: 503 }); const body = bodyForTenant(req, await readJson(req)); json(res, 200, cloudQueue.cancel({ jobId: decodeURIComponent(cancelJob[1]), organizationId: body.organizationId })); return true; }
    if (method === 'POST' && pathname === '/api/cloud/autoscale') { if (!autoscaler) throw Object.assign(new Error('Autoscaler is not configured'), { statusCode: 503 }); const body = await readJson(req); json(res, 200, autoscaler.decide(body.metrics, body.policy)); return true; }
    if (method === 'POST' && pathname === '/api/cloud/sandboxes') { if (!sandboxService) throw Object.assign(new Error('Cloud sandbox is not configured'), { statusCode: 503 }); json(res, 201, await sandboxService.create(bodyForTenant(req, await readJson(req)))); return true; }
    const sandboxById = pathname.match(/^\/api\/cloud\/sandboxes\/([^/]+)$/);
    if (method === 'GET' && sandboxById) { if (!sandboxService) throw Object.assign(new Error('Cloud sandbox is not configured'), { statusCode: 503 }); json(res, 200, sandboxService.get({ organizationId: tenant(req, url.searchParams.get('organizationId')), sandboxId: decodeURIComponent(sandboxById[1]) })); return true; }
    const sandboxTerminate = pathname.match(/^\/api\/cloud\/sandboxes\/([^/]+)\/terminate$/);
    if (method === 'POST' && sandboxTerminate) { if (!sandboxService) throw Object.assign(new Error('Cloud sandbox is not configured'), { statusCode: 503 }); const body = bodyForTenant(req, await readJson(req)); json(res, 200, await sandboxService.terminate({ organizationId: body.organizationId, sandboxId: decodeURIComponent(sandboxTerminate[1]), reason: body.reason })); return true; }
    return false;
  };
}
