---
name: deciding-release-scope
description: "Use when deciding release scope within planning lifecycle boundaries, especially when does the artifact make the owned decision for deciding release scope explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Deciding Release Scope

## Core principle

Deciding release scope within planning lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require deciding release scope within planning lifecycle boundaries
- the typed inputs for deciding-release-scope are absent and another technique owns the outcome
