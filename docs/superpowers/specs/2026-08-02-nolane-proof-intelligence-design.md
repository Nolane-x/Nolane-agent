# Nolane Nolane Proof Intelligence Design

## Objective

Build a Nolane-owned intelligence layer that goes beyond feature parity with NolaneNative by making every long-horizon mission proof-carrying, adversarially selected, causally grounded in the repository, and cost-aware across small and large models. This design does not claim comparative superiority until a same-model, same-machine, same-token independent benchmark passes.

## Why this is beyond parity

NolaneNative v0.18.x already exposes Mixture-of-Agents, goal completion contracts, self-verification, background delegation, durable Kanban, and scalable gateway lifecycle. Nolane therefore needs a deeper control plane rather than more surface adapters. The differentiator is a closed loop from explicit proof obligations to repository impact prediction, adversarial candidate selection, calibrated model routing, and observed-outcome learning.

## Architecture

### 1. Proof-Carrying Mission Compiler

Compiles a goal, acceptance criteria, invariants, rollback requirements, and resource budgets into a topologically ordered claim graph. Each claim has positive evidence obligations, falsification probes, independence requirements, and explicit deploy authorization rules. Hidden reasoning is never persisted.

### 2. Causal Repository Twin

Maintains a bounded graph of files, symbols, tests, contracts, runtime surfaces, and dependency effects. It predicts blast radius before changes, excludes stale evidence, and recalibrates edge confidence only from observed verification outcomes.

### 3. Adversarial Solution Tournament

Compares candidate solutions using proposer evidence, independent falsifier attacks, verifier receipts, rollback feasibility, proof coverage, and resource cost. A candidate with unresolved critical attacks or non-independent verification cannot win.

### 4. Adaptive Model Governor

Routes work to the smallest model with sufficient calibrated reliability while reserving independent verification for high-risk work. Learning is bounded and shadow-only until minimum sample, calibration, and human approval requirements are satisfied.

### 5. Superiority Plane and production wiring

A lazy `SuperiorityPlane` composes all four engines. It is exposed through `DecisionPlane`, `MissionResourceFabric`, and authenticated HTTP routes. Public snapshots expose claims, receipts, and bounded state only.

## Safety boundaries

- No raw prompts, model outputs, private reasoning, secrets, or OAuth tokens in receipts.
- No automatic file commit, deployment, model promotion, or comparative claim.
- Verification evidence must be observed and hash-addressed.
- Independent verification requires a different independence key from the proposer.
- Repository-twin learning is bounded and never mutates source automatically.
- Superiority claims remain locked until an independent comparative harness passes.

## Verification

Direct tests cover cycle rejection, missing proof, falsification failure, stale graph edges, calibration updates, independent-verifier enforcement, smallest-sufficient-model routing, high-risk escalation, and restart-safe public snapshots. Integration tests cover DecisionPlane, MissionResourceFabric, authenticated HTTP routes, release verification, and full release matrix wiring.
