import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCapabilityCatalog, validateCapabilityCatalog, searchCapabilities, capabilityPath } from '../src/federation/capability-catalog.mjs';

test('capability catalog contains 1,024 unique typed capabilities across 32 domains', async () => {
  const catalog = await loadCapabilityCatalog();
  const report = validateCapabilityCatalog(catalog);
  assert.equal(catalog.length, 1024);
  assert.equal(report.domainCount, 32);
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  assert.equal(report.uniqueSignatures, 1024);
  assert.ok(catalog.every((item) => item.evidence.length >= 2));
  assert.ok(catalog.every((item) => item.knowledgeTopics.length >= 3));
  assert.ok(catalog.every((item) => item.preferredSourceIds.length >= 1));
});

test('every capability domain has a typed path from confirmed intent to release certification', async () => {
  const catalog = await loadCapabilityCatalog();
  for (const domain of [...new Set(catalog.map((item) => item.domain))]) {
    const path = capabilityPath(catalog, domain);
    assert.equal(path.length, 32, domain);
    assert.deepEqual(path[0].consumes, ['confirmed-intent']);
    assert.match(path.at(-1).produces[0], /release-certification$/);
    for (let i=1;i<path.length;i++) assert.equal(path[i].consumes[0], path[i-1].produces[0], `${domain}:${i}`);
  }
});

test('capability search ranks domain, title, topic, tool, and intent signals deterministically', async () => {
  const catalog = await loadCapabilityCatalog();
  const ui = searchCapabilities(catalog, 'accessible interface keyboard screen reader', { domain:'ui-design', tools:['browser'] });
  assert.ok(ui.length > 0);
  assert.equal(ui[0].domain, 'ui-design');
  assert.ok(ui[0].score >= ui.at(-1).score);
  const security = searchCapabilities(catalog, 'threat model supply chain security', { domain:'cybersecurity' });
  assert.equal(security[0].domain, 'cybersecurity');
});

test('catalog entries are capability records rather than falsely claimed vendored expert prompts', async () => {
  const catalog = await loadCapabilityCatalog();
  assert.ok(catalog.every((item) => item.deliveryModel === 'federated-resolution'));
  assert.ok(catalog.every((item) => !('body' in item)));
  assert.ok(catalog.every((item) => item.providerPolicy.minimumTrust >= 50));
});
