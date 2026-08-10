import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboardSvg } from '../scripts/render-dashboard-evidence.mjs';

test('built-in dashboard evidence renderer produces deterministic self-contained SVG', () => {
  const svg = renderDashboardSvg({
    id: 'forge_demo', name: 'Demo <Project>', stage: 'architecture', assurance: 'A2', domain: 'developer-tools', revision: 31, semanticRevision: 19,
    ideas: [{ id: 'idea-1', title: 'Trace compiler', mechanism: 'compile traces into contracts' }],
    artifacts: [{ id: 'a1', type: 'product-thesis', state: 'verified', sha256: 'a'.repeat(64), consumes: [] }],
    evidence: [{ id: 'e1', type: 'ux-evidence', status: 'pass', producer: { id: 'reviewer' }, subject: { semanticRevision: 19 } }],
    findings: [{ id: 'f1', title: 'Privacy policy', severity: 'medium', status: 'open' }],
    routes: [{ routes: [{ name: 'choosing-system-architecture', score: 117.05, produces: ['architecture-decision'] }] }],
    gates: [],
  });
  assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /Demo &lt;Project&gt;/);
  assert.match(svg, /architecture/);
  assert.match(svg, /choosing-system-architecture/);
  assert.doesNotMatch(svg, /<script/i);
  assert.doesNotMatch(svg, /(?:href|src)="https?:\/\//i);
});
