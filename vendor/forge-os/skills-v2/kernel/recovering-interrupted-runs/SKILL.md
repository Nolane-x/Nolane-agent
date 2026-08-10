---
name: recovering-interrupted-runs
description: "Use when a skill, task, context compilation, tool execution, or release workflow stops after partial progress and must resume without duplicating side effects or trusting stale workers."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Recovering Interrupted Runs

## Core principle

Load the last committed state, lease, coverage, and output locks. Resume the minimal remaining units with idempotency keys. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the operation is atomic and has not started
- the previous run completed with a terminal receipt
