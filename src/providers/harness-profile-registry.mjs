import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const CONTEXT_STRATEGIES = new Set(['evidence-first', 'plan-then-act', 'broad-then-focus', 'compact-local']);
const TOOL_STRATEGIES = new Set(['patch-first', 'read-first', 'native-balanced', 'concise']);
const PATCH_STRATEGIES = new Set(['patch-set-first', 'small-patch-first', 'write-if-new', 'native-edit']);
const BACKOFF = new Set(['bounded-exponential', 'fixed', 'provider-native']);
const ERROR_RENDERING = new Set(['classified-actionable', 'concise-constraint', 'structured-recovery']);
const STATUS = new Set(['active', 'candidate', 'retired']);
const SHA256 = /^[a-f0-9]{64}$/i;
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{2,79}$/;
const FAMILY_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/;

function text(value, label, max = 240) {
  const output = String(value ?? '').trim();
  if (!output || output.length > max) throw new TypeError(`${label} is invalid`);
  return output;
}

function integer(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be an integer between ${min} and ${max}`);
  return number;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function validateProfile(input) {
  if (!input || typeof input !== 'object') throw new TypeError('profile is required');
  const id = text(input.id, 'profile id', 80);
  const family = text(input.family, 'profile family', 64);
  if (!PROFILE_ID.test(id)) throw new TypeError('profile id is invalid');
  if (!FAMILY_ID.test(family)) throw new TypeError('profile family is invalid');
  const revision = integer(input.revision, 'revision', 1, 1_000_000);
  const status = String(input.status ?? 'candidate');
  if (!STATUS.has(status)) throw new TypeError('status is invalid');
  const systemDirectives = [...(input.systemDirectives ?? [])].map((item, index) => text(item, `directive ${index + 1}`, 2000));
  if (!systemDirectives.length || systemDirectives.length > 16) throw new TypeError('system directives must contain between 1 and 16 directives');
  const maxDirectiveChars = integer(input.maxDirectiveChars ?? 1600, 'maxDirectiveChars', 200, 8000);
  if (systemDirectives.join('\n').length > maxDirectiveChars) throw new TypeError('profile directive content exceeds maxDirectiveChars');
  const contextStrategy = String(input.contextStrategy ?? 'evidence-first');
  if (!CONTEXT_STRATEGIES.has(contextStrategy)) throw new TypeError('contextStrategy is invalid');
  const toolStrategy = String(input.toolStrategy ?? 'native-balanced');
  if (!TOOL_STRATEGIES.has(toolStrategy)) throw new TypeError('toolStrategy is invalid');
  const patchStrategy = String(input.patchStrategy ?? 'small-patch-first');
  if (!PATCH_STRATEGIES.has(patchStrategy)) throw new TypeError('patchStrategy is invalid');
  const retryPolicy = {
    maxRetries: integer(input.retryPolicy?.maxRetries ?? 2, 'retryPolicy.maxRetries', 0, 8),
    backoff: String(input.retryPolicy?.backoff ?? 'bounded-exponential'),
  };
  if (!BACKOFF.has(retryPolicy.backoff)) throw new TypeError('retryPolicy.backoff is invalid');
  const errorRendering = String(input.errorRendering ?? 'classified-actionable');
  if (!ERROR_RENDERING.has(errorRendering)) throw new TypeError('errorRendering is invalid');
  const maxToolSchemas = integer(input.maxToolSchemas ?? 48, 'maxToolSchemas', 1, 64);
  const semantic = {
    schema: 'forge.harness-profile.v1',
    id,
    family,
    revision,
    status,
    systemDirectives,
    contextStrategy,
    toolStrategy,
    patchStrategy,
    retryPolicy,
    errorRendering,
    maxToolSchemas,
    maxDirectiveChars,
  };
  return deepFreeze({ ...semantic, profileSha256: canonicalSha256(semantic) });
}

function profile(input) {
  return validateProfile(input);
}

export function createBuiltInHarnessProfiles() {
  return Object.freeze([
    profile({ id: 'codex-cli-v1', family: 'codex-cli', revision: 1, status: 'active', systemDirectives: ['Use the Forge action contract exactly and keep tool arguments machine-valid.', 'Read targeted evidence first, then prefer one bounded patch set and independent verification.'], contextStrategy: 'evidence-first', toolStrategy: 'patch-first', patchStrategy: 'patch-set-first', retryPolicy: { maxRetries: 2, backoff: 'provider-native' }, errorRendering: 'structured-recovery', maxToolSchemas: 48, maxDirectiveChars: 1600 }),
    profile({ id: 'claude-code-v1', family: 'claude-code', revision: 1, status: 'active', systemDirectives: ['Form a short explicit plan from repository evidence before modifying code.', 'Use small reversible edits, inspect diagnostics after each change, and challenge the current hypothesis when evidence disagrees.'], contextStrategy: 'plan-then-act', toolStrategy: 'read-first', patchStrategy: 'small-patch-first', retryPolicy: { maxRetries: 2, backoff: 'bounded-exponential' }, errorRendering: 'classified-actionable', maxToolSchemas: 56, maxDirectiveChars: 1800 }),
    profile({ id: 'gemini-cli-v1', family: 'gemini-cli', revision: 1, status: 'active', systemDirectives: ['Use broad repository context only to identify the smallest relevant change boundary.', 'Return concise structured actions and avoid repeating unchanged context.'], contextStrategy: 'broad-then-focus', toolStrategy: 'concise', patchStrategy: 'small-patch-first', retryPolicy: { maxRetries: 2, backoff: 'bounded-exponential' }, errorRendering: 'concise-constraint', maxToolSchemas: 44, maxDirectiveChars: 1400 }),
    profile({ id: 'openai-api-v1', family: 'openai-api', revision: 1, status: 'active', systemDirectives: ['Use native structured tool calls with exact JSON arguments.', 'Prefer evidence-first patches and stop only when independent verification can begin.'], contextStrategy: 'evidence-first', toolStrategy: 'native-balanced', patchStrategy: 'patch-set-first', retryPolicy: { maxRetries: 2, backoff: 'bounded-exponential' }, errorRendering: 'structured-recovery', maxToolSchemas: 64, maxDirectiveChars: 1400 }),
    profile({ id: 'anthropic-api-v1', family: 'anthropic-api', revision: 1, status: 'active', systemDirectives: ['Inspect the highest-value evidence, maintain a falsifiable debugging hypothesis, and use native tool calls.', 'Prefer small reversible patches and verify after each coherent change.'], contextStrategy: 'plan-then-act', toolStrategy: 'read-first', patchStrategy: 'small-patch-first', retryPolicy: { maxRetries: 2, backoff: 'bounded-exponential' }, errorRendering: 'classified-actionable', maxToolSchemas: 64, maxDirectiveChars: 1600 }),
    profile({ id: 'gemini-api-v1', family: 'gemini-api', revision: 1, status: 'active', systemDirectives: ['Use native function calls and compress repeated repository context.', 'Search broadly once, focus the change boundary, and keep edits bounded.'], contextStrategy: 'broad-then-focus', toolStrategy: 'native-balanced', patchStrategy: 'small-patch-first', retryPolicy: { maxRetries: 2, backoff: 'bounded-exponential' }, errorRendering: 'concise-constraint', maxToolSchemas: 56, maxDirectiveChars: 1400 }),
    profile({ id: 'generic-local-v1', family: 'generic-local', revision: 1, status: 'active', systemDirectives: ['Use only offered tools, inspect evidence before editing, and keep every action bounded.', 'Do not claim completion until Forge Studio verification runs.'], contextStrategy: 'compact-local', toolStrategy: 'concise', patchStrategy: 'write-if-new', retryPolicy: { maxRetries: 1, backoff: 'fixed' }, errorRendering: 'concise-constraint', maxToolSchemas: 32, maxDirectiveChars: 1200 }),
  ]);
}

export class HarnessProfileRegistry {
  #profiles = new Map();
  #activeByFamily = new Map();
  #historyByFamily = new Map();
  #eventSink;

  constructor({ profiles = createBuiltInHarnessProfiles(), eventSink = () => {} } = {}) {
    if (typeof eventSink !== 'function') throw new TypeError('eventSink must be a function');
    this.#eventSink = eventSink;
    for (const item of profiles) this.#insert(item, { builtIn: true });
    if (!this.#activeByFamily.has('generic-local')) throw new Error('generic-local active harness profile is required');
  }

  #insert(input, { builtIn = false } = {}) {
    const item = validateProfile(input);
    if (this.#profiles.has(item.id)) throw new Error(`Duplicate harness profile: ${item.id}`);
    this.#profiles.set(item.id, item);
    if (item.status === 'active') {
      if (this.#activeByFamily.has(item.family)) throw new Error(`Duplicate active harness family: ${item.family}`);
      this.#activeByFamily.set(item.family, item.id);
    }
    if (!builtIn) this.#eventSink(Object.freeze({ type: 'harness.profile.candidate-registered', profileId: item.id, family: item.family, revision: item.revision, profileSha256: item.profileSha256 }));
    return item;
  }

  resolve(provider = {}) {
    const family = String(provider?.harnessFamily ?? '').trim();
    const id = this.#activeByFamily.get(family) ?? this.#activeByFamily.get('generic-local');
    return this.#profiles.get(id);
  }

  get(id) {
    const item = this.#profiles.get(String(id));
    if (!item) throw new Error(`Unknown harness profile: ${id}`);
    return item;
  }

  registerCandidate(input) {
    const candidate = validateProfile({ ...input, status: 'candidate' });
    return this.#insert(candidate);
  }

  promote({ family, candidateId, report, actor = 'operator' } = {}) {
    const cleanFamily = text(family, 'family', 64);
    const candidate = this.get(candidateId);
    if (candidate.family !== cleanFamily) throw new Error('Candidate family does not match promotion family');
    if (candidate.status !== 'candidate') throw new Error('Only candidate profiles can be promoted');
    if (report?.promotable !== true) throw new Error('Harness candidate is not promotable');
    if (String(report.family ?? '') !== cleanFamily) throw new Error('Replay report family does not match candidate family');
    if (String(report.candidateProfileSha256 ?? '') !== candidate.profileSha256) throw new Error('Replay report candidate hash does not match current profile hash');
    if (!SHA256.test(String(report.receiptSha256 ?? ''))) throw new Error('Replay report receipt is invalid');
    const previousId = this.#activeByFamily.get(cleanFamily);
    if (!previousId) throw new Error(`No active harness profile for family: ${cleanFamily}`);
    const stack = this.#historyByFamily.get(cleanFamily) ?? [];
    stack.push(previousId);
    this.#historyByFamily.set(cleanFamily, stack);
    this.#activeByFamily.set(cleanFamily, candidate.id);
    const base = { schema: 'forge.harness-profile-promotion.v1', action: 'promote', family: cleanFamily, previousProfileId: previousId, activeProfileId: candidate.id, candidateProfileSha256: candidate.profileSha256, replayReceiptSha256: String(report.receiptSha256), actor: text(actor, 'actor', 120) };
    const receipt = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#eventSink(Object.freeze({ type: 'harness.profile.promoted', ...receipt }));
    return receipt;
  }

  rollback({ family, actor = 'operator' } = {}) {
    const cleanFamily = text(family, 'family', 64);
    const stack = this.#historyByFamily.get(cleanFamily) ?? [];
    const previousId = stack.pop();
    if (!previousId) throw new Error(`No previous harness profile to roll back for family: ${cleanFamily}`);
    const currentId = this.#activeByFamily.get(cleanFamily);
    this.#activeByFamily.set(cleanFamily, previousId);
    const base = { schema: 'forge.harness-profile-promotion.v1', action: 'rollback', family: cleanFamily, previousProfileId: currentId, activeProfileId: previousId, actor: text(actor, 'actor', 120) };
    const receipt = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#eventSink(Object.freeze({ type: 'harness.profile.rolled-back', ...receipt }));
    return receipt;
  }

  publicView() {
    return Object.freeze([...this.#profiles.values()].map((item) => Object.freeze({ id: item.id, family: item.family, revision: item.revision, status: this.#activeByFamily.get(item.family) === item.id ? 'active' : item.status, contextStrategy: item.contextStrategy, toolStrategy: item.toolStrategy, patchStrategy: item.patchStrategy, maxToolSchemas: item.maxToolSchemas, profileSha256: item.profileSha256 })));
  }
}
