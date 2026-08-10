---
name: explaining-route-decisions
description: "Use when a human or agent needs a concise, auditable explanation of why techniques and providers were selected, excluded, blocked, or deferred."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Explaining Route Decisions

## Core principle

Summarize target outcomes and hard constraints first. Expose uncertainty and the exact action required to unblock execution. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- no route has been compiled
- raw internal scoring would expose secrets or private content
