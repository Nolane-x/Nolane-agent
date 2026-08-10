---
name: learning-from-agent-failures
description: "Use when repeated agent, route, tool, context, or verification failures reveal a reusable technique gap rather than a one-off project defect."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Learning from Agent Failures

## Core principle

Cluster failures by invariant, rationalization, missing context, and tool boundary. Propose a skill or code change without auto-promoting it. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the failure is caused by a known code bug
- one isolated failure has no reproducible pattern
