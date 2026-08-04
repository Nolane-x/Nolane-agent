import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFederationSource, normalizeCapability, normalizeProviderRecord } from '../src/federation/contracts.mjs';
import { sourceCoordinate, providerDigest, assertSafeFederationUrl } from '../src/federation/canonical-source.mjs';

test('federation contracts normalize immutable source coordinates and stable provider digests', () => {
  const source = normalizeFederationSource({
    id:'anthropic-skills', kind:'agent-skills-repository', authority:'vendor',
    url:'https://github.com/anthropics/skills', revision:'main@0123456789abcdef0123456789abcdef01234567',
    license:{spdx:'mixed', mode:'link-only'}, trust:'discovery', domains:['design','documents','engineering'],
  });
  assert.equal(sourceCoordinate(source), 'agent-skills-repository:https://github.com/anthropics/skills@main@0123456789abcdef0123456789abcdef01234567');
  const capability = normalizeCapability({
    capabilityId:'ui.accessibility.audit', title:'Audit interface accessibility', domain:'ui-design', discipline:'accessibility',
    intentSignals:['audit accessibility'], consumes:['ui-artifact'], produces:['accessibility-report'],
    evidence:['wcag-checks'], riskClass:'medium', knowledgeTopics:['WCAG'], requiredTools:['browser'],
    conflictTags:['ui-review'], preferredSourceIds:['anthropic-skills'], knowledgePackId:'knowledge-pack.ui-design', knowledgeSourceIds:['anthropic-skills'],
    mcpCapabilities:['tool.browser'], qualityDimensions:['accessibility','traceability'], dependencies:[],
    deliveryModel:'federated-resolution', phase:'audit', ordinal:0, providerPolicy:{minimumTrust:60}, contextBudget:2400,
  });
  const provider = normalizeProviderRecord({
    providerId:'provider.ui.accessibility.audit.local', capabilityId:capability.capabilityId,
    sourceId:source.id, sourceCoordinate:sourceCoordinate(source), contentDigest:'a'.repeat(64),
    kind:'skill', status:'quarantined', title:'Accessibility Audit', license:{spdx:'MIT', mode:'vendor-allowed'},
    trust:{score:70, blockers:[]}, compatibility:{agents:['codex'], tools:['browser']},
  });
  assert.match(providerDigest(provider), /^[a-f0-9]{64}$/);
  assert.equal(providerDigest(provider), providerDigest({...provider, compatibility:{tools:['browser'],agents:['codex']}}));
});

test('federation URL boundary rejects credentials, private networks, insecure schemes, and fragments', () => {
  for (const url of ['http://github.com/x/y','https://user:pass@example.com/x','https://127.0.0.1/x','https://169.254.169.254/latest','https://example.com/x#fragment']) {
    assert.throws(() => assertSafeFederationUrl(url));
  }
  assert.equal(assertSafeFederationUrl('https://github.com/anthropics/skills'), 'https://github.com/anthropics/skills');
});

test('capability and provider contracts reject weak or unpinned metadata', () => {
  assert.throws(() => normalizeFederationSource({id:'x',kind:'git',authority:'community',url:'https://github.com/x/y',license:{spdx:'MIT',mode:'vendor-allowed'},trust:'discovery',domains:['engineering']}));
  assert.throws(() => normalizeCapability({capabilityId:'x',title:'X'}));
  assert.throws(() => normalizeProviderRecord({providerId:'x',capabilityId:'y',contentDigest:'nope'}));
});
