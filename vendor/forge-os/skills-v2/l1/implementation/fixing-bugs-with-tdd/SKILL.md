---
name: fixing-bugs-with-tdd
description: "Use when fixing bugs with tdd within implementation lifecycle boundaries, especially when does the artifact make the owned decision for fixing bugs with tdd explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Fixing Bugs With Tdd

## Core principle

Fixing bugs with tdd within implementation lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require fixing bugs with tdd within implementation lifecycle boundaries
- the typed inputs for fixing-bugs-with-tdd are absent and another technique owns the outcome
