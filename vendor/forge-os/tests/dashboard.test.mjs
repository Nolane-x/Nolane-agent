import test from 'node:test';
import assert from 'node:assert/strict';
import { renderForgeStudioHtml, escapeHtml } from '../src/ui/forge-studio.mjs';

test('escapeHtml neutralizes executable markup', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('Forge Studio renders accessible project, routes, evidence, and host bridge', () => {
  const html = renderForgeStudioHtml({ project: { id: 'p1', name: '<b>Demo</b>', stage: 'divergence', assurance: 'A2', domain: 'saas', ideas: [{ id: 'a', title: 'Idea A', thesis: 'Novel mechanism', fingerprint: 'abc' }], scores: [], gates: [{ stage: 'research', status: 'pass', score: 100 }], evidence: [{ type: 'research-source', title: 'Spec' }], artifacts: [{ id: 'x', type: 'research-synthesis', state: 'verified' }], findings: [{ title: 'Boundary risk', severity: 'high', status: 'open' }] }, routes: [{ name: 'generating-divergent-concepts', score: 91 }] });
  assert.match(html, /ForgeOS/);
  assert.match(html, /Idea A/);
  assert.doesNotMatch(html, /<b>Demo<\/b>/);
  assert.match(html, /<main/);
  assert.match(html, /aria-label="Project lifecycle"/);
  assert.match(html, /window\.openai/);
  assert.match(html, /forge_next_action/);
  assert.match(html, /generating-divergent-concepts/);
});

test('embedded state cannot terminate the script element', () => {
  const html = renderForgeStudioHtml({ project: { id: 'p', name: '</script><script>alert(1)</script>', stage: 'intent', ideas: [], scores: [], gates: [], evidence: [], artifacts: [], findings: [] } });
  assert.equal((html.match(/<script(?:\s[^>]*)?>/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
