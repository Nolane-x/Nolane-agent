---
name: selecting-minimum-provider-set
description: "Use when a route has several procedural, knowledge, MCP, or tool providers and must choose the smallest trusted combination that satisfies all outputs and evidence obligations."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Selecting the Minimum Provider Set

## Core principle

Filter by tenant, status, freshness, license, tools, and trust blockers. Record why each remaining provider was excluded. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the selected technique has one mandatory provider
- provider choice is fixed by tenant policy
