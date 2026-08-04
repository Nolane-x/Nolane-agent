---
name: requesting-human-decisions
description: "Use when requesting human decisions within kernel lifecycle boundaries, especially when does the artifact make the owned decision for requesting human decisions explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Requesting Human Decisions

## Core principle

Requesting human decisions within kernel lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require requesting human decisions within kernel lifecycle boundaries
- the typed inputs for requesting-human-decisions are absent and another technique owns the outcome
