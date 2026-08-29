# Ephemeral Capability Composition v1 — Design

Date: 2026-08-29
Status: approved design, pre-implementation
Target baseline: `main@da04db14be96975871c1582589464a6ddae945db`
Research branch: `codex/ephemeral-capability-composition-v1`

## 1. Purpose

Nolane Agent can discover and progressively load authorized tools, and it can compile evidence-backed compositional skills. It does not yet have a governed way to synthesize a new executable capability during a run from tools that the task is already authorized to use.

Ephemeral Capability Composition v1 adds that missing bridge.

A running agent may define a small, deterministic, temporary composite tool whose steps invoke only tools already authorized for the same task. The composite exists only for the current run, gains no authority, persists no executable code, and is executed through the same governance path as ordinary tool calls.

The research objective is capability amplification, not feature count. The mechanism is successful only if it measurably improves task completion, recovery, or tool-turn efficiency without weakening authorization, provenance, verification, or failure transparency.

## 2. Existing seams we will reuse

The implementation must build on current mechanisms instead of creating parallel systems:

- `src/agent/dynamic-tool-catalog.mjs` — progressive discovery/loading of already-known tool schemas.
- `src/agent/agent-loop.mjs` — authoritative run-local active tool set, hooks, task-contract enforcement, broker/gateway dispatch, activity tracking, receipts, evidence recording, and completion gating.
- `src/agent/adaptive-intelligence-plane.mjs` — adaptive intelligence surface.
- `src/skills/compositional-skill-compiler.mjs` and `src/skills/skill-registry.mjs` — evidence-backed declarative skill lifecycle. V1 does not turn composites into persistent skills automatically.
- `src/cognition/*` — cognitive proposal/verification/commit machinery. V1 may emit evidence usable by later learning but does not actuate cognitive strategy proposals.

## 3. Non-goals

V1 explicitly does **not** implement:

1. arbitrary JavaScript, Python, shell, WASM, plugin, or MCP generation;
2. new permissions, capabilities, secrets, filesystem scopes, network scopes, or process authority;
3. persistent or cross-run executable capabilities;
4. automatic promotion into `SkillRegistry`;
5. recursion or composite-calling-composite;
6. loops, conditions, branches, retries, or a general expression language inside the composite definition;
7. a second policy engine or a second tool execution engine;
8. parallel step execution;
9. context-schema eviction/compaction claims;
10. cognitive strategy actuation.

These exclusions are deliberate. The smallest mechanism capable of testing the research hypothesis should ship first.

## 4. Core security invariant

For a synthesized capability `S` and task authority `A_task`:

`PrimitiveTools(S) ⊆ AuthorizedTools(task)`

and therefore:

`Authority(S) ⊆ Authority(task)`

Capability synthesis must never become authority synthesis.

Authorization is checked twice:

- **definition time:** every referenced primitive tool must be currently authorized;
- **execution time:** every primitive step is re-authorized through the current governed execution path immediately before execution.

Definition-time authorization is not a lease. If policy, hooks, or task state removes a primitive tool before the composite runs, the composite must fail closed.

## 5. Run-local lifecycle

A composite has this lifecycle:

`proposed -> validated -> registered -> invoked -> completed|failed -> expired`

Properties:

- registry lifetime is exactly one `AgentLoop.run()` invocation;
- no global `DynamicToolCatalog.register()` mutation;
- no disk persistence;
- no cross-task or cross-run lookup;
- no automatic skill creation;
- run end makes every definition unreachable.

V1 does not serialize composite definitions into resumable checkpoints. A normal run checkpoint may record only bounded diagnostic metadata such as capability name and receipt hash, never enough definition state to rehydrate execution after process/run recreation. Resume semantics are deferred deliberately because rehydration would turn an ephemeral capability into a persistence mechanism.

## 6. Model-facing creation tool

Add one meta-tool only:

`tool.compose.create`

It is exposed only when task metadata enables the experiment:

`ephemeralCapabilityComposition: true`

The tool is not enabled by default in V1.

### 6.1 Input schema

Conceptual input:

```json
{
  "name": "inspectSymbolUsage",
  "description": "Find references to a symbol and read the first matched file.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "required": ["symbol"],
    "properties": {
      "symbol": { "type": "string" }
    }
  },
  "steps": [
    {
      "id": "search",
      "tool": "fs.search",
      "args": {
        "query": { "$bind": { "from": "input", "path": ["symbol"] } }
      }
    },
    {
      "id": "read",
      "tool": "fs.read",
      "args": {
        "path": { "$bind": { "from": "step", "stepId": "search", "path": ["output", "matches", 0, "path"] } }
      }
    }
  ],
  "output": {
    "$bind": { "from": "step", "stepId": "read", "path": ["output"] }
  }
}
```

