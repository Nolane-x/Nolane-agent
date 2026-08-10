---
name: testing-concurrent-behavior
description: "Use when testing concurrent behavior within quality lifecycle boundaries, especially when does the artifact make the owned decision for testing concurrent behavior explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Testing Concurrent Behavior

## Core principle

Testing concurrent behavior within quality lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require testing concurrent behavior within quality lifecycle boundaries
- the typed inputs for testing-concurrent-behavior are absent and another technique owns the outcome
