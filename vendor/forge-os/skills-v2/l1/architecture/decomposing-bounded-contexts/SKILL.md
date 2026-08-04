---
name: decomposing-bounded-contexts
description: "Use when decomposing bounded contexts within architecture lifecycle boundaries, especially when does the artifact make the owned decision for decomposing bounded contexts explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Decomposing Bounded Contexts

## Core principle

Decomposing bounded contexts within architecture lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require decomposing bounded contexts within architecture lifecycle boundaries
- the typed inputs for decomposing-bounded-contexts are absent and another technique owns the outcome
