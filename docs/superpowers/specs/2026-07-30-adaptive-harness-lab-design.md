# Forge Studio 2.18.0 Adaptive Harness Lab Design

## Decision

Build **Adaptive Harness Lab** as the next evidence-driven release. The release gives each provider family a distinct, versioned harness and adds a governed failure-replay and promotion loop. It does not attempt online self-modification, process-tree accounting, browser journey verification, or hosted provider execution in the same release.

## Why this slice

Forge Studio 2.17.0 already controls provider/browser admission, repository scheduling, and mutable swarm execution. The remaining competitive gap with Cursor, Claude Code, Copilot, and Devin is that different models still receive nearly the same context contract, tool descriptions, retry behavior, and patch guidance. A provider-neutral runtime is useful, but a uniform harness leaves model-specific capability unused.

Three approaches were considered:

1. **Static profile table only.** Low risk and small, but it would not prove that a candidate profile is better or prevent regressions.
2. **Governed adaptive harness lab.** Versioned profiles, deterministic request composition, privacy-bounded failure telemetry, replay comparison, explicit promotion, and rollback. This is the selected approach.
3. **Autonomous online prompt mutation.** Potentially fast adaptation, but difficult to audit, vulnerable to noisy production feedback, and unsafe without strong held-out evaluation. Rejected for 2.18.0.

## Architecture

### 1. Harness profile registry

Create `src/providers/harness-profile-registry.mjs`.

A profile is immutable and contains:

- `id`, `family`, `revision`, and `status`;
- bounded `systemDirectives`;
- `contextStrategy`;
- `toolStrategy`;
- `patchStrategy`;
- `retryPolicy`;
- `errorRendering`;
- `maxToolSchemas` and `maxDirectiveChars`;
- a canonical SHA-256.

Built-in profiles:

- `codex-cli-v1`;
- `claude-code-v1`;
- `gemini-cli-v1`;
- `openai-api-v1`;
- `anthropic-api-v1`;
- `gemini-api-v1`;
- `generic-local-v1`.

Provider definitions declare a `harnessFamily`. The registry resolves the active profile by provider ID and family, supports candidate registration, explicit promotion after a passing replay report, and rollback to the previous revision. Promotion never happens solely because a candidate exists.

### 2. Deterministic request composer

Create `src/providers/harness-request-composer.mjs`.

The composer accepts base messages, tool schemas, task metadata, provider metadata, and the latest classified failure. It returns:

- composed messages;
- bounded and reordered tool schemas;
- retry guidance for the current failure category;
- `harnessProfileId`, `harnessRevision`, and `harnessReceiptSha256`.

The composer may add public execution guidance, but it must not store or expose hidden chain-of-thought. Tool descriptions remain truthful and preserve original JSON schemas. The composer may append concise provider-specific usage notes, reorder tools, and limit the number of loaded schemas.

### 3. Failure classification and telemetry

Create:

- `src/providers/harness-failure-classifier.mjs`;
- `src/providers/harness-failure-store.mjs`.

Classify failures into a bounded taxonomy:

- `provider-timeout`;
- `provider-rate-limit`;
- `provider-overloaded`;
- `context-overflow`;
- `malformed-tool-call`;
- `unavailable-tool`;
- `sandbox-denied`;
- `patch-conflict`;
- `test-regression`;
- `loop-no-progress`;
- `unknown`.

Telemetry stores hashes and bounded metadata only: provider ID, profile ID/revision, task kind, failure class, retryability, timestamp, mission/task IDs, and evidence receipt. It must not persist raw prompts, model output, secrets, environment variables, or chain-of-thought.

### 4. Replay and promotion service

Create `src/providers/harness-experiment-service.mjs`.

The service evaluates a baseline and candidate profile against the same suite and executor. It computes:

- pass rate;
- critical regression count;
- tool calls;
- retries;
- estimated tokens;
- elapsed time;
- deterministic report SHA-256.

A candidate is promotable only when:

- at least 4 cases were evaluated;
- candidate pass rate is not lower than baseline;
- candidate has no new critical regression;
- candidate weighted score improves by at least the configured threshold;
- report identity matches provider family and candidate hash.

Promotion requires an explicit caller action and records a promotion receipt. Rollback restores the prior active revision and records a rollback receipt.

### 5. Agent-loop integration

`AgentLoop` resolves and composes the harness immediately before each provider request. The current profile identity is emitted in model-requested events and returned in run metadata. On provider failure, the failure classifier and store record the bounded event; a retry is composed with category-specific guidance.

The existing provider runtime lease remains outside the composer. The composer does not bypass capability policy, tool authorization, workspace trust, verification, or budgets.

### 6. Runtime and release integration

`src/app.mjs` constructs one registry, composer, failure store, and experiment service. Runtime status exposes aggregate profile identity and failure counts, not raw prompts.

Add:

- focused unit tests;
- app-wiring test;
- synthetic measurement script;
- release verifier;
- required Full Release Matrix gate `adaptive-harness-lab`;
- 2.18.0 release, limitation, verification, weakness, audit, and remaining-gap documents.

## Error handling

- Invalid or oversized profiles fail closed at registration.
- Unknown provider families resolve to `generic-local-v1`.
- Composer output is immutable.
- Telemetry write failure cannot silently alter the model request; it is surfaced as an event and the run continues only when policy permits.
- Replay timeout or executor error marks the case failed and prevents promotion.
- A stale replay report cannot promote a profile whose content hash changed.
- Rollback fails if there is no previous promoted revision.

## Test strategy

Use red-green-refactor for each component.

Required behavioral proof:

1. Codex, Claude, Gemini, API, and generic providers resolve different profile identities.
2. The same base request produces provider-specific directives while preserving task text and tool schemas.
3. Failure classification is deterministic and secret-free.
4. Telemetry rejects raw prompt/output/secret fields and aggregates by provider/profile/failure class.
5. A weaker candidate cannot be promoted.
6. A stronger candidate can be explicitly promoted and then rolled back.
7. AgentLoop emits profile identity and retries with failure-category guidance.
8. The release measurement proves at least three distinct harness compositions, one rejected candidate, one promoted candidate, one rollback, and one classified retry.
9. Full Release Matrix passes from a clean commit.

## Non-claims

Forge Studio 2.18.0 does not claim:

- that built-in profiles are globally optimal for every model version;
- that synthetic replay equals production quality;
- autonomous self-improvement without explicit promotion;
- provider process persistence or process-tree resource attribution;
- complete browser journey verification;
- full polyglot semantic parity;
- Windows, macOS, hosted CI, marketplace, or cloud production certification from Linux source tests.