The `$bind` wrapper removes ambiguity between an ordinary literal object containing fields named `from`/`path` and a runtime binding instruction. Any object without the single reserved `$bind` key is treated as literal JSON and recursively cloned.

The final registered schema name is namespaced by the runtime, for example:

`ephemeral.inspectSymbolUsage`

The caller does not control a namespace that could collide with core/gateway tools.

### 6.2 Parameter-schema subset

V1 accepts only a bounded JSON-Schema subset for the composite's model-facing input:

- root `type` must be `object`;
- `additionalProperties` must be `false`;
- `properties` may use `string`, `number`, `integer`, `boolean`, `array`, `object`, or `null` types;
- nested object schemas must also set `additionalProperties:false`;
- arrays require an `items` schema;
- `required`, `enum`, `const`, numeric bounds, string length bounds, array length bounds, and nested `properties` are allowed;
- external `$ref`, `$defs`, pattern-based property expansion, schema composition keywords such as `allOf`/`anyOf`/`oneOf`, and executable/custom keywords are rejected.

The implementation should reuse existing schema validation utilities where practical. It must not introduce a general-purpose schema interpreter solely for this feature.

### 6.3 Bounds

V1 limits:

- maximum 8 steps;
- maximum 32 input parameters;
- maximum 64 binding nodes total;
- maximum binding path depth 16;
- maximum literal JSON depth 24;
- maximum normalized definition size 64 KiB;
- maximum description 1,000 characters;
- maximum caller-supplied name 64 characters before namespacing;
- step IDs unique, 1–64 characters;
- a step may reference only task input or outputs of earlier steps;
- no forward references;
- no cycles;
- no composite tool as a primitive step;
- no `tool.catalog.*` or `tool.compose.*` as primitive steps;
- no hidden fallback to arbitrary object/property evaluation.

The run may register at most 16 ephemeral capabilities. A definition that would exceed this limit is rejected.

## 7. Binding language

V1 uses a deliberately weak data-binding language.

Allowed binding sources:

```json
{ "$bind": { "from": "input", "path": ["name"] } }
```

```json
{ "$bind": { "from": "step", "stepId": "search", "path": ["output", "matches", 0, "path"] } }
```

Literal values are ordinary JSON values and may be nested. A binding node is recognized only when an object has exactly one own key, `$bind`, whose value conforms to the binding schema.

There is no interpolation syntax, expression evaluator, function call, arithmetic, JavaScript property access, prototype traversal, or executable template.

Path segments must be strings or non-negative safe integers. Traversal accepts only own properties of plain arrays/objects and rejects dangerous string segments `__proto__`, `prototype`, and `constructor` at every depth.

A missing binding is an execution failure. V1 does not silently substitute `null`, empty strings, or defaults.

## 8. Registry

Add a small run-local unit:

`src/agent/ephemeral-capability-registry.mjs`

Responsibilities only:

1. validate a proposed definition against the currently authorized primitive schema map;
2. normalize and freeze the definition;
3. create a collision-safe namespaced tool schema;
4. store definitions for the current run;
5. resolve bindings for one invocation;
6. build signed definition/execution receipts;
7. expose bounded snapshots for diagnostics/tests.

The registry must not execute primitive tools itself through any direct broker/gateway dependency.

Its invocation method receives an injected callback supplied by `AgentLoop` that executes one primitive through the normal governed path. The registry may sequence calls to this callback, but it has no alternative execution capability.

## 9. One governed execution path

Today `AgentLoop.run()` contains the authoritative per-call sequence:

1. lifecycle hooks;
2. active-tool authorization;
3. `RunActivityTracker.assertActionAllowed()`;
4. task-contract checks;
5. gateway/broker selection;
6. actual execution;
7. receipt collection;
8. evidence recording;
9. tool result screening/messages;
10. lifecycle completion hooks.

V1 must refactor only enough of this logic to make primitive execution reusable by composites.

Conceptually:

`executeGovernedTool({ name, args, origin, parentCompositeId, childStepId })`

Ordinary model tool calls and composite child steps both use this function.

The governed executor must return the existing `{status, output, receipt}` result and must not itself append a model-facing tool message for synthetic child calls. The caller controls message rendering. This prevents a composite with N internal steps from fabricating N top-level model tool-call IDs while preserving all child events, evidence, activity entries, and receipts.

There must be no direct calls from the composite registry to `broker.execute()`, MCP, browser, goal, ForgeOS, operating plane, adaptive intelligence, filesystem helpers, or process helpers.

