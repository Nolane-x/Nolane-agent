---
name: designing-event-contracts
description: "Use when designing event contracts within architecture lifecycle boundaries, especially when does the artifact make the owned decision for designing event contracts explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Designing Event Contracts

## Core principle

Designing event contracts within architecture lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require designing event contracts within architecture lifecycle boundaries
- the typed inputs for designing-event-contracts are absent and another technique owns the outcome
