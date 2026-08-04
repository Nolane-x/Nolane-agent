# Forensic Recovery Checkpoint 6 Design

## Goal

Turn Checkpoint 5's single-repository pass-only trajectory pipeline into a multi-runtime failure/recovery evidence system, reduce the remaining assertion-unbound Master Ledger records without inventing proof, and require specialist artifacts to beat an explicit baseline before promotion.

## Scope

Checkpoint 6 is a source-local release. It does not certify Windows 8 GB performance, provider-real behavior, NolaneNative function parity, or general coding intelligence. Those claims remain fail-closed.

The checkpoint contains four bounded programs:

1. **Evidence Family Completion** — add exact named positive and negative contracts for the remaining high-volume requirement families and migrate only requirements whose titles and production paths match a supported contract.
2. **Multi-Runtime Trajectory Fabric** — collect real command outcomes from Node, Go, and Python project roots with executable allowlists, cwd boundaries, source/test hashes, output hashes, and verifier receipts.
3. **Mutation/Recovery Laboratory** — copy bounded source/test fixtures into isolated temporary workspaces, observe baseline pass, apply a declared mutation, observe expected failure, apply a declared repair, and observe recovery pass. Production files are never mutated in place.
4. **Ablation-Governed Promotion** — compare each trained specialist against a majority-class baseline on group-disjoint held-out examples. Promotion requires independent held-out evidence, no safety regression, positive accuracy lift, artifact lineage, and explicit human approval.

## Evidence architecture

Each requirement migration binds:

- requirement ID;
- exact contract test path;
- exact positive test name;
- exact negative test name;
- source SHA-256 for the contract file;
- historical aliases for replaced broad tests.

The checkpoint does not lower `maxRequirementsPerTest` safeguards by pretending a broad file is dedicated evidence. Explicit requirement bindings remain the only override.

## Trajectory architecture

### Execution trajectories

A trajectory probe declares:

- `projectId` and project root;
- executable family (`node`, `go`, or `python`);
- argv as an array, never a shell string;
- bounded timeout and output budget;
- source/test paths and hashes;
- expected verifier outcome;
- public typed state and specialist labels.

The collector resolves every path beneath the allowed project root, rejects symlinks and traversal, and records attempted and accepted episodes separately.

### Mutation/recovery trajectories

A recovery scenario declares:

- source and test fixture paths;
- an exact single replacement mutation;
- an exact repair replacement;
- baseline, mutation, and recovery commands;
- expected exit outcomes;
- specialist labels for the failure and recovery episodes.

The lab verifies:

1. baseline passes;
2. mutation changes the file hash;
3. mutation fails the verifier;
4. repair restores the original hash or declared repaired hash;
5. recovery passes;
6. no path escapes the temporary workspace.

Both failure and recovery episodes are public state/action/effect records. No hidden reasoning is stored.

## Specialist training and ablation

Checkpoint 6 trains the five existing bounded specialists from the combined execution and recovery dataset:

- tool router;
- context scorer;
- test selector;
- patch ranker;
- risk classifier.

Splits are group-disjoint by project and scenario. For each specialist, a majority-class baseline is fitted only on the training split and evaluated on the same held-out split as the model.

Promotion requires:

- model held-out accuracy at least 0.80;
- model accuracy strictly greater than baseline accuracy by at least 0.10;
- zero additional safety violations versus baseline;
- non-empty mutation and recovery lineage;
- at least three project families represented;
- explicit `approvedBy`;
- all artifact, benchmark, dataset, and ablation receipt hashes valid.

## Runtime integration

`SmallModelFoundationService` exposes:

- collection of multi-runtime trajectories;
- collection of mutation/recovery trajectories;
- training and verification of Checkpoint 6 artifacts;
- suite status including ablation eligibility;
- promotion and rollback;
- fail-closed decision support.

Authenticated HTTP routes mirror those operations. Decision support still blocks high/critical risk, reject/rollback patch decisions, abstentions, incomplete suites, and unapproved artifacts.

## Release truth gate

The Checkpoint 6 release gate requires:

- Master Ledger total remains 1,460;
- assertion-unbound materially below 265;
- all migrated requirements have exact positive/negative bindings;
- multi-runtime execution receipts from Node, Go, and Python;
- at least one verified mutation failure and one verified recovery pass;
- five ablation-eligible specialist artifacts;
- safe and unsafe decision receipts;
- all NolaneNative, AGI, competitor-superiority, provider-real, and Windows external claims remain false.

## Non-claims

Checkpoint 6 does not claim:

- complete NolaneNative parity;
- equivalence to large coding agents;
- general coding intelligence;
- production provider certification;
- signed Windows installer certification;
- NVDA/Narrator, screenshot, or 8 GB performance certification.
