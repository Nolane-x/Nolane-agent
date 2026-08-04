# Adaptive Harness Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Forge Studio 2.18.0 with provider-specific harness composition, privacy-bounded failure telemetry, replay-gated profile promotion, rollback, and release evidence.

**Architecture:** Add four focused provider-harness modules and integrate them at the single AgentLoop provider-call boundary. Preserve existing provider adapters, policy, tools, runtime leases, and verification. Prove behavior through focused tests, a synthetic measurement, and a new required release gate.

**Tech Stack:** Node.js 22 ESM, `node:test`, `node:sqlite`, canonical ForgeOS SHA-256 receipts, existing EvalRunner and Full Release Matrix.

## Global Constraints

- No raw prompts, model output, secrets, environment variables, or chain-of-thought in harness telemetry.
- No automatic promotion solely from production feedback; promotion requires a passing replay report and explicit call.
- Preserve tool JSON schemas and capability/policy enforcement.
- Unknown providers must resolve to a bounded generic profile.
- Keep `src/app.mjs` within 165 static imports and 185 constructor expressions.
- Full Release Matrix must pass from a clean commit before publication.

---

### Task 1: Immutable harness profile registry

**Files:**
- Create: `src/providers/harness-profile-registry.mjs`
- Test: `tests/harness-profile-registry.test.mjs`

**Interfaces:**
- Produces: `createBuiltInHarnessProfiles()`, `HarnessProfileRegistry`, `registry.resolve(provider)`, `registry.registerCandidate(profile)`, `registry.promote(input)`, `registry.rollback(input)`, `registry.publicView()`.

- [ ] **Step 1: Write failing profile resolution and immutability tests**

```js
const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() });
assert.equal(registry.resolve({ id: 'codex', harnessFamily: 'codex-cli' }).id, 'codex-cli-v1');
assert.equal(registry.resolve({ id: 'unknown', harnessFamily: 'unknown' }).id, 'generic-local-v1');
assert.throws(() => { registry.resolve({ id: 'codex', harnessFamily: 'codex-cli' }).revision = 9; }, TypeError);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/harness-profile-registry.test.mjs`
Expected: module-not-found failure for `harness-profile-registry.mjs`.

- [ ] **Step 3: Implement schema validation, built-ins, hashes, resolution, candidate registration, promotion, and rollback**

Profile validation must bound directive count/length, allow only documented strategies, compute `profileSha256`, and freeze nested values. Promotion must verify report candidate hash/family/status and save prior active ID for rollback.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/harness-profile-registry.test.mjs`
Expected: all profile tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/providers/harness-profile-registry.mjs tests/harness-profile-registry.test.mjs
git commit -m "feat: add governed harness profile registry"
```

### Task 2: Deterministic provider-specific request composition

**Files:**
- Create: `src/providers/harness-request-composer.mjs`
- Modify: `src/providers/provider-registry.mjs`
- Modify: `src/providers/provider-connection-service.mjs`
- Test: `tests/harness-request-composer.test.mjs`
- Test: `tests/provider-registry.test.mjs`

**Interfaces:**
- Consumes: `HarnessProfileRegistry.resolve(provider)`.
- Produces: `HarnessRequestComposer.compose({ provider, messages, tools, task, failure })` returning `{ messages, tools, profileId, profileRevision, profileSha256, receiptSha256 }`.

- [ ] **Step 1: Write failing composition tests**

```js
const codex = composer.compose({ provider: { id: 'codex', harnessFamily: 'codex-cli' }, messages, tools, task });
const claude = composer.compose({ provider: { id: 'claude', harnessFamily: 'claude-code' }, messages, tools, task });
assert.notEqual(codex.profileId, claude.profileId);
assert.notEqual(codex.messages[0].content, claude.messages[0].content);
assert.deepEqual(codex.tools[0].function.parameters, tools[0].function.parameters);
assert.match(codex.receiptSha256, /^[a-f0-9]{64}$/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/harness-request-composer.test.mjs tests/provider-registry.test.mjs`
Expected: composer module missing or provider public view lacking `harnessFamily`.

- [ ] **Step 3: Implement composer and add `harnessFamily` to provider metadata**

