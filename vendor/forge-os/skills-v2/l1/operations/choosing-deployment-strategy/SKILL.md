---
name: choosing-deployment-strategy
description: "Use when choosing deployment strategy within operations lifecycle boundaries, especially when does the artifact make the owned decision for choosing deployment strategy explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Choosing Deployment Strategy

## Core principle

Choosing deployment strategy within operations lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require choosing deployment strategy within operations lifecycle boundaries
- the typed inputs for choosing-deployment-strategy are absent and another technique owns the outcome
