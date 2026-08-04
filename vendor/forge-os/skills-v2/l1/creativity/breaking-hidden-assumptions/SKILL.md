---
name: breaking-hidden-assumptions
description: "Use when breaking hidden assumptions within creativity lifecycle boundaries, especially when does the artifact make the owned decision for breaking hidden assumptions explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Breaking Hidden Assumptions

## Core principle

Breaking hidden assumptions within creativity lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require breaking hidden assumptions within creativity lifecycle boundaries
- the typed inputs for breaking-hidden-assumptions are absent and another technique owns the outcome