Append bounded public directives to the first system message, preserve original messages, preserve parameter schemas, reorder patch/read/search tools per profile, cap loaded schemas, and add failure-category retry guidance. Add built-in CLI harness families and preserve custom-provider compatibility.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/harness-request-composer.test.mjs tests/provider-registry.test.mjs tests/provider-connections.test.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/providers/harness-request-composer.mjs src/providers/provider-registry.mjs src/providers/provider-connection-service.mjs tests/harness-request-composer.test.mjs tests/provider-registry.test.mjs
git commit -m "feat: compose model-specific harness requests"
```

### Task 3: Failure taxonomy and privacy-bounded telemetry

**Files:**
- Create: `src/providers/harness-failure-classifier.mjs`
- Create: `src/providers/harness-failure-store.mjs`
- Test: `tests/harness-failure-classifier.test.mjs`
- Test: `tests/harness-failure-store.test.mjs`

**Interfaces:**
- Produces: `classifyHarnessFailure(error, context)` returning `{ class, retryable, fingerprint }`.
- Produces: `HarnessFailureStore.record(input)`, `.summary(filters)`, `.clusters(filters)`, `.close()`.

- [ ] **Step 1: Write failing classifier and store tests**

```js
assert.equal(classifyHarnessFailure(new Error('429 rate limit')).class, 'provider-rate-limit');
assert.equal(classifyHarnessFailure(new Error('context length exceeded')).class, 'context-overflow');
assert.throws(() => store.record({ providerId: 'codex', rawPrompt: 'secret' }), /unsupported telemetry field/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/harness-failure-classifier.test.mjs tests/harness-failure-store.test.mjs`
Expected: modules missing.

- [ ] **Step 3: Implement deterministic classification and SQLite storage**

Use allowlisted input keys only. Store bounded IDs, task kind, class, retryable integer, fingerprint, timestamp, and evidence SHA-256. Add indexes for provider/profile/class lookup. Never serialize unknown input fields.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/harness-failure-classifier.test.mjs tests/harness-failure-store.test.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/providers/harness-failure-classifier.mjs src/providers/harness-failure-store.mjs tests/harness-failure-classifier.test.mjs tests/harness-failure-store.test.mjs
git commit -m "feat: classify and store bounded harness failures"
```

### Task 4: Replay comparison, promotion gate, and rollback

**Files:**
- Create: `src/providers/harness-experiment-service.mjs`
- Test: `tests/harness-experiment-service.test.mjs`

**Interfaces:**
- Consumes: `EvalRunner`, baseline/candidate profiles, executor.
- Produces: `HarnessExperimentService.compare(input)` and immutable report with `status`, profile hashes, metrics, failures, and `receiptSha256`.

- [ ] **Step 1: Write failing replay and promotion tests**

```js
const rejected = await experiments.compare({ family: 'codex-cli', baseline, candidate: weak, suite, executor });
assert.equal(rejected.promotable, false);
assert.throws(() => registry.promote({ family: 'codex-cli', candidateId: weak.id, report: rejected }), /not promotable/);
const accepted = await experiments.compare({ family: 'codex-cli', baseline, candidate: strong, suite, executor });
assert.equal(accepted.promotable, true);
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/harness-experiment-service.test.mjs`
Expected: experiment service missing.

- [ ] **Step 3: Implement dual-profile replay and weighted decision**

Evaluate every case under both profiles, require at least four cases, reject lower pass rate or any new critical failure, calculate weighted score from pass rate/tool calls/retries/tokens/elapsed time, and hash the semantic report without nondeterministic elapsed fields.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `node --test tests/harness-experiment-service.test.mjs tests/harness-profile-registry.test.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/providers/harness-experiment-service.mjs tests/harness-experiment-service.test.mjs tests/harness-profile-registry.test.mjs
git commit -m "feat: gate harness promotion with replay evidence"
```

### Task 5: AgentLoop and application wiring

**Files:**
- Modify: `src/agent/agent-loop.mjs`
- Modify: `src/app.mjs`
- Test: `tests/agent-loop-harness.test.mjs`
- Test: `tests/adaptive-harness-lab-app-wiring.test.mjs`

**Interfaces:**
- Consumes: composer, classifier, failure store.
- AgentLoop constructor adds optional `harnessComposer`, `harnessFailureStore`, and `harnessFailureClassifier` dependencies.

- [ ] **Step 1: Write failing AgentLoop integration tests**

```js
assert.equal(provider.requests[0].messages[0].content.includes('codex'), true);
assert.equal(events.find((event) => event.type === 'agent.model.requested').payload.harnessProfileId, 'codex-cli-v1');
assert.equal(failureStore.summary({ providerId: 'codex' }).total, 1);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/agent-loop-harness.test.mjs tests/adaptive-harness-lab-app-wiring.test.mjs`
Expected: missing constructor/wiring behavior.

- [ ] **Step 3: Integrate composition immediately before `provider.complete()`**

Compose every attempt using the current provider and latest classified failure. Emit only profile IDs/revision/hash and receipt. Record classified failures before retry or provider fallback. Keep existing retry limits and capability policy unchanged.

- [ ] **Step 4: Run focused and regression tests**

Run: `node --test tests/agent-loop-harness.test.mjs tests/agent-loop.test.mjs tests/adaptive-harness-lab-app-wiring.test.mjs tests/provider-runtime-pool.test.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/agent/agent-loop.mjs src/app.mjs tests/agent-loop-harness.test.mjs tests/adaptive-harness-lab-app-wiring.test.mjs
git commit -m "feat: apply adaptive harnesses in agent runtime"
```

### Task 6: Measurement, release gate, version 2.18.0, and publication evidence

**Files:**
- Create: `scripts/measure-adaptive-harness-lab.mjs`
- Create: `src/release/adaptive-harness-lab-verifier.mjs`
- Create: `scripts/verify-adaptive-harness-lab.mjs`
- Create: `tests/adaptive-harness-lab-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Modify: versioned metadata and docs from 2.17.0 to 2.18.0.

**Interfaces:**
- Produces: `docs/adaptive-harness-lab-measurement-2.18.0.json` and release receipt.

- [ ] **Step 1: Write failing release-gate tests**

```js
const report = await verifyAdaptiveHarnessLab({ rootDirectory: path.resolve('.'), version: '2.18.0', outputFile });
assert.equal(report.status, 'pass');
assert.ok(report.measurement.distinctProfiles >= 3);
assert.equal(report.measurement.rejectedCandidates, 1);
assert.equal(report.measurement.promotions, 1);
assert.equal(report.measurement.rollbacks, 1);
assert.equal(report.boundaries.autonomousOnlineMutationClaimed, false);
```

- [ ] **Step 2: Run release-gate tests and verify RED**

Run: `node --test tests/adaptive-harness-lab-release-gate.test.mjs tests/full-release-matrix.test.mjs`
Expected: verifier and matrix gate missing.

- [ ] **Step 3: Implement measurement and verifier, add required matrix gate**

Verify source patterns, focused tests, measurement receipt, unchanged audit counts, app composition budgets, and explicit non-claims.

- [ ] **Step 4: Bump all release surfaces to 2.18.0 and generate docs/artifacts**

Update release identity, package/SDK/extension/runtime versions, README links, audit copies, limitations, remaining gaps, release notes, verification report, weakness matrix, project manifest, and artifact names. Preserve 734/0/56/0 audit counts unless source checklist status truly changes.

- [ ] **Step 5: Run focused release gates**

Run: `node --test tests/adaptive-harness-lab-release-gate.test.mjs tests/full-release-matrix.test.mjs tests/version-coherence.test.mjs`
Expected: all pass.

- [ ] **Step 6: Run complete verification from a clean commit**

```bash
git add .
git commit -m "release: Forge Studio 2.18.0 adaptive harness lab"
git status --short
npm run release:matrix
```

Expected: clean status before matrix and every required gate passes.

- [ ] **Step 7: Build and checksum publication artifacts**

Run the existing release artifact builder, verify fresh source reconstruction, archive integrity, Windows package, VSIX, update payload, optional NolaneNative pack, release evidence ZIP, change-set ZIP, and SHA-256 files.
