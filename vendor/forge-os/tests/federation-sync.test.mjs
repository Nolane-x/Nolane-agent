import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubRepositoryFetcher, FederationSynchronizer } from '../src/federation/synchronizer.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const source = { id: 'community-skills', kind: 'agent-skills-repository', authority: 'community', trust: 'discovery', title: 'Community', url: 'https://github.com/example/skills', revision: 'resolve-on-sync', license: { spdx: 'MIT', mode: 'vendor-allowed' }, domains: ['ui-design'], syncPolicy: { pinOnImport: true, maxAgeHours: 24 } };
const sha = '0123456789abcdef0123456789abcdef01234567';

test('GitHub fetcher resolves immutable commit and retrieves bounded skill files without archive execution', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(String(url));
    if (String(url).includes('/commits/HEAD')) return { ok: true, json: async () => ({ sha }) };
    if (String(url).includes('/git/trees/')) return { ok: true, json: async () => ({ tree: [
      { path: 'skills/ui-audit/SKILL.md', type: 'blob', sha: 'a', size: 120, url: 'https://api.github.com/blob/a' },
      { path: 'skills/ui-audit/references/check.md', type: 'blob', sha: 'b', size: 50, url: 'https://api.github.com/blob/b' },
      { path: 'bin/ignored.exe', type: 'blob', sha: 'c', size: 10, url: 'https://api.github.com/blob/c' },
    ] }) };
    const content = String(url).endsWith('/a') ? '---\nname: ui-audit\ndescription: Use when auditing interfaces\ncapability-id: ui-design.audit-accessibility\n---\n# Audit' : '# Check';
    return { ok: true, json: async () => ({ encoding: 'base64', content: Buffer.from(content).toString('base64') }) };
  };
  const snapshot = await new GitHubRepositoryFetcher({ fetchImpl }).fetch(source);
  assert.equal(snapshot.revision, sha);
  assert.deepEqual(snapshot.files.map((file) => file.path), ['skills/ui-audit/SKILL.md', 'skills/ui-audit/references/check.md']);
  assert.ok(requests.every((request) => !request.includes('zipball') && !request.includes('tarball')));
});

test('synchronizer imports discovered skills into quarantine, scans them, and never auto-promotes', async () => {
  const imported = []; const scanned = [];
  const service = {
    importProvider: async (provider) => { imported.push(provider); return { ...provider, status: 'quarantined' }; },
    scanProvider: async (providerId) => { scanned.push(providerId); return { provider: { providerId, status: 'quarantined' }, scanReceipt: { status: 'pass' } }; },
  };
  const snapshot = { source, revision: sha, observedAt: '2026-07-25T00:00:00.000Z', files: [{ path: 'skills/ui-audit/SKILL.md', content: '---\nname: ui-audit\ndescription: Use when auditing interfaces\ncapability-id: ui-design.audit-accessibility\n---\n# Audit' }] };
  const synchronizer = new FederationSynchronizer({ service, sourcesLoader: async () => [source], capabilityLoader: async () => [{ capabilityId: 'ui-design.audit-accessibility', title: 'Audit accessibility', domain: 'ui-design', intentSignals: ['audit'], knowledgeTopics: ['accessibility'], requiredTools: [] }], fetchers: { 'agent-skills-repository': { fetch: async () => snapshot } } });
  const principal = createPrincipal({ id: 'admin', type: 'human', roles: ['federation-admin'], scopes: ['tenant:tenant-a'], trustDomain: 'issuer/tenant-a' });
  const result = await synchronizer.sync('community-skills', { tenantId: 'tenant-a' }, { principal });
  assert.equal(imported.length, 1);
  assert.equal(imported[0].capabilityId, 'ui-design.audit-accessibility');
  assert.equal(imported[0].status, undefined, 'service controls quarantine state');
  assert.equal(imported[0].sourceCoordinate, `${source.url}@${sha}#skills/ui-audit`);
  assert.deepEqual(scanned, [imported[0].providerId]);
  assert.equal(result.providers[0].status, 'quarantined');
  assert.equal(result.autoPromoted, false);
});

test('root and nested skills are isolated into separate provider subtrees', async () => {
  const imported=[];
  const service={
    importProvider:async(provider)=>{imported.push(provider);return{...provider,status:'quarantined'};},
    scanProvider:async(providerId)=>({provider:{providerId,status:'quarantined'},scanReceipt:{status:'pass'}}),
  };
  const rootSkill='---\nname: root-skill\ndescription: Use for root workflow\ncapability-id: ui-design.audit-accessibility\n---\n# Root';
  const childSkill='---\nname: child-skill\ndescription: Use for child workflow\ncapability-id: ui-design.audit-accessibility\n---\n# Child';
  const snapshot={source,revision:sha,files:[
    {path:'SKILL.md',content:rootSkill},
    {path:'references/root.md',content:'# Root reference'},
    {path:'skills/child/SKILL.md',content:childSkill},
    {path:'skills/child/references/child.md',content:'# Child reference'},
  ]};
  const synchronizer=new FederationSynchronizer({service,sourcesLoader:async()=>[source],capabilityLoader:async()=>[{capabilityId:'ui-design.audit-accessibility',title:'Audit accessibility',domain:'ui-design',intentSignals:['audit'],knowledgeTopics:['accessibility'],requiredTools:[]}],fetchers:{'agent-skills-repository':{fetch:async()=>snapshot}}});
  const principal=createPrincipal({id:'admin',type:'human',roles:['federation-admin'],scopes:['tenant:tenant-a'],trustDomain:'issuer/tenant-a'});
  await synchronizer.sync(source.id,{tenantId:'tenant-a'},{principal});
  const rootProvider=imported.find((item)=>item.originalProviderId==='community-skills.root-skill'||item.providerId==='community-skills.root-skill');
  const childProvider=imported.find((item)=>item.originalProviderId==='community-skills.child-skill'||item.providerId==='community-skills.child-skill');
  assert.ok(rootProvider&&childProvider);
  assert.deepEqual(rootProvider.material.files.map((file)=>file.path),['SKILL.md','references/root.md']);
  assert.deepEqual(childProvider.material.files.map((file)=>file.path),['skills/child/SKILL.md','skills/child/references/child.md']);
});
