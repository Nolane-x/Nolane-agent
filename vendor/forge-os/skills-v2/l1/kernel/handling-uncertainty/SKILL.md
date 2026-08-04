---
name: handling-uncertainty
description: "Use when handling uncertainty within kernel lifecycle boundaries, especially when does the artifact make the owned decision for handling uncertainty explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Handling Uncertainty

## Core principle

Handling uncertainty within kernel lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require handling uncertainty within kernel lifecycle boundaries
- the typed inputs for handling-uncertainty are absent and another technique owns the outcome
