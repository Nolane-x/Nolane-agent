import path from 'node:path';

function parseSandboxPolicies(environment) {
  let policies = { local: { allowedRegions: ['local'], maxActive: 4, maxCpu: 8, maxRamMb: 16_384, maxTtlMs: 3_600_000, dataResidency: 'LOCAL' } };
  if (environment.FORGE_STUDIO_CLOUD_SANDBOX_POLICIES_JSON) {
    const parsed = JSON.parse(environment.FORGE_STUDIO_CLOUD_SANDBOX_POLICIES_JSON);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new TypeError('FORGE_STUDIO_CLOUD_SANDBOX_POLICIES_JSON must be an object');
    policies = parsed;
  }
  return policies;
}

function requireEnvironment(environment, names, label) {
  const missing = names.filter((name) => !environment[name]);
  if (missing.length) throw new TypeError(`${label} configuration is incomplete: ${missing.join(', ')}`);
}

export function createOptionalEnterpriseCloudModuleDescriptor({ dataDir, environment = process.env, eventSink = () => {} } = {}) {
  const root = path.resolve(String(dataDir ?? '.'));
  return {
    id: 'enterprise-cloud',
    essential: false,
    profiles: ['lite', 'balanced', 'performance'],
    async activate() {
      const [
        { EnterpriseService },
        { SqliteEnterpriseStore },
        { ensureLocalEnterpriseBootstrap },
        { ScimService },
        { SqliteScimStore },
        { ScimHttpAdapter },
        { OidcLoginManager },
        { OidcHttpAdapter },
        { loadOidcProviderRegistry },
        { EnterpriseSessionService },
        { SqliteEnterpriseSessionStore },
        { createEnterpriseRequestAuthorizer },
        { CloudQueue },
        { SqliteCloudQueueStore },
        { SqliteCloudSandboxStore },
        { AutoscalingController },
        { CloudSandboxService },
        { createCloudSandboxDriver },
        { createEnterpriseCloudRoutes },
        { OAuthResourceServer, createOAuthIntrospectionVerifier },
      ] = await Promise.all([
        import('../enterprise/enterprise-service.mjs'),
        import('../enterprise/sqlite-enterprise-store.mjs'),
        import('../enterprise/bootstrap-local-organization.mjs'),
        import('../enterprise/scim-service.mjs'),
        import('../enterprise/sqlite-scim-store.mjs'),
        import('../enterprise/scim-http-adapter.mjs'),
        import('../enterprise/oidc-login-manager.mjs'),
        import('../enterprise/oidc-http-adapter.mjs'),
        import('../enterprise/oidc-provider-registry.mjs'),
        import('../enterprise/enterprise-session-service.mjs'),
        import('../enterprise/sqlite-enterprise-session-store.mjs'),
        import('../enterprise/enterprise-request-authorizer.mjs'),
        import('../cloud/cloud-queue.mjs'),
        import('../cloud/sqlite-cloud-queue-store.mjs'),
        import('../cloud/sqlite-cloud-sandbox-store.mjs'),
        import('../cloud/autoscaling-controller.mjs'),
        import('../cloud/cloud-sandbox-service.mjs'),
        import('../cloud/cloud-sandbox-bootstrap.mjs'),
        import('../server/enterprise-cloud-routes.mjs'),
        import('../mcp/oauth-resource-server.mjs'),
      ]);

      const enterpriseStateStore = new SqliteEnterpriseStore(path.join(root, 'enterprise.db'));
      const enterpriseService = new EnterpriseService({ storage: enterpriseStateStore, eventSink });
      ensureLocalEnterpriseBootstrap(enterpriseService);
      const enterpriseSessionStore = new SqliteEnterpriseSessionStore(path.join(root, 'enterprise-sessions.db'));
      const enterpriseSessionService = new EnterpriseSessionService({ storage: enterpriseSessionStore, ttlMs: Number(environment.FORGE_STUDIO_ENTERPRISE_SESSION_TTL_MS) || 8 * 60 * 60_000 });
      const cloudQueueStore = new SqliteCloudQueueStore(path.join(root, 'cloud-queue.db'));
      const cloudQueue = new CloudQueue({ storage: cloudQueueStore });
      const scimStateStore = new SqliteScimStore(path.join(root, 'scim.db'));
      const scimService = new ScimService({ storage: scimStateStore });
      const autoscaler = new AutoscalingController();
      const cloudSandboxDriver = createCloudSandboxDriver({
        mode: environment.FORGE_STUDIO_CLOUD_SANDBOX_DRIVER ?? 'reference',
        kubectlExecutable: environment.FORGE_STUDIO_KUBECTL ?? 'kubectl',
        kubectlContext: environment.FORGE_STUDIO_KUBECTL_CONTEXT ?? null,
        kubeconfig: environment.FORGE_STUDIO_KUBECONFIG ?? null,
        runtimeClassName: environment.FORGE_STUDIO_KUBERNETES_RUNTIME_CLASS ?? 'gvisor',
        storageClassName: environment.FORGE_STUDIO_KUBERNETES_STORAGE_CLASS ?? null,
        snapshotClassName: environment.FORGE_STUDIO_KUBERNETES_SNAPSHOT_CLASS ?? null,
        namespacePrefix: environment.FORGE_STUDIO_KUBERNETES_NAMESPACE_PREFIX ?? 'forge',
        networkPolicyProvider: environment.FORGE_STUDIO_KUBERNETES_NETWORK_POLICY ?? 'cilium',
      });
      const cloudSandboxStore = new SqliteCloudSandboxStore(path.join(root, 'cloud-sandboxes.db'));
      const cloudSandboxService = new CloudSandboxService({ driver: cloudSandboxDriver, policies: parseSandboxPolicies(environment), storage: cloudSandboxStore, audit: eventSink });

      let oidcHttp = null;
      if (environment.FORGE_STUDIO_OIDC_PROVIDERS_JSON) {
        const oidcRegistry = loadOidcProviderRegistry({ json: environment.FORGE_STUDIO_OIDC_PROVIDERS_JSON, environment });
        for (const organizationId of oidcRegistry.organizations()) if (!enterpriseService.getOrganization(organizationId)) throw new TypeError(`OIDC organization is not provisioned: ${organizationId}`);
        const loginManager = new OidcLoginManager({ providerResolver: (organizationId) => oidcRegistry.resolve(organizationId) });
        oidcHttp = new OidcHttpAdapter({ loginManager, sessionService: enterpriseSessionService, enterpriseService, roleMapper: (organizationId, groups) => oidcRegistry.rolesFor(organizationId, groups), secureCookies: environment.FORGE_STUDIO_OIDC_SECURE_COOKIES !== 'false' });
      }

      let scimHttp = null;
      if (environment.FORGE_STUDIO_SCIM_INTROSPECTION_URL) {
        requireEnvironment(environment, ['FORGE_STUDIO_SCIM_ISSUER', 'FORGE_STUDIO_SCIM_AUDIENCE', 'FORGE_STUDIO_SCIM_CLIENT_ID', 'FORGE_STUDIO_SCIM_CLIENT_SECRET'], 'SCIM OAuth');
        const verifier = createOAuthIntrospectionVerifier({ endpoint: environment.FORGE_STUDIO_SCIM_INTROSPECTION_URL, clientId: environment.FORGE_STUDIO_SCIM_CLIENT_ID, clientSecret: environment.FORGE_STUDIO_SCIM_CLIENT_SECRET });
        scimHttp = new ScimHttpAdapter({ service: scimService, oauth: new OAuthResourceServer({ issuer: environment.FORGE_STUDIO_SCIM_ISSUER, audience: environment.FORGE_STUDIO_SCIM_AUDIENCE, verifier }) });
      }

      const enterpriseCloudRoutes = createEnterpriseCloudRoutes({ enterpriseService, cloudQueue, autoscaler, sandboxService: cloudSandboxService });
      const requestAuthorizer = createEnterpriseRequestAuthorizer({ enterpriseService });
      return {
        enterpriseService,
        enterpriseCloudRoutes,
        oidcHttp,
        scimHttp,
        requestAuthorizer,
        async close() {
          for (const store of [scimStateStore, enterpriseSessionStore, cloudSandboxStore, cloudQueueStore, enterpriseStateStore]) store.close?.();
        },
      };
    },
  };
}
