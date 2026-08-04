---
name: enforcing-context-budgets
description: "Use when planned context, tool schemas, model output reserve, or retrieved artifacts may exceed tenant, route, model, or skill-specific token limits."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Enforcing Context Budgets

## Core principle

Resolve the strictest applicable model, tenant, route, and section limits. Record category usage, remaining reserve, and overflow blockers. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- token measurement is unavailable and no conservative fallback exists
- a storage-size limit unrelated to model context
