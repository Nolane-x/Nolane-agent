---
name: designing-interaction-contracts
description: "Use when specify complete user-system behavior across states, errors, latency, permissions, recovery, and accessibility, especially when is every asynchronous action observable and recoverable?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Designing Interaction Contracts

## Core principle

Specify complete user-system behavior across states, errors, latency, permissions, recovery, and accessibility. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- visual styling without user interaction states
- backend-only behavior with no user-facing contract

Load only the sections selected by the RoutePlan.
