---
name: designing-extension-points
description: "Use when designing extension points within architecture lifecycle boundaries, especially when does the artifact make the owned decision for designing extension points explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Designing Extension Points

## Core principle

Designing extension points within architecture lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require designing extension points within architecture lifecycle boundaries
- the typed inputs for designing-extension-points are absent and another technique owns the outcome
