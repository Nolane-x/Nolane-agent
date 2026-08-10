---
name: projecting-artifact-deltas
description: "Use when an agent needs current artifact state and changes since a checkpoint without receiving full historical artifacts and superseded versions."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Projecting Artifact Deltas

## Core principle

Resolve active artifact versions and requested dependency depth. Provide explicit fetch handles for omitted full bodies. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- no checkpoint exists and the full artifact is explicitly required
- the artifact content is smaller than its projection
