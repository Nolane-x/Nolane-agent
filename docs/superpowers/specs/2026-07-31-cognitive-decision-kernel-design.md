# Forge Studio 2.23.0 Cognitive Decision Kernel Design

## Goal

Build a bounded, privacy-safe cognitive control layer that helps Forge Studio preserve multiple interpretations and hypotheses long enough to choose the most informative next action, attribute failures to the responsible subsystem, and bind verified outcomes into replayable episodes.

## Scope

This release implements the core requirements in frontier section 34 that can be proven inside Core:

- context posterior with normalized probabilities and entropy;
- memory-write suppression while task interpretation remains materially dispersed;
- a bounded population of two to three active hypotheses;
- support, counter-evidence, predictions, falsification conditions, age, and test cost per hypothesis;
- epistemic action selection by expected information gain minus token, RAM, latency, and irreversibility cost;
- structured failure attribution across context, memory, causal model, planning, execution, verification, and goal;
- subsystem owner masks so unrelated state is not rewritten after a local error;
- causal episode binding with expected versus actual effects and rollback points;
- recovery-lease strategy bans;
- commit and stop gates based on posterior concentration, dominant hypothesis, bounded scope, known verification probe, criteria receipts, and remaining information gain;
- a lazy `CognitiveKernel` facade integrated with the existing Decision Plane and Agent Loop.

This release does not implement autonomous skill promotion, learned world models, self-modification, hidden chain-of-thought storage, or weight updates.

## Architectural boundaries

### Package

`src/cognition/` is the single package boundary. Components use immutable snapshots and content-addressed receipts. No component writes source files, semantic memory, policy, or commitments directly.

### Context posterior

`ContextPosteriorManager` maintains at most five context candidates. Probabilities are normalized after evidence updates. It exposes entropy and concentration. Durable memory writes are denied while normalized entropy exceeds the configured threshold or the leading context is below minimum probability.

### Hypothesis population

`HypothesisPopulation` admits at most three active hypotheses. Each item includes a claim, probability, predictions, support evidence IDs, counter-evidence IDs, falsification condition, test cost, age, and status. Evidence updates modify probability through bounded likelihood factors rather than replacing the entire population.

### Epistemic action selector

`EpistemicActionSelector` scores candidate actions as:

`taskUtility + informationGain - tokenCost - ramCost - timeCost - irreversibilityRisk`

Weights are explicit and immutable. The selector rejects irreversible actions when uncertainty exceeds the configured bound and prefers low-cost probes when they can discriminate multiple hypotheses.

### Structured error router

`StructuredErrorRouter` converts failure evidence into a normalized responsibility posterior across eight subsystems. It returns an owner mask containing only subsystems above a threshold. Missing binary and environment failures should route to execution; stale symbol memory should route to memory/context; green tests with unmet criteria should route to causal model or goal interpretation.

### Episodic binder

`EpisodicBinder` stores structured episodes, not transcripts. Each episode binds context state, goal, observations, hypotheses considered, selected action, expected effect, actual effect, error attribution, rollback point, verification result, and lesson status. Forbidden private fields are rejected recursively.

### Cognitive kernel

`CognitiveKernel` lazily owns the five primitives. It provides:

- `startTask(input)`
- `observe(taskId, event)`
- `propose(taskId, input)`
- `verify(taskId, proposal, verification)`
- `commit(taskId, verifiedProposal)`
- `rollback(taskId, receiptId)`
- `snapshot(taskId?)`
- `close()`

Only `commit()` may emit a commit authorization receipt, and only if all commit gates pass. The kernel itself never changes files.

### Agent Loop integration

The existing fast path remains the default for low-risk, low-uncertainty tasks. Cognitive mode activates only when at least one trigger is present: multiple plausible contexts, high-risk change, repeated failure, unresolved hypotheses, or explicit mission policy. Agent Loop records public cognitive metadata and receives a next-action recommendation; it does not receive or store hidden reasoning.

## Data and privacy

Every public snapshot excludes raw prompts, model outputs, environment dumps, credentials, cookies, authorization headers, and chain-of-thought. Claims and evidence references are bounded text or stable IDs. All receipts use canonical SHA-256.

## Error handling

- Invalid probabilities, duplicate IDs, cyclic input, unbounded collections, or forbidden fields fail closed.
- Evidence referencing unknown contexts or hypotheses is rejected.
- A task cannot commit after the kernel is closed.
- Irreversible action proposals are rejected under high uncertainty.
- Failed strategies remain banned only inside the current recovery lease unless independently promoted by a later release.

## Testing

Each primitive receives unit tests written before production code. Integration tests cover:

- posterior concentration after discriminating evidence;
- memory-write denial while entropy is high;
- preservation of a lower-ranked hypothesis until falsified;
- probe selection over a broad code edit when information gain per resource is higher;
- correct failure routing without resetting unrelated state;
- episode creation after observed outcomes;
- recovery strategy ban;
- commit denial without dominant hypothesis or verification probe;
- stop when all criteria are verified or marginal information gain is below threshold;
- Agent Loop fast path and cognitive path;
- privacy-safe runtime snapshot and lifecycle.

The release measurement is deterministic and uses real Core components. It does not claim model-level cognition or benchmark superiority.

## Release and audit

Forge Studio 2.23.0 adds a required `cognitive-decision-kernel` release gate. Frontier audit changes are version-aware: historical release counts remain unchanged; only requirements with direct source, tests, measurement, and gate move to `verified_source_test`. Requirements whose production proof needs a real model, live repository, or external sandbox stay partial or not implemented.
