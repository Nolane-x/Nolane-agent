---
name: invalidating-dependent-proof
description: "Use when a semantic change, artifact supersession, provider substitution, policy change, or source revision makes previously accepted downstream proof unsafe to reuse."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Invalidating Dependent Proof

## Core principle

Identify changed semantic subjects and old hashes. Compute the minimal rerun plan needed to regain assurance. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- a cosmetic change does not affect any proof input
- the dependency graph has no path to accepted evidence
