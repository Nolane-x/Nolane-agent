---
name: reviewing-data-privacy
description: "Use when reviewing data privacy within security lifecycle boundaries, especially when does the artifact make the owned decision for reviewing data privacy explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Reviewing Data Privacy

## Core principle

Reviewing data privacy within security lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require reviewing data privacy within security lifecycle boundaries
- the typed inputs for reviewing-data-privacy are absent and another technique owns the outcome
