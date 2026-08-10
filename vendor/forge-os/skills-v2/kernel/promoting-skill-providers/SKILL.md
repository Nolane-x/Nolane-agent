---
name: promoting-skill-providers
description: "Use when a quarantined or candidate provider requests validated, stable, or certified status and must prove current trust, quality, compatibility, freshness, and mapping integrity."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Promoting Skill Providers

## Core principle

Verify immutable provider digest, signature, license, scans, and source revision. Commit status change atomically with expiry and audit events. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- provider content or source revision changed after evaluation
- the requester supplies metrics without a trusted eval receipt
