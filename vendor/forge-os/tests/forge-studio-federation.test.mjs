import test from 'node:test';
import assert from 'node:assert/strict';
import { renderForgeStudioHtml } from '../src/ui/forge-studio.mjs';

test('Forge Studio renders federation trust metrics and metadata-only controls without external instruction bodies',()=>{
  const html=renderForgeStudioHtml({project:{id:'forge-ui',name:'UI',stage:'intent',assurance:'A1',domain:'ui-design',revision:1,semanticRevision:1,ideas:[],artifacts:[],evidence:[],gates:[],findings:[],risks:[],routes:[]},federation:{sourceCount:25,capabilityCount:1024,providerCount:12,blockerCount:3,statusCounts:{quarantined:10,stable:2},catalogRevision:4}});
  assert.match(html,/Skill Federation/);assert.match(html,/1K Capability Graph/);assert.match(html,/1024/);assert.match(html,/forge_capabilities_search/);assert.match(html,/forge_federation_audit/);
  assert.match(html,/Provider instructions are not loaded here/);
  assert.doesNotMatch(html,/ignore all previous instructions/i);
});

test('Forge Studio carries an explicit tenant into federation audit calls',()=>{
  const html=renderForgeStudioHtml({tenantId:'tenant-a',project:{id:'forge_demo',name:'Demo',stage:'intent',assurance:'A1',domain:'all',revision:1,semanticRevision:1,ideas:[],artifacts:[],evidence:[],gates:[],findings:[],risks:[],routes:[]},projects:[]});
  assert.match(html,/tenantId:\s*forgeState\.tenantId/);
  assert.match(html,/"tenantId":"tenant-a"/);
});
