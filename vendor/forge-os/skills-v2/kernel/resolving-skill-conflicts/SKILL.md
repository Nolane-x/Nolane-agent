---
name: resolving-skill-conflicts
description: "Use when candidate techniques, providers, policy profiles, ownership rules, or tool effects cannot safely coexist in the same execution route."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Resolving Skill Conflicts

## Core principle

Classify conflict as semantic, resource, authority, state, or side-effect conflict. Record excluded alternatives and invalidation consequences. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- alternatives are compatible and can run independently
- a provider is merely lower ranked without a conflict
