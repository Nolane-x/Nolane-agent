---
name: reviewing-critical-code-line-by-line
description: "Use when review high-impact code with complete data-flow, control-flow, failure, concurrency, and trust-boundary coverage, especially when can malformed, stale, duplicated, reordered, or unauthorized input reach a side effect?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Reviewing Critical Code Line By Line

## Core principle

Review high-impact code with complete data-flow, control-flow, failure, concurrency, and trust-boundary coverage. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- generated lockfiles with no manual logic
- broad architectural review without critical code paths

Load only the sections selected by the RoutePlan.
