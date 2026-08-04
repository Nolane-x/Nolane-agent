import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const RULES = Object.freeze([
  Object.freeze({ class: 'provider-rate-limit', retryable: true, pattern: /\b429\b|rate[ -]?limit|quota exceeded|too many requests/i }),
  Object.freeze({ class: 'provider-timeout', retryable: true, pattern: /timed? out|timeout|deadline exceeded|ETIMEDOUT/i }),
  Object.freeze({ class: 'provider-overloaded', retryable: true, pattern: /\b503\b|overload|temporar(?:y|ily) unavailable|try again later|capacity/i }),
  Object.freeze({ class: 'context-overflow', retryable: false, pattern: /context (?:length|window)|maximum context|too many tokens|token limit|prompt too long/i }),
  Object.freeze({ class: 'malformed-tool-call', retryable: true, pattern: /malformed.*tool|tool call.*(?:invalid|json|arguments)|invalid json|arguments.*schema/i }),
  Object.freeze({ class: 'unavailable-tool', retryable: false, pattern: /unavailable forge tool|unknown tool|tool.*not (?:available|offered)|unsupported tool/i }),
  Object.freeze({ class: 'sandbox-denied', retryable: false, pattern: /sandbox.*(?:denied|blocked|boundary)|SANDBOX_POLICY_DENIED|outside allowed path|capability.*denied/i }),
  Object.freeze({ class: 'patch-conflict', retryable: true, pattern: /PATCH_CONFLICT|patch.*conflict|expected sha256.*(?:mismatch|does not match)|stale patch|hunk.*failed/i }),
  Object.freeze({ class: 'test-regression', retryable: true, pattern: /test regression|verification failed|tests? failed after|regression detected/i }),
  Object.freeze({ class: 'loop-no-progress', retryable: false, pattern: /no progress|duplicate action limit|stagnant|loop detected|repeated action/i }),
]);

function bounded(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

export function classifyHarnessFailure(error, context = {}) {
  const message = String(error?.message ?? error ?? '');
  const code = bounded(error?.code ?? '', 80);
  const matched = RULES.find((rule) => rule.pattern.test(`${code} ${message}`)) ?? Object.freeze({ class: 'unknown', retryable: false });
  const semantic = {
    schema: 'forge.harness-failure-classification.v1',
    class: matched.class,
    retryable: matched.retryable,
    codeClass: /^HTTP_?\d+$/i.test(code) ? code.toUpperCase().replace('_', '-') : (code ? code.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40) : null),
    providerId: bounded(context.providerId ?? 'unknown'),
    profileId: bounded(context.profileId ?? 'unknown'),
  };
  return Object.freeze({ class: matched.class, retryable: matched.retryable, fingerprint: canonicalSha256(semantic) });
}
