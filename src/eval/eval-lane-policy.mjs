import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

export const EVAL_LANES = Object.freeze([
  'evaluator-plumbing-smoke',
  'agent-coding-benchmark',
  'independent-competitor-benchmark',
]);
const HASH = /^[a-f0-9]{64}$/i;
const TRIVIAL = /(?:process\.exit\s*\(\s*0\s*\)|\btrue\b|echo\s+(?:ok|pass)|node\s+-e\s+["']?\s*["']?$)/i;

function validHiddenVerifier(value) {
  return value && typeof value === 'object'
    && String(value.id ?? '').trim()
    && HASH.test(String(value.sha256 ?? ''))
    && value.opaque === true
    && value.visibleToExecutor === false
    && value.compositional === true
    && !TRIVIAL.test(String(value.command ?? ''));
}

export function evaluateEvalLanePolicy(suite, {
  executionMode = 'runtime',
  hiddenVerifierAvailable = false,
  independentAttestation = null,
} = {}) {
  const lane = EVAL_LANES.includes(suite?.lane) ? suite.lane : 'evaluator-plumbing-smoke';
  const failures = [];
  const nonClaimReasons = [];
  let claimScope = 'none';
  let claimEligible = false;
  const hasFixture = (suite?.cases ?? []).some((item) => Object.hasOwn(item ?? {}, 'fixtureResult'));

  if (lane === 'evaluator-plumbing-smoke') {
    nonClaimReasons.push('fixture-or-smoke-only');
  } else {
    claimScope = lane === 'agent-coding-benchmark' ? 'coding-capability' : 'comparative';
    if (executionMode === 'fixture' || executionMode === 'mock' || hasFixture) failures.push('fixture-or-mock-execution-forbidden');
    if (!HASH.test(String(suite?.repositorySnapshotSha256 ?? ''))) failures.push('repository-snapshot-sha256-required');
    if (!validHiddenVerifier(suite?.hiddenVerifier)) failures.push('opaque-compositional-hidden-verifier-required');
    if (!hiddenVerifierAvailable) failures.push('hidden-verifier-runtime-required');
    if (!failures.length) claimEligible = true;
  }

  if (lane === 'independent-competitor-benchmark') {
    const attested = independentAttestation?.verified === true
      && String(independentAttestation.operatorId ?? '').trim()
      && HASH.test(String(independentAttestation.runDigest ?? ''))
      && HASH.test(String(independentAttestation.signatureSha256 ?? ''));
    if (!attested) {
      claimEligible = false;
      nonClaimReasons.push('independent-attestation-missing');
    }
  }
  if (failures.length) claimEligible = false;
  const base = {
    schema: 'nolane.agent.eval-lane-policy.v1',
    lane,
    status: failures.length ? 'fail' : 'pass',
    claimScope,
    claimEligible,
    failures,
    nonClaimReasons,
    claims: {
      fixtureCanAuthorizeCapabilityClaim: false,
      hiddenVerifierVisibleToExecutor: false,
      trivialVerifierAccepted: false,
      selfDeclaredIndependenceAccepted: false,
    },
  };
  return Object.freeze({
    ...base,
    failures: Object.freeze(failures),
    nonClaimReasons: Object.freeze(nonClaimReasons),
    claims: Object.freeze(base.claims),
    receiptSha256: canonicalSha256(base),
  });
}
