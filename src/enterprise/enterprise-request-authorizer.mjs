function actionFor(method, pathname) {
  const verb = String(method ?? 'GET').toUpperCase();
  const rules = [
    [/^\/api\/enterprise\/organizations$/, { POST: 'enterprise.organization.create', GET: 'enterprise.organization.read' }],
    [/^\/api\/enterprise\/members$/, { PUT: 'enterprise.member.write', GET: 'enterprise.member.read' }],
    [/^\/api\/enterprise\/policies$/, { POST: 'enterprise.policy.write', GET: 'enterprise.policy.read' }],
    [/^\/api\/enterprise\/authorize$/, { POST: 'enterprise.authorization.evaluate' }],
    [/^\/api\/enterprise\/audit$/, { GET: 'enterprise.audit.read' }],
    [/^\/api\/cloud\/jobs$/, { POST: 'cloud.job.create', GET: 'cloud.job.read' }],
    [/^\/api\/cloud\/jobs\/metrics$/, { GET: 'cloud.metrics.read' }],
    [/^\/api\/cloud\/jobs\/[^/]+$/, { GET: 'cloud.job.read' }],
    [/^\/api\/cloud\/jobs\/[^/]+\/cancel$/, { POST: 'cloud.job.cancel' }],
    [/^\/api\/cloud\/workers\/(lease|heartbeat|complete|fail)$/, { POST: 'cloud.worker.execute' }],
    [/^\/api\/cloud\/autoscale$/, { POST: 'cloud.autoscale.evaluate' }],
    [/^\/api\/cloud\/sandboxes$/, { POST: 'cloud.sandbox.create' }],
    [/^\/api\/cloud\/sandboxes\/[^/]+$/, { GET: 'cloud.sandbox.read' }],
    [/^\/api\/cloud\/sandboxes\/[^/]+\/terminate$/, { POST: 'cloud.sandbox.terminate' }],
  ];
  for (const [pattern, actions] of rules) if (pattern.test(pathname) && actions[verb]) return actions[verb];
  if (pathname === '/events') return 'events.read';
  if (pathname === '/') return 'ui.read';
  return ['GET', 'HEAD', 'OPTIONS'].includes(verb) ? 'api.read' : 'api.write';
}

export function createEnterpriseRequestAuthorizer({ enterpriseService } = {}) {
  if (!enterpriseService?.authorize) throw new TypeError('enterpriseService is required');
  return async function authorizeRequest({ req, url, principal } = {}) {
    if (!principal?.subject || !principal?.organizationId) return Object.freeze({ decision: 'deny', code: 'principal-missing' });
    const canonicalOrganizationHeader = String(req?.headers?.['x-nolane-organization'] ?? '').trim();
    const legacyOrganizationHeader = String(req?.headers?.['x-forge-organization'] ?? '').trim();
    if (canonicalOrganizationHeader && legacyOrganizationHeader && canonicalOrganizationHeader !== legacyOrganizationHeader) {
      return Object.freeze({ decision: 'deny', code: 'tenant-header-conflict', reason: 'Canonical and legacy organization headers disagree.' });
    }
    const organizationHeader = canonicalOrganizationHeader || legacyOrganizationHeader;
    if (organizationHeader && organizationHeader !== principal.organizationId) return Object.freeze({ decision: 'deny', code: 'tenant-header-mismatch', reason: 'The requested organization differs from the authenticated tenant.' });
    return enterpriseService.authorize({
      organizationId: principal.organizationId,
      principalId: principal.subject,
      action: actionFor(req?.method, url?.pathname ?? '/'),
      resource: `api:${url?.pathname ?? '/'}`,
      context: { mfa: principal.mfa === true },
    });
  };
}
