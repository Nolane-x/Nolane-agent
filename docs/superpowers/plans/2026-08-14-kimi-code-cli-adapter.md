# Kimi Code CLI Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a documented, non-interactive Kimi Code CLI provider that Nolane can detect, invoke safely in its existing CLI boundary, and expose as a selectable model-capable provider.

**Architecture:** Extend the static built-in provider definition list and the application's provider-sandbox/auth-adapter wiring; the existing `CliProvider` owns executable detection, argument construction, redaction, timeout, and public capability metadata. Kimi receives a single prompt through its documented `--prompt` mode and emits `stream-json`; model selection is forwarded with `--model`, while discovery remains explicitly unsupported because Kimi documents aliases from local configuration rather than a non-interactive model-list command. The adapter is intentionally excluded from governed routing until a verifiable safe plan configuration is supplied; its documented `kimi login` device-code flow is exposed without collecting a token.

**Tech Stack:** Node.js ESM, `node:test`, existing Nolane provider registry.

## Global Constraints

- Do not install, execute, authenticate, or store credentials for Kimi Code.
- Preserve the existing read-only/no-auto-approval policy for adapter tests; no `--yolo` or `--auto` flag belongs in Nolane's default invocation.
- Do not claim live model discovery when Kimi exposes no documented model-list command.
- Do not package or smoke-test Electron locally.
- Update evidence freshness after source and test changes; no requirement status may be promoted without external evidence.

---

### Task 1: Prove the intended public contract

**Files:**
- Modify: `tests/provider-registry.test.mjs:176-179`
- Modify: `tests/provider-registry-contracts.test.mjs` (if this contract suite contains the static adapter safety table)

**Interfaces:**
- Consumes: `createBuiltInCliProviders(): CliProvider[]` from `src/providers/provider-registry.mjs`.
- Produces: Assertions that the `kimi-code` provider has the exact executable and documented one-shot invocation contract.

- [x] **Step 1: Write the failing registry test**

```js
const kimi = createBuiltInCliProviders().find((provider) => provider.id === 'kimi-code');
assert.ok(kimi);
assert.equal(kimi.executable, 'kimi');
assert.deepEqual(kimi.baseArgs, ['--output-format', 'stream-json']);
assert.equal(kimi.promptMode, 'arg');
assert.equal(kimi.promptFlag, '--prompt');
assert.equal(kimi.modelFlag, '--model');
assert.equal(kimi.publicView().modelDiscovery.supported, false);
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/provider-registry.test.mjs`

Expected: FAIL because `kimi-code` does not yet exist.

- [x] **Step 3: Add any safety-table assertion**

```js
assert.ok(!kimi.baseArgs.includes('--yolo'));
assert.ok(!kimi.baseArgs.includes('--auto'));
```

- [x] **Step 4: Run the focused test again**

Run: `node --test tests/provider-registry.test.mjs`

Expected: still FAIL only on the missing provider definition.

### Task 2: Add the minimal documented adapter

**Files:**
- Modify: `src/providers/provider-registry.mjs:155-181`
- Modify: `src/app.mjs:401-490`
- Modify: `tests/provider-registry.test.mjs:176-179`

**Interfaces:**
- Consumes: the `CliProvider` constructor fields `executable`, `baseArgs`, `promptMode`, `promptFlag`, `modelFlag`, `modelSelection`, and `profile`.
- Produces: a provider whose call shape is `kimi --output-format stream-json --model <optional> --prompt <text>`, a dedicated data-directory sandbox, and a device-code login launcher.

- [x] **Step 1: Add the exact provider definition**

```js
{ id: 'kimi-code', label: 'Kimi Code CLI', executable: 'kimi', harnessFamily: 'kimi-code-cli', baseArgs: ['--output-format', 'stream-json'], promptMode: 'arg', promptFlag: '--prompt', modelFlag: '--model', executionSafety: 'external-plan-config-required', profile: { capabilities: ['coding', 'structured-output', 'subscription-auth', 'long-context'], qualityTier: 4, costTier: 0, latencyTier: 2 } },
```

- [x] **Step 2: Add the sandbox and OAuth device-code launcher**

```js
for (const id of [/* existing ids */, 'kimi-code']) { /* create sandbox */ }
'kimi-code': createAvailabilityOnlyCliAuthAdapter({ executable: 'kimi', statusArgs: ['--version'], loginArgs: { device: ['login'] }, cwd: path.join(providerSandboxRoot, 'kimi-code') }),
```

- [x] **Step 3: Extend the built-in ID expectation**

```js
assert.deepEqual([...builtIns].map((item) => item.id), [/* existing ordered ids */, 'kimi-code']);
```

- [x] **Step 4: Run the focused contract test**

Run: `node --test tests/provider-registry.test.mjs`

Expected: PASS with Kimi model discovery reported as unsupported and no automatic approval flag.

### Task 3: Refresh project evidence without overstating runtime proof

**Files:**
- Generated: `requirements/master-acceptance-ledger.json`
- Generated: `requirements/runtime-purity-summary.json`
- Modify only if generator requires it: `docs/MASTER-ACCEPTANCE-LEDGER.md`

**Interfaces:**
- Consumes: source and test manifests through `npm run program:nolane`.
- Produces: a ledger whose freshness hashes match the new provider source and test files while retaining all external gate status.

- [x] **Step 1: Run required focused verification**

Run: `node --test tests/provider-registry.test.mjs`

Expected: PASS.

- [x] **Step 2: Regenerate evidence**

Run: `npm run program:nolane`

Expected: exit code 0 and a refreshed ledger; it must not change external-gate requirements to verified.

- [x] **Step 3: Check evidence integrity**

Run: `npm run audit:evidence-freshness`

Expected: exit code 0.

Run: `npm run audit:evidence-quality`

Expected: exit code 0.

- [x] **Step 4: Inspect the intended diff and commit**

```bash
git diff --check
git add src/providers/provider-registry.mjs tests/provider-registry.test.mjs requirements/master-acceptance-ledger.json requirements/runtime-purity-summary.json docs/MASTER-ACCEPTANCE-LEDGER.md docs/superpowers/plans/2026-08-14-kimi-code-cli-adapter.md
git commit -m "feat(providers): add Kimi Code CLI adapter"
```

## Self-Review

- Spec coverage: Tasks 1–2 cover detection/invocation/model selection; Task 3 covers evidence freshness. Live model listing, login, and real provider dogfood remain intentionally out of scope because no official non-interactive listing command or dedicated test credential is available.
- Placeholder scan: No task uses TBD/TODO or a generic testing instruction.
- Type consistency: The definition fields and expected `CliProvider` public view fields match the current constructor contract.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-kimi-code-cli-adapter.md`. The user has already authorized inline autonomous execution; execute Tasks 1–3 in this session with test-first checkpoints.
