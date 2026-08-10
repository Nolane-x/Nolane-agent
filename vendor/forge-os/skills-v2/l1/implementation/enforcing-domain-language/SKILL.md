---
name: enforcing-domain-language
description: "Use when enforcing domain language within implementation lifecycle boundaries, especially when does the artifact make the owned decision for enforcing domain language explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Enforcing Domain Language

## Core principle

Enforcing domain language within implementation lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require enforcing domain language within implementation lifecycle boundaries
- the typed inputs for enforcing-domain-language are absent and another technique owns the outcome
