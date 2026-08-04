export function ensureLocalEnterpriseBootstrap(service) {
  if (service.getOrganization('local')) return service.getOrganization('local');
  const organization = service.createOrganization({ id: 'local', name: 'Local Forge Studio' });
  service.upsertMember({ organizationId: 'local', principalId: 'local-admin', roles: ['owner'] });
  service.bindPolicy({ id: 'local-owner-all', organizationId: 'local', effect: 'allow', roles: ['owner'], actions: ['*'], resources: ['*'] });
  return organization;
}
