---
name: validating-evidence-freshness
description: "Use when a gate, artifact verification, finding closure, or release decision depends on evidence that may target an old revision, artifact hash, provider version, or environment."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Validating Evidence Freshness

## Core principle

Resolve the exact subject revision, hashes, and policy version required. Record per-rule accepted evidence and stale rejection reasons. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the evidence is informational and cannot change a decision
- no subject identity is available
