import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilitySignature, clusterProviders } from '../src/federation/deduplicator.mjs';
import { detectProviderConflicts } from '../src/federation/conflicts.mjs';

const base = {
  capabilityId:'ui.accessibility.audit', domain:'ui-design', consumes:['ui-artifact'], produces:['accessibility-report'],
  knowledgeTopics:['wcag','keyboard navigation'], requiredTools:['browser'], conflictTags:['ui-review'],
};

test('semantic signatures ignore superficial wording but preserve different mechanisms', () => {
  const a = {...base,title:'Audit UI accessibility',intentSignals:['check keyboard and screen reader access']};
  const b = {...base,title:'Review interface for accessible usage',intentSignals:['screen-reader and keyboard accessibility check']};
  const c = {...base,capabilityId:'ui.performance.audit',title:'Audit rendering performance',knowledgeTopics:['core web vitals'],produces:['performance-report']};
  assert.equal(capabilitySignature(a), capabilitySignature(b));
  assert.notEqual(capabilitySignature(a), capabilitySignature(c));
});

test('provider clustering preserves alternatives and conflict detector surfaces incompatible ownership', () => {
  const providers = [
    {providerId:'a',capabilityId:'x',semanticKey:'same',kind:'skill',outputOwnership:['report'],toolVersions:{browser:'1'},policyTags:['strict']},
    {providerId:'b',capabilityId:'x',semanticKey:'same',kind:'skill',outputOwnership:['report'],toolVersions:{browser:'2'},policyTags:['permissive']},
    {providerId:'c',capabilityId:'y',semanticKey:'other',kind:'knowledge',outputOwnership:[],toolVersions:{},policyTags:[]},
  ];
  const clusters = clusterProviders(providers);
  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters.find((c) => c.key === 'same').providers.map((p) => p.providerId), ['a','b']);
  const conflicts = detectProviderConflicts(providers);
  assert.ok(conflicts.some((f) => f.code === 'output-ownership-conflict'));
  assert.ok(conflicts.some((f) => f.code === 'tool-version-conflict'));
  assert.ok(conflicts.some((f) => f.code === 'policy-conflict'));
});
