---
name: isolating-development-work
description: "Use when isolating development work within planning lifecycle boundaries, especially when does the artifact make the owned decision for isolating development work explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Isolating Development Work

## Core principle

Isolating development work within planning lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require isolating development work within planning lifecycle boundaries
- the typed inputs for isolating-development-work are absent and another technique owns the outcome
