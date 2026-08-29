# Ephemeral Capability Composition v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, run-local mechanism that lets an agent synthesize a bounded executable composite tool from already-authorized primitive tools without gaining authority or bypassing the existing governed execution path.

**Architecture:** Add one pure `EphemeralCapabilityRegistry` responsible for validation, normalization, binding resolution, run-local registration, and deterministic receipts. Refactor the minimum AgentLoop tool-dispatch logic into one run-local governed executor used by both top-level model tool calls and composite child steps; expose only `tool.compose.create` as the model-facing constructor.

**Tech Stack:** Node.js >=22.13, ECMAScript modules, `node:test`, existing `canonicalSha256`, existing AgentLoop/ToolBroker/gateway governance.

**Spec:** `docs/superpowers/specs/2026-08-29-ephemeral-capability-composition-v1-design.md`

## Global Constraints

- Feature is opt-in only via `task.metadata.ephemeralCapabilityComposition === true`.
- Maximum 8 primitive steps per composite and 16 composites per run.
- Maximum 32 root input parameters, 64 binding nodes, binding path depth 16, literal depth 24, normalized definition size 64 KiB, and description length 1,000.
- Composite definitions are never persisted or rehydrated from checkpoints.
- Primitive tools are ordinary currently-authorized execution tools only; `ephemeral.*`, `tool.compose.*`, and `tool.catalog.*` are never primitives.
- Every child step must traverse the same hooks, activity guard, task-contract checks, gateway/broker dispatch, evidence pipeline, receipts, and lifecycle events as an ordinary tool call.
- No arbitrary code, shell template, expression language, recursion, loops, conditions, parallelism, automatic rollback, or automatic SkillRegistry promotion.
- No claim of capability improvement until controlled benchmark evidence exists.

---

### Task 1: Pure ephemeral capability registry

**Files:**
- Create: `src/agent/ephemeral-capability-registry.mjs`
- Create: `tests/ephemeral-capability-registry.test.mjs`

**Interfaces:**
- Constructor: `new EphemeralCapabilityRegistry({ runId, taskId, maxCapabilities = 16 })`.
- `register(definition, { primitiveSchemas }) -> { name, schema, definition, receipt }`.
- `invoke(name, input, { executePrimitive, isPrimitiveActive }) -> { status, output, receipt, childReceipts }`.
- `snapshot() -> bounded diagnostic metadata only; no definitions or executable state`.

- [ ] **Step 1: Write failing validation tests** covering a successful two-step definition plus rejection of unauthorized primitive tools, meta/composite primitives, duplicate step IDs, forward references, unsafe binding paths, schema collisions, parameter-schema violations, count/size/depth limits, and registry capacity.
- [ ] **Step 2: Run `node --test tests/ephemeral-capability-registry.test.mjs`** and verify RED because the production module does not exist.
- [ ] **Step 3: Implement minimal registration/normalization** using existing `canonicalSha256`; generated names must be `ephemeral.<sanitizedName>`, definitions must be deeply frozen, and definition receipts must bind run/task/name/schema hash/definition hash/primitive names/authorization snapshot hash.
- [ ] **Step 4: Run the focused test** and verify registration/validation tests GREEN.
- [ ] **Step 5: Add failing binding/invocation tests** for `$bind` input/step traversal, literal objects, array indices, missing paths, dangerous keys, stale primitive authorization, non-pass child status, invalid/missing child receipt, deterministic aggregate receipts, and final output binding.
- [ ] **Step 6: Run focused test and verify RED for missing invocation behavior.**
- [ ] **Step 7: Implement minimal binding resolution and sequential invocation** with only an injected `executePrimitive` callback and execution-time `isPrimitiveActive` check; no broker/gateway import is allowed in this module.
- [ ] **Step 8: Run focused test and verify all Task 1 cases GREEN.**
- [ ] **Step 9: Commit** `src/agent/ephemeral-capability-registry.mjs` and `tests/ephemeral-capability-registry.test.mjs`.

### Task 2: One governed AgentLoop execution seam

**Files:**
- Modify: `src/agent/agent-loop.mjs`
- Modify: `tests/agent-loop.test.mjs` or add focused `tests/agent-loop-governed-executor.test.mjs` if isolation is materially clearer.

