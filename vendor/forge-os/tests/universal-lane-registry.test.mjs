import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadUniversalLaneRegistry } from '../src/intelligence/universal-lanes.mjs';
import { loadFederationSources } from '../src/federation/source-registry.mjs';
import { TOOL_BY_NAME, callForgeTool } from '../src/server/tool-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('universal lane registry resolves every declared lane against real skills, capability domains, and source IDs', async () => {
  const registry = await loadUniversalLaneRegistry({ root });
  assert.equal(registry.lanes.length, 12);
  assert.match(registry.registrySha256, /^[a-f0-9]{64}$/);
  assert.equal(new Set(registry.lanes.map((lane) => lane.id)).size, registry.lanes.length);
  for (const lane of registry.lanes) {
    assert.ok(lane.skillIds.length > 0, `${lane.id} needs at least one real skill`);
    assert.ok(lane.capabilityDomains.length > 0, `${lane.id} needs capability coverage`);
    assert.ok(lane.externalSourceIds.length > 0, `${lane.id} needs provenance sources`);
    assert.match(lane.executionBoundary, /^(advisory-only|verified-artifact|human-approved-executor)$/);
  }
  assert.equal(registry.lanes.find((lane) => lane.id === 'hardware-and-manufacturing').executionBoundary, 'human-approved-executor');
  assert.equal(registry.lanes.find((lane) => lane.id === 'robotics-and-physical-ai').executionBoundary, 'human-approved-executor');
});

test('new UI and physical-AI upstreams remain discovery-only sources until a human approves promotion', async () => {
  const sources = await loadFederationSources({ refresh: true });
  for (const sourceId of ['vercel-agent-skills', 'nvidia-skills']) {
    const source = sources.find((item) => item.id === sourceId);
    assert.ok(source, `${sourceId} must be registered`);
    assert.equal(source.trust, 'discovery');
    assert.equal(source.revision, 'resolve-on-sync');
  }
  assert.ok(sources.find((item) => item.id === 'nvidia-skills').domains.includes('physical-ai'));
});

test('new cross-domain native skills remain candidates until independent evidence justifies stable promotion', async () => {
  const catalog = JSON.parse(await readFile(path.join(root, 'skills/catalog.json'), 'utf8'));
  const candidateIds = [
    'designing-production-visual-systems', 'validating-visual-asset-delivery',
    'designing-interactive-3d-experiences', 'testing-interactive-3d-performance',
    'engineering-manufacturable-products', 'validating-physical-product-safety',
    'designing-simulation-to-reality-workflows', 'testing-physical-ai-deployment-boundaries',
  ];
  for (const skillId of candidateIds) assert.equal(catalog.find((skill) => skill.name === skillId)?.status, 'candidate', `${skillId} must not self-promote`);
});

test('universal lanes are exposed as a truthful read-only MCP surface rather than an execution claim', async () => {
  const definition = TOOL_BY_NAME.get('forge_universal_lanes_list');
  assert.ok(definition);
  assert.equal(definition.annotations.readOnlyHint, true);
  const registry = { schemaVersion: 1, registrySha256: 'a'.repeat(64), lanes: [{ id: 'strategy-and-research' }] };
  const result = await callForgeTool('forge_universal_lanes_list', {}, null, { intelligence: { universalLanes: async () => registry } });
  assert.deepEqual(result, { registry });
});
