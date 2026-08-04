---
name: binding-approvals-to-actions
description: "Use when an irreversible, high-risk, scope-changing, or trust-changing operation requires a human decision that cannot be replayed for another payload or state."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Binding Approvals to Actions

## Core principle

Canonicalize the complete action envelope and current semantic snapshot. Consume atomically and record revocation or replay attempts. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- a read-only operation with no external effect
- an automated policy decision that requires no human value judgment