**Interfaces:**
- Internal run-local function: `executeGovernedTool({ name, args, callId, origin = 'model', parentCompositeId = null, childStepId = null, appendModelMessage = true })`.
- Returns the existing `{status, output, receipt}` result.
- `appendModelMessage:false` is used for composite children; events/evidence/activity/receipts still occur.

- [ ] **Step 1: Write a failing regression test** showing one ordinary `fs.read` still produces the same receipt, activity, evidence record, and lifecycle events after dispatch is routed through the new seam.
- [ ] **Step 2: Run the focused AgentLoop regression test** and establish RED only for the new seam-observable expectation, not because the fixture is broken.
- [ ] **Step 3: Extract the existing per-call governance/dispatch block** into the run-local function without changing externally visible ordinary-tool behavior.
- [ ] **Step 4: Run existing `tests/agent-loop.test.mjs` plus the focused regression test** and verify GREEN.
- [ ] **Step 5: Commit the refactor separately** so any later composite failure can be bisected from the behavior-preserving seam extraction.

### Task 3: Model-facing composition integration and attack cases

**Files:**
- Modify: `src/agent/agent-loop.mjs`
- Create: `tests/agent-loop-ephemeral-capability.test.mjs`

**Interfaces:**
- Add model meta-tool `tool.compose.create` only when `ephemeralCapabilityComposition:true`.
- On successful creation, add the generated `ephemeral.*` schema to the current run's top-level active/authorized map only.
- Keep a separate primitive schema map that never includes meta-tools or generated composite tools.
- Invoking `ephemeral.*` calls registry `invoke(...)`, whose `executePrimitive` callback re-enters `executeGovernedTool(..., appendModelMessage:false)`.

- [ ] **Step 1: Write failing opt-in tests** proving the constructor is absent by default, present only when enabled, and a successful definition becomes callable during the same run.
- [ ] **Step 2: Run focused tests and verify RED.**
- [ ] **Step 3: Wire a fresh run-local registry and `tool.compose.create`**; emit definition events and do not mutate global `DynamicToolCatalog`.
- [ ] **Step 4: Run focused tests and verify GREEN for opt-in/registration.**
- [ ] **Step 5: Write failing governed-child tests** proving a two-step composite causes normal child receipts/activity/evidence/events, while the model receives exactly one top-level tool result for the `ephemeral.*` call.
- [ ] **Step 6: Run focused tests and verify RED.**
- [ ] **Step 7: Wire composite invocation through the shared governed executor** and return one aggregate top-level result.
- [ ] **Step 8: Add attack/failure tests** for stale active authorization, hook denial, task-contract denial, primitive child failure, nested/meta primitive rejection, run-local expiration, no global catalog mutation, and deterministic aggregate receipt changes.
- [ ] **Step 9: Run focused tests and all relevant AgentLoop/governance tests** until GREEN.
- [ ] **Step 10: Commit the integration.**

### Task 4: Capability evidence gate and final verification

**Files:**
- Create: `tests/ephemeral-capability-composition-benchmark.test.mjs` or a fixture/script under the repository's existing benchmark layout.
- Update: design/plan docs only with measured evidence, never aspirational claims.

**Interfaces:**
- Controlled A/B fixture keeps task/start state/provider behavior/tool authority/token/tool-call/time budgets identical and changes only composition enabled/disabled.
- Record solve state, model turns, primitive tool calls, top-level model tool calls, unauthorized-action count, false-success count, and overhead.

- [ ] **Step 1: Add a deterministic same-provider A/B harness fixture** where a repeated multi-step workflow can be expressed either as ordinary primitive calls or one learned composite.
- [ ] **Step 2: Run the A/B fixture** and record raw metrics; do not call the feature an intelligence improvement if the evidence is neutral or negative.
- [ ] **Step 3: Run focused regression suites**: registry, AgentLoop, task-contract/tool governance, dynamic catalog, and any security tests touched by the execution seam.
- [ ] **Step 4: Open a draft PR against `main`** to trigger repository CI and preserve review evidence.
- [ ] **Step 5: Inspect CI jobs/logs; fix any failures using RED→GREEN cycles.**
- [ ] **Step 6: Run/inspect final verification** and report exact passing/failing evidence plus any unverified claims.
