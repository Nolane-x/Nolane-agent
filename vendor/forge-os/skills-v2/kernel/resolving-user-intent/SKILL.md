---
name: resolving-user-intent
description: "Use when a request contains ambiguous goals, unstated constraints, conflicting stakeholders, or decisions that would cause competent teams to build materially different products."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
  kernel-level: L0
---

# Resolving User Intent

## Core principle

Separate user facts from interpretations and unknowns. Stop only when scope-changing assumptions have authenticated ownership. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- a fully specified deterministic command
- a wording preference that cannot change behavior
