---
name: designing-idempotent-automations
description: "Use when make repeated, delayed, reordered, or retried automation executions produce one intended outcome, especially when can two workers perform the side effect?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Designing Idempotent Automations

## Core principle

Make repeated, delayed, reordered, or retried automation executions produce one intended outcome. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- read-only calculations without side effects
- a manually triggered task that cannot retry

Load only the sections selected by the RoutePlan.
