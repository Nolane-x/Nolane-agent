import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { LocalUICertificationLab } from '../src/superiority/deep/local-ui-certification-lab.mjs';
import { ProviderDogfoodReplayLab } from '../src/superiority/deep/provider-dogfood-replay-lab.mjs';

const H = (c) => c.repeat(64);

test('local UI certification verifies accessibility, responsiveness and budgets but retains Windows external gates', () => {
  const lab = new LocalUICertificationLab();
  const result = lab.certify({
    sourceHash: H('a'),
    breakpoints: [640, 900, 1180, 1440],
    semantics: { landmarks: true, keyboardNavigation: true, focusVisible: true, liveRegions: true, reducedMotion: true, zoom200: true, labels: true },
    budgets: { maxDomNodes: 2500, maxRssBytes: 700_000_000, maxIdleCpuPercent: 3, maxLongTaskMs: 50, maxInputLatencyMs: 100 },
    metrics: { domNodes: 1200, rssBytes: 300_000_000, idleCpuPercent: 1.2, longestTaskMs: 20, inputLatencyMs: 40 },
    visualHashes: [H('b'), H('c'), H('d'), H('e')],
  });
  assert.equal(result.localAccessibilityImplemented, true);
  assert.equal(result.localResponsiveImplemented, true);
  assert.equal(result.localPerformanceBudgetsPassed, true);
  assert.equal(result.windowsCertificationRequired, true);
  assert.equal(result.assistiveTechnologyCertificationRequired, true);
  assert.throws(() => lab.certify({ sourceHash: H('f'), breakpoints: [640], semantics: {}, budgets: {}, metrics: {}, visualHashes: [] }), /breakpoints|semantics|budget/i);
});

test('dogfood replay lab rejects mocks and validates signed provider-real Windows protocol receipts', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const lab = new ProviderDogfoodReplayLab({ trustedIssuers: { auditor: publicKey.export({ type: 'spki', format: 'pem' }) } });
  const suite = lab.createSuite({ suiteId: 'dogfood-1' });
  assert.equal(suite.requiredScenarios.length, 10);
  assert.equal(suite.requiredAdversarialProbes.length, 12);
  assert.throws(() => lab.verifyReceipt('dogfood-1', { mock: true }), /mock/i);

  const payload = {
    suiteId: 'dogfood-1', issuer: 'auditor', providerReal: true, mock: false,
    machine: { os: 'win32', ramGb: 8, label: 'windows-11-8gb-real' }, credentialReferenceId: 'cred:provider:1', secretStored: false,
    scenarios: suite.requiredScenarios.map((scenarioId) => ({ scenarioId, status: 'pass', effectHash: H('1'), negativePathPassed: true, teardownPassed: true, restartPassed: true })),
    adversarial: suite.requiredAdversarialProbes.map((probeId) => ({ probeId, status: 'pass', effectHash: H('2') })),
    independentVerifier: true,
  };
  const signature = sign(null, Buffer.from(canonicalSha256(payload)), privateKey).toString('base64');
  const verified = lab.verifyReceipt('dogfood-1', { payload, signature });
  assert.equal(verified.protocolValid, true);
  assert.equal(verified.externalCertificationAccepted, true);
  assert.equal(lab.evaluate('dogfood-1').providerRealDogfoodCertified, true);
});
