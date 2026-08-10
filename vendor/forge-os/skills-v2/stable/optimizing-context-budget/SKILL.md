---
name: optimizing-context-budget
description: "Use when remove redundant context while preserving every fact, contract, dependency, and risk needed for correct execution, especially when is any removed fact load-bearing?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Optimizing Context Budget

## Core principle

Remove redundant context while preserving every fact, contract, dependency, and risk needed for correct execution. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- a short request far below model limits
- latency caused by external network execution rather than context

Load only the sections selected by the RoutePlan.
