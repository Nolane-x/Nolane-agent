# Forensic Recovery Checkpoint 7 Design

## Goal

Move Nolane Agent from short, single-action specialist evidence toward bounded long-horizon mission intelligence: project-disjoint held-out execution, step-wise process rewards, correct-candidate preservation, declarative skill compilation, transfer testing, and evidence-governed promotion.

## Scope and non-claims

Checkpoint 7 is source-local. It does not claim external-repository generalization, complete NolaneNative parity, frontier-model equivalence, Windows 8 GB certification, provider-real operation, or general coding intelligence. The canonical NolaneNative archive remains unavailable, so every NolaneNative parity claim stays locked.

The checkpoint adds five bounded programs:

1. **Held-out Project Pack** — three tracked, isolated repositories for Node, Go, and Python that are excluded from Checkpoint 6 training lineage. Each pack has a manifest, source/test hashes, runtime command, mutation, repair, and explicit repository identity.
2. **Mission Trajectory Engine** — executes multi-step public plans in copied workspaces, records expected and actual effects, maintains immutable best-known candidates, and never edits the tracked fixture source.
3. **Process Reward Kernel and Specialist** — calculates deterministic step reward from verifier-backed information gain, criterion progress, risk, redundancy, regressions, and resource waste; then trains a bounded classifier to distinguish progress, neutral work, and regression on repository-disjoint steps.
4. **Verified Skill Compiler** — compiles repeated verified recovery episodes into declarative text-rewrite skills with typed inputs/outputs, preconditions, verifier obligations, rollback metadata, soundness scope, known incompleteness, and transfer receipts. It cannot execute JavaScript, eval, shell strings, or arbitrary commands.
5. **Promotion v3** — promotion requires Checkpoint 6 ablation evidence plus project-disjoint transfer evidence, positive process-reward delta, matched quality/cost evidence, explicit approval, and all receipt hashes.

## Held-out architecture

A held-out pack lives under `fixtures/checkpoint-7-heldout/<repository-id>/` and declares:

- repository ID and runtime family;
- project root and entry files;
- test argv as an array;
- baseline source content;
- exact mutation and repair replacements;
- expected baseline/failure/recovery outcomes;
- task ID and specialist public states.

The collector rejects:

- repository IDs found in Checkpoint 6 training lineage;
- shell strings;
- path traversal and symlinks;
- commands outside the allowlisted runtime;
- untracked source hashes;
- missing failure or recovery observations.

## Mission trajectory architecture

A mission is an ordered list of public actions:

1. inspect source and test hashes;
2. verify baseline;
3. apply a declared mutation in a temporary copy;
4. verify the expected failure;
5. apply the declared repair;
6. verify recovery;
7. preserve the strongest candidate and produce a mission receipt.

Each step records:

- typed public state;
- action and parameters;
- expected effect;
- actual effect;
- verifier outcome;
- process-reward components;
- duration and output hashes;
- candidate source hash;
- parent step and previous best candidate.

The best-known candidate ledger is monotonic. A later regression cannot replace an earlier verified candidate. Hidden reasoning, raw secrets, and chain-of-thought are forbidden.

## Process reward

The deterministic reward is:

```text
reward = informationGain
       + criterionDelta
       + recoveryDelta
       + bestCandidatePreserved
       - irreversibleRisk
       - redundantAction
       - repeatedFailure
       - regressionDelta
       - resourceWaste
```

Every component is finite and bounded. A step cannot receive positive reward when the verifier is invalid, reward hacking is detected, the action has no effect, or source provenance is missing.

A small linear policy is trained on public step features with labels:

- `progress`;
- `neutral`;
- `regression`.

Training, validation, and held-out splits are disjoint by repository ID. Promotion requires held-out accuracy of at least 0.80, positive lift over majority baseline, and no safety regression.

## Skill compiler

The compiler accepts at least two verified recovery episodes with matching exact mutation/repair patterns. It emits a declarative solver definition compatible with `SolverSandbox`:

- only `replace-exact` operations;
- bounded replacement count;
- typed input and output;
- explicit writes;
- verifier obligations;
- rollback replacement;
- soundness scope;
- known incompleteness.

Transfer is tested on a repository ID absent from induction episodes. The skill is eligible only when it applies, the held-out test passes, rollback restores the original hash, and no source escapes the temporary workspace.

## Promotion v3

`ModelArtifactRegistry.promoteWithTransferEvidence()` extends v2 promotion. It requires:

- valid independent held-out evaluation;
- valid Checkpoint 6 ablation receipt;
- valid project-disjoint transfer receipt;
- valid process reward receipt with positive delta;
- valid same-quality cost receipt with candidate cost lower than baseline;
- explicit `approvedBy`;
- no worse safety;
- matching artifact identity across all receipts.

Active Checkpoint 7 decision support reads only v3 promotions. Missing, legacy, or partially evidenced artifacts fail closed.

## Runtime/API integration

`SmallModelFoundationService` exposes:

- collect held-out missions;
- train and verify process-reward specialist;
- compile and transfer-test skills;
- prepare and promote Checkpoint 7 evidence bundles;
- inspect status;
- run fail-closed decision support.

Authenticated HTTP routes mirror these operations. Training and promotion remain separate.

## Release truth gate

Checkpoint 7 passes only when:

- all 1,372 local requirements remain assertion-verified;
- all 88 external requirements remain external-unverified;
- three project-disjoint held-out repositories execute baseline/failure/recovery missions;
- every mission has at least six ordered steps and preserves its best candidate;
- the process reward specialist passes held-out and ablation thresholds;
- at least one declarative skill transfers to an unseen repository and rolls back correctly;
- five Checkpoint 6 specialists have promotion-v3 receipts;
- safe and unsafe decisions remain correctly separated;
- all NolaneNative, AGI, competitor-superiority, provider-real, and Windows external claims remain false.