This is a hard architectural invariant.

## 10. Authorization semantics

At creation time, the registry receives the current run-local primitive schema map and rejects definitions whose primitive tool is absent.

For this check, **primitive schema map** means the currently authorized ordinary execution tools only. It excludes `ephemeral.*`, `tool.compose.*`, and `tool.catalog.*` regardless of whether those meta-tools are present in `activeTools`.

At invocation time, every step must additionally satisfy the current `activeTools` set and all current hook/task-contract checks.

A composite is rejected if it contains:

- itself;
- any `ephemeral.*` tool;
- any discovery/composition meta-tool;
- a primitive tool not currently authorized;
- duplicate or invalid step IDs;
- unsafe binding paths;
- forward references;
- invalid schema or malformed parameter definition.

Authorization failures are explicit and typed. They must never be converted into a successful composite result.

## 11. Execution semantics

V1 executes steps sequentially in declared order.

For each step:

1. resolve arguments from invocation input and already completed step results;
2. execute the primitive through the governed executor;
3. require a normal tool receipt;
4. append the receipt hash to the composite execution trace;
5. store a bounded structured clone of the primitive result for later bindings;
6. stop immediately if the primitive throws, returns a non-`pass` status, lacks a valid receipt hash, or produces a result that cannot be safely cloned within configured bounds.

Later bindings read from the primitive result object `{status, output, receipt}`. This is why examples use paths beginning with `output`.

Primitive child results are not added to the LLM conversation as separate top-level tool messages. The model receives one final result for the `ephemeral.*` invocation. Existing evidence/activity/event pipelines still retain every child operation.

No rollback is automatically inferred. If a primitive tool already has transactional/rollback behavior, it retains that behavior. A later version may require explicit compensation definitions after evidence shows they are necessary.

A failing child step causes the composite to fail with:

- failed step ID;
- primitive tool name;
- child receipt hash when one exists;
- prior child receipt hashes;
- definition hash;
- no fabricated successful output.

The top-level composite result uses the same `status` convention as ordinary tools: `pass` only when every child step passed and the output binding resolved; otherwise it is a failure or the typed child error propagates according to the existing AgentLoop failure convention.

## 12. Receipts and provenance

Definition receipt schema:

`forge.ephemeral-capability-definition.v1`

Contains at least:

- run ID;
- task ID;
- generated tool name;
- normalized schema hash;
- normalized definition hash;
- primitive tool names;
- creation-time authorization snapshot hash;
- creation receipt hash.

Execution receipt schema:

`forge.ephemeral-capability-execution.v1`

Contains at least:

- run ID;
- task ID;
- capability name;
- definition receipt hash;
- invocation request hash;
- ordered child receipt hashes;
- status;
- failed step ID when applicable;
- output hash when successful;
- aggregate receipt hash.

The aggregate receipt never replaces child receipts. Child receipts remain first-class evidence and must continue to be recorded by the existing evidence pipeline.

Receipts contain hashes/metadata only; they do not persist raw secrets, raw hidden reasoning, or unbounded child outputs.

## 13. Dynamic tool interaction

When dynamic tool discovery is enabled, `tool.compose.create` is exposed alongside the discovery meta-tools when and only when `ephemeralCapabilityComposition:true`.

When dynamic tool discovery is disabled but composition is explicitly enabled, `tool.compose.create` is still exposed directly because composition and catalog discovery are orthogonal experiment flags.

A newly registered `ephemeral.*` schema becomes available in `activeTools` and in the run-local top-level authorization map used to validate model calls. It is **not** added to the primitive schema map used to validate future composite definitions, so nesting remains impossible by construction.

It must not be inserted into the global `DynamicToolCatalog`.

V1 makes **no claim** that composite tools reduce model context size. In fact, adding a schema can increase context. Context efficiency is measured empirically and is not an acceptance criterion unless the implementation introduces real schema retirement/compaction, which is explicitly outside V1.

## 14. Interaction with skills

V1 does not persist composites as skills.

However, execution receipts are deliberately shaped so that future work can convert repeated, independently verified composite executions into verified episodes suitable for `CompositionalSkillCompiler`.

The future bridge is:

`successful composite executions -> verified episodes -> draft compositional skill -> transfer test -> explicit promotion`

Automatic promotion remains false.

## 15. Interaction with cognition

V1 does not change provider fallback, retry policy, context escalation, or cognitive proposal actuation.

The implementation should emit enough structured events that later Cognitive Strategy Actuation research can observe:

- composition proposed;
- composition rejected and reason;
- composition registered;
- child step started/completed/failed;
- composition completed/failed;
- child receipt hashes and aggregate receipt hash.

