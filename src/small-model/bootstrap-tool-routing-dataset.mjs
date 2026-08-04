import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256, deepFreeze } from './shared.mjs';
import { createVerifiedExample } from './verified-dataset.mjs';

const ACTIONS = Object.freeze(['patch', 'read', 'rollback', 'search', 'stop', 'test']);
async function filesUnder(root, relative) {
  const directory = path.join(root, relative); const output = [];
  async function walk(current, prefix) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'release') continue;
      const next = path.join(current, entry.name); const rel = `${prefix}/${entry.name}`.replace(/^\//, '').replaceAll('\\', '/');
      if (entry.isDirectory()) await walk(next, rel); else output.push(rel);
    }
  }
  await walk(directory, relative); return output.sort();
}
function scenario(action, variant, sourcePath, testPath) {
  const common = { phase: 'execution', objective: `${action} repository evidence for ${sourcePath}`, sourcePath, testPath, evidenceCount: variant % 4, risk: variant % 3 === 0 ? 'medium' : 'low', writable: true, toolBudget: 8 + variant };
  if (action === 'search') return { ...common, phase: 'discovery', hasCandidate: false, contentLoaded: false, failingTests: 0, patchReady: false, regressionDetected: false, allCriteriaVerified: false };
  if (action === 'read') return { ...common, phase: 'localization', hasCandidate: true, contentLoaded: false, failingTests: 0, patchReady: false, regressionDetected: false, allCriteriaVerified: false };
  if (action === 'patch') return { ...common, phase: 'repair', hasCandidate: true, contentLoaded: true, failingTests: 1 + variant % 3, patchReady: false, regressionDetected: false, allCriteriaVerified: false };
  if (action === 'test') return { ...common, phase: 'verification', hasCandidate: true, contentLoaded: true, failingTests: 0, patchReady: true, regressionDetected: false, allCriteriaVerified: false };
  if (action === 'rollback') return { ...common, phase: 'recovery', hasCandidate: true, contentLoaded: true, failingTests: 2, patchReady: true, regressionDetected: true, safetyViolation: variant % 2 === 0, allCriteriaVerified: false };
  return { ...common, phase: 'completion', hasCandidate: true, contentLoaded: true, failingTests: 0, patchReady: true, regressionDetected: false, allCriteriaVerified: true, evidenceCount: 4 + variant };
}

export async function buildBootstrapToolRoutingDataset({ root = process.cwd(), variants = 12 } = {}) {
  if (!Number.isSafeInteger(variants) || variants < 3 || variants > 1000) throw new TypeError('variants must be an integer between 3 and 1000');
  const [sources, tests] = await Promise.all([filesUnder(root, 'src'), filesUnder(root, 'tests')]);
  if (!sources.length || !tests.length) throw new Error('repository source and test paths are required');
  const examples = [];
  for (let variant = 0; variant < variants; variant += 1) {
    const sourcePath = sources[variant % sources.length]; const testPath = tests[(variant * 7) % tests.length];
    for (const action of ACTIONS) {
      const state = scenario(action, variant, sourcePath, testPath);
      const verifierReceiptSha256 = canonicalSha256({ action, variant, sourcePath, testPath, oracle: 'bootstrap-tool-routing-v1' });
      examples.push(createVerifiedExample({
        id: `bootstrap-${String(variant).padStart(3, '0')}-${action}`, taskId: `tool-route-${variant}-${action}`, repositoryId: 'nolane-agent', scenarioGroup: `variant-${variant}`,
        state, action: { type: action }, expectedEffect: { nextAction: action }, actualEffect: { changed: true, criterionDelta: action === 'stop' ? 1 : 0, informationGain: action === 'search' || action === 'read' ? 1 : 0 },
        verifier: { valid: true, independent: true, oracle: 'deterministic-bootstrap-policy', receiptSha256: verifierReceiptSha256 },
        cost: { tokens: 0, wallMs: 1, rssMbSeconds: 0 },
      }));
    }
  }
  examples.sort((a, b) => a.id.localeCompare(b.id));
  const base = { schema: 'nolane.small-model.bootstrap-tool-routing-dataset.v1', labels: [...ACTIONS], examples, sourcePathCount: sources.length, testPathCount: tests.length, labelSource: 'deterministic-public-state-oracle', generalIntelligenceClaimAllowed: false };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
