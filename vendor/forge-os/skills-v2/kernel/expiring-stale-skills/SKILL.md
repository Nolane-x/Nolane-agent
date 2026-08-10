---
name: expiring-stale-skills
description: "Use when provider sources, tool APIs, model behavior, security assumptions, evaluators, or compatibility windows may have become outdated since the last successful validation."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Expiring Stale Skills

## Core principle

Evaluate source revision, observed date, compatibility window, and last eval. Schedule bounded re-sync, scan, and evaluation work. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the provider has a current immutable source and unexpired evaluation
- historical archived providers that cannot route
