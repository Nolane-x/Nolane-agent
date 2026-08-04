---
name: testing-properties-and-invariants
description: "Use when verify domain invariants across generated inputs, state transitions, serialization, retries, and boundary combinations, especially when is the property stronger than a handful of examples?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Testing Properties And Invariants

## Core principle

Verify domain invariants across generated inputs, state transitions, serialization, retries, and boundary combinations. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- snapshot-only UI review
- behavior with no stable invariant or generative input space

Load only the sections selected by the RoutePlan.
