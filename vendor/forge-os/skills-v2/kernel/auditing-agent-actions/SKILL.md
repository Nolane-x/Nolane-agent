---
name: auditing-agent-actions
description: "Use when model decisions, tool calls, approvals, artifact mutations, provider selections, or evidence issuance must be reconstructed without storing secrets or unverifiable narrative."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Auditing Agent Actions

## Core principle

Assign request, route, context, run, tool, evidence, and gate correlation IDs. Expose bounded query views without leaking protected payloads. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- high-volume debug telemetry with no audit value
- raw secret-bearing payloads that policy forbids storing
