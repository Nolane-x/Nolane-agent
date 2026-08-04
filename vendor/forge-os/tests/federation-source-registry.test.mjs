import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFederationSources, validateSourceRegistry, getFederationSource } from '../src/federation/source-registry.mjs';

test('curated federation registry spans skills, knowledge, and MCP with official sources prioritized', async () => {
  const sources = await loadFederationSources();
  const report = validateSourceRegistry(sources);
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  assert.ok(sources.length >= 20);
  assert.ok(sources.some((s) => s.kind.includes('skill') || s.kind.includes('agent')));
  assert.ok(sources.some((s) => s.kind === 'knowledge-index'));
  assert.ok(sources.some((s) => s.kind === 'mcp-registry' && s.authority === 'official'));
  assert.ok(sources.some((s) => s.kind === 'mcp-awesome-list' && s.trust === 'discovery'));
  assert.equal(getFederationSource(sources, 'official-mcp-registry').authority, 'official');
});

test('awesome lists cannot be promoted to trusted source authority', async () => {
  const sources = await loadFederationSources();
  const awesome = sources.filter((s) => s.kind === 'mcp-awesome-list');
  assert.ok(awesome.length >= 2);
  assert.ok(awesome.every((s) => s.trust === 'discovery' && s.authority === 'community'));
});