No cognitive proposal is automatically committed solely because a composite executed successfully.

## 16. Failure and attack cases

Tests must include at minimum:

1. primitive tool not authorized at definition time;
2. primitive authorized at definition time but unavailable at invocation time;
3. attempted nested composite;
4. attempted `tool.compose.create` inside a composite;
5. attempted `tool.catalog.load/search` inside a composite;
6. duplicate step IDs;
7. forward step reference;
8. cyclic-equivalent reference pattern rejected by ordering rule;
9. missing binding source;
10. `__proto__`, `constructor`, and `prototype` binding traversal;
11. schema/name collision with core tool;
12. child tool failure;
13. child hook denial;
14. child task-contract denial;
15. child broker/gateway denial;
16. successful multi-step read-only composition;
17. successful composition including an authorized mutation tool under an explicit task contract;
18. run-local expiration / no visibility in a second run;
19. no mutation of global `DynamicToolCatalog`;
20. aggregate receipt changes when any definition, input, child receipt, or output changes;
21. literal object containing `from` and `path` is not misread as a binding;
22. composite count/size/depth bounds fail closed;
23. child non-pass result cannot yield top-level pass;
24. composition enabled while dynamic discovery disabled still works without exposing catalog meta-tools.

## 17. Test-driven implementation slices

Implementation should proceed in small red-green-refactor slices:

### Slice A — registry validation

Create failing unit tests for normalization, schema subset, limits, primitive authorization, unsafe bindings, ordering, collision protection, namespacing, and frozen definitions.

### Slice B — pure binding resolution

Create failing unit tests for input/step bindings, literal objects, missing paths, arrays, dangerous keys, depth bounds, and immutable/cloned outputs.

### Slice C — run-local registration

Create failing AgentLoop integration tests proving `tool.compose.create` can register an `ephemeral.*` schema only when enabled and cannot mutate the global catalog or primitive composition allowlist.

### Slice D — governed child execution

Refactor the minimum per-tool execution path and add tests proving ordinary and composite child calls traverse the same authorization/hook/task-contract/broker/gateway path while child calls do not create fake top-level model messages.

### Slice E — receipts/events/failure propagation

Add deterministic receipt and event tests, including child failure and stale authorization.

### Slice F — research benchmark

Add a small benchmark/fixture set comparing the same model/harness configuration with composition disabled vs enabled.

## 18. Research acceptance criteria

Engineering acceptance requires all of the following:

- all new unit/integration tests pass;
- existing relevant AgentLoop, tool governance, task contract, security, and dynamic-catalog tests pass;
- no new direct execution path bypasses the governed executor;
- composite definitions are run-local and non-persistent;
- nested composites are impossible in V1;
- no authority increase is possible through composition;
- every child effect retains an ordinary child receipt;
- aggregate receipt is deterministic and provenance-complete;
- feature is opt-in;
- ordinary tool execution behavior is unchanged when the feature flag is absent/false.

Capability acceptance is stricter and separate. We do **not** call the mechanism an intelligence improvement merely because tests pass.

A benchmark must compare composition disabled/enabled under the same task, repository/start state, model, tool authority, token budget, tool-call budget, and time budget.

Primary measurements:

- task solve rate;
- tool-call count;
- model turn count;
- recovery rate on repeated multi-step workflows;
- unauthorized-action rate (must remain zero);
- false-success rate (must not increase);
- wall-clock and token overhead.

The mechanism is retained only if it shows material capability/efficiency gain that justifies its complexity. If it adds bureaucracy without measurable gain, remove or redesign it.

## 19. Expected code surface

Expected files, subject to implementation evidence:

- add `src/agent/ephemeral-capability-registry.mjs`;
- minimally modify `src/agent/agent-loop.mjs`;
- possibly add a small schema/helper file only if keeping AgentLoop focused requires it;
- add focused unit/integration tests under the repository's existing test layout;
- add benchmark fixtures/results only after functional correctness is established.

No changes are expected to `SkillRegistry`, cognitive commit semantics, provider routing, sandbox drivers, or persistent database schema in V1.

## 20. Design decision summary

V1 is intentionally not a self-programming runtime. It is a governed composition mechanism.

The key experiment is whether a model becomes more capable when it can compress a newly discovered multi-tool procedure into a temporary callable abstraction during the same task, while every primitive effect remains subject to the exact same authority and evidence rules as before.

If that experiment succeeds, future work may distill verified composites into transferable skills and later connect cognitive recommendations to actual strategy actuation. Those are separate research steps and must earn their complexity independently.
