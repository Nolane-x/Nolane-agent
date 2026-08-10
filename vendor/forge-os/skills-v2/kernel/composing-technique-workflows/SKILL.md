---
name: composing-technique-workflows
description: "Use when one outcome requires multiple specialized techniques with branch, join, parallel, retry, or rollback relationships rather than a single linear skill invocation."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Composing Technique Workflows

## Core principle

Resolve required and optional technique relations. Attach retry, rollback, and stop paths to the exact node that owns them. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- one technique produces the complete verified outcome
- a sequence exists only for presentation convenience
