---
name: planning-parallel-agent-work
description: "Use when several work units are independent enough to execute concurrently but still need deterministic ownership, coverage, resource locks, and verified joins."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Planning Parallel Agent Work

## Core principle

Derive work units from dependency and change graphs. Join only after every unit has a trusted completion receipt. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- shared mutable state cannot be isolated
- the next task requires the previous task output
