---
name: enforcing-accessibility
description: "Use when enforcing accessibility within ux lifecycle boundaries, especially when does the artifact make the owned decision for enforcing accessibility explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Enforcing Accessibility

## Core principle

Enforcing accessibility within ux lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require enforcing accessibility within ux lifecycle boundaries
- the typed inputs for enforcing-accessibility are absent and another technique owns the outcome
