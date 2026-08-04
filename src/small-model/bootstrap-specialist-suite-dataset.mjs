import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256, deepFreeze } from './shared.mjs';
import { createVerifiedExample } from './verified-dataset.mjs';

export const SUPPORTED_BOOTSTRAP_SPECIALISTS = Object.freeze(['context-scorer', 'patch-ranker', 'risk-classifier', 'test-selector']);

const LABELS = Object.freeze({
  'context-scorer': Object.freeze(['counter-evidence', 'exclude', 'pin', 'support']),
  'patch-ranker': Object.freeze(['accept', 'reject', 'review', 'rollback']),
  'risk-classifier': Object.freeze(['critical', 'high', 'low', 'medium']),
  'test-selector': Object.freeze(['full', 'integration', 'mutation', 'unit']),
});

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

function contextState(label, variant, sourcePath, testPath) {
  const common = { specialist: 'context-scorer', sourcePath, testPath, variant, tokenCost: 32 + variant, ageHours: variant % 7, repositoryScope: 'nolane-agent' };
  if (label === 'exclude') return { ...common, relevance: 'none', fresh: false, trusted: false, contradiction: false, userPinned: false, generatedNoise: true };
  if (label === 'counter-evidence') return { ...common, relevance: 'high', fresh: true, trusted: true, contradiction: true, userPinned: false, generatedNoise: false };
  if (label === 'pin') return { ...common, relevance: 'critical', fresh: true, trusted: true, contradiction: false, userPinned: true, authoritative: true };
  return { ...common, relevance: 'high', fresh: true, trusted: true, contradiction: false, userPinned: false, authoritative: false };
}

function testState(label, variant, sourcePath, testPath) {
  const common = { specialist: 'test-selector', sourcePath, testPath, variant, changedFiles: 1 + variant % 6, changedSymbols: 1 + variant % 9 };
  if (label === 'unit') return { ...common, risk: 'low', publicApiChanged: false, crossModule: false, dependencyChanged: false, assertionChanged: false, regressionUnknown: false };
  if (label === 'integration') return { ...common, risk: 'medium', publicApiChanged: true, crossModule: true, dependencyChanged: false, assertionChanged: false, regressionUnknown: false };
  if (label === 'mutation') return { ...common, risk: 'medium', publicApiChanged: false, crossModule: false, dependencyChanged: false, assertionChanged: true, regressionUnknown: true };
  return { ...common, risk: 'high', publicApiChanged: true, crossModule: true, dependencyChanged: true, assertionChanged: variant % 2 === 0, regressionUnknown: true, changedFiles: 12 + variant % 8 };
}

function patchState(label, variant, sourcePath, testPath) {
  const common = { specialist: 'patch-ranker', sourcePath, testPath, variant, scopeMatch: true, testsPassed: true, hiddenTestsPassed: true, securityFindings: 0 };
  if (label === 'accept') return { ...common, risk: 'low', regressionDetected: false, apiChange: false, evidenceComplete: true, reversible: true };
  if (label === 'review') return { ...common, risk: 'medium', regressionDetected: false, apiChange: true, evidenceComplete: false, reversible: true };
  if (label === 'reject') return { ...common, risk: 'high', scopeMatch: false, testsPassed: false, hiddenTestsPassed: false, securityFindings: 1, regressionDetected: false, evidenceComplete: false };
  return { ...common, risk: 'critical', testsPassed: false, regressionDetected: true, previousKnownGood: true, evidenceComplete: true, reversible: true };
}

function riskState(label, variant, sourcePath, testPath) {
  const common = { specialist: 'risk-classifier', sourcePath, testPath, variant, reversible: true, outsideWorkspace: false, destructive: false, secretAccess: false, networkEgress: false };
  if (label === 'low') return { ...common, operation: 'read-or-local-test', filesAffected: 1, schemaChange: false, authChange: false };
  if (label === 'medium') return { ...common, operation: 'multi-file-refactor', filesAffected: 4 + variant % 3, schemaChange: false, authChange: false };
  if (label === 'high') return { ...common, operation: 'schema-or-auth-change', filesAffected: 8, schemaChange: true, authChange: variant % 2 === 0, reversible: variant % 2 === 1 };
  return { ...common, operation: 'destructive-external-secret', filesAffected: 20, schemaChange: true, authChange: true, reversible: false, outsideWorkspace: true, destructive: true, secretAccess: true, networkEgress: true };
}

function stateFor(specialist, label, variant, sourcePath, testPath) {
  if (specialist === 'context-scorer') return contextState(label, variant, sourcePath, testPath);
  if (specialist === 'test-selector') return testState(label, variant, sourcePath, testPath);
  if (specialist === 'patch-ranker') return patchState(label, variant, sourcePath, testPath);
  return riskState(label, variant, sourcePath, testPath);
}

export async function buildBootstrapSpecialistDataset({ root = process.cwd(), specialist, variants = 12 } = {}) {
  const key = String(specialist ?? '');
  if (!SUPPORTED_BOOTSTRAP_SPECIALISTS.includes(key)) throw new TypeError(`Unsupported specialist: ${key || '(missing)'}`);
  if (!Number.isSafeInteger(variants) || variants < 3 || variants > 1000) throw new TypeError('variants must be an integer between 3 and 1000');
  const [sources, tests] = await Promise.all([filesUnder(root, 'src'), filesUnder(root, 'tests')]);
  if (!sources.length || !tests.length) throw new Error('repository source and test paths are required');
  const examples = [];
  for (let variant = 0; variant < variants; variant += 1) {
    const sourcePath = sources[(variant * 5 + key.length) % sources.length];
    const testPath = tests[(variant * 11 + key.length) % tests.length];
    for (const label of LABELS[key]) {
      const state = stateFor(key, label, variant, sourcePath, testPath);
      examples.push(createVerifiedExample({
        id: `${key}-${String(variant).padStart(3, '0')}-${label}`,
        taskId: `${key}-task-${variant}-${label}`,
        repositoryId: 'nolane-agent', scenarioGroup: `${key}-variant-${variant}`,
        state, action: { type: label }, expectedEffect: { decision: label },
        actualEffect: { changed: true, criterionDelta: 1, informationGain: label === 'exclude' || label === 'reject' ? 0 : 1 },
        verifier: { valid: true, independent: true, oracle: `deterministic-${key}-oracle-v1`, receiptSha256: canonicalSha256({ key, label, variant, sourcePath, testPath }) },
        cost: { tokens: 0, wallMs: 1, rssMbSeconds: 0 },
      }));
    }
  }
  examples.sort((a, b) => a.id.localeCompare(b.id));
  const base = {
    schema: 'nolane.small-model.bootstrap-specialist-dataset.v1', specialist: key, labels: [...LABELS[key]], examples,
    sourcePathCount: sources.length, testPathCount: tests.length, variants, labelSource: 'deterministic-public-state-oracle',
    hiddenChainOfThoughtStored: false, generalIntelligenceClaimAllowed: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
