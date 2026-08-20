# Cognitive Proposal Lifecycle Design

**Status:** Approved by the standing instruction to continue implementation without interactive approval.

## Problem

`CognitiveKernel` records task starts, task-scoped observations, proposals, verification receipts, and a commit gate. `DecisionPlane` forwards those five operations directly to the kernel. There is no durable, queryable lifecycle that joins one proposal to its task specification, evidence available when it was selected, verification, and eventual allow/deny decision.

`DecisionStateMachine` cannot be reused as-is. Its contract describes an executable change: `specified -> proposed -> verified -> authorized -> executed -> observed -> committed`. A cognitive commit gate is not authorization, tool execution, or an observed tool effect. Mapping it into those states would manufacture evidence.

## Goal

Add a receipt-linked cognitive proposal lifecycle owned by `DecisionPlane`. Preserve the public return values of the five cognitive wrapper methods, expose a read-only lifecycle snapshot, and make it impossible to claim that a cognitive gate executed an action.

## Non-goals

- Do not change `DecisionStateMachine` or weaken its execution/effect requirements.
- Do not make `CognitiveKernel.commit()` execute tools, write files, or authorize side effects.
- Do not invent a mission id when a cognitive task was started without one.
- Do not expose chain-of-thought or raw commands.
- Do not change Electron packaging or portable-smoke behavior.

## Data Model

`CognitiveProposalLifecycle` stores two bounded maps.

1. A task record keyed by `taskId` has a nullable copied `missionId`, a real `forge.cognitive-task-start.v1` receipt hash, an arrival-ordered bounded list of observation receipt hashes, and bounded proposal ids.
2. A decision record keyed by the real kernel `proposalId` has `taskId`, nullable `missionId`, `proposalReceiptSha256`, an immutable copy of observations known at selection time, state `proposed`, `verified`, `committed`, or `rejected`, and receipt-linked history.

The lifecycle uses hashes from kernel receipts only. It never hashes arbitrary caller payloads and presents the result as evidence.

## Truthful Semantics

| Kernel event | Lifecycle effect | What it does not claim |
|---|---|---|
| `startTask` succeeds | Register task specification receipt | A proposal or action exists |
| `observe` succeeds | Append task evidence receipt | A tool effect occurred |
| `propose` returns a proposal | Create proposal decision and snapshot known observations | Authorization or execution |
| `propose` returns abstention | Do not create proposal decision | A rejected execution |
| `verify` succeeds | Move matching proposal to `verified` | Tool execution |
| `commit` allows | Move matching proposal to `committed` | Tool execution or observed effect |
| `commit` denies | Move matching proposal to `rejected` | Any completed action |

Every lifecycle decision snapshot states `executionClaimed: false` and `observedToolEffectClaimed: false`.

## DecisionPlane Integration

`DecisionPlane` gains a lazy `cognitiveLifecycle` getter and `cognitiveLifecycleSnapshot(taskId = null)`. The existing methods retain their exact present returns:

```js
startCognitiveTask(input)
observeCognitiveEvent(taskId, event)
proposeCognitiveAction(taskId, input)
verifyCognitiveProposal(taskId, proposalId, verification)
commitCognitiveProposal(taskId, verifiedProposalId)
```

Each wrapper updates lifecycle state only after the corresponding kernel call succeeds. An abstention is recorded as no proposal, not as a rejection. A lifecycle invariant failure must surface; it must not be hidden by a partial result.

## Validation and Bounds

- Evidence hashes are lowercase SHA-256 strings.
- Task and proposal ids are nonempty bounded text.
- Verification and settlement must match an existing proposal in the same task.
- Duplicate evidence within one decision history and double settlement are rejected.
- Timestamps are non-negative safe integers and monotonic per decision.
- Capacity evicts only terminal decisions; a live decision is never silently removed.

## Verification

1. Unit tests prove receipt order and the absence of execution/effect claims.
2. Unit tests reject cross-task verification, duplicate evidence, settlement before verification, and double settlement.
3. Integration tests prove existing `DecisionPlane` return values remain unchanged while lifecycle snapshots are populated.
4. An abstention test proves no phantom decision is created.
5. Focused cognition gates and evidence freshness pass. Portable package smoke stays deferred by user instruction.
