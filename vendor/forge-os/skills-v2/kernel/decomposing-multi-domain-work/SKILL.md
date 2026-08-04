---
name: decomposing-multi-domain-work
description: "Use when one request spans independent product, engineering, design, security, data, legal, or operational subsystems that cannot be specified and verified as one bounded change."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Decomposing Multi-Domain Work

## Core principle

Identify outcome boundaries and trust boundaries before technical layers. Order only true dependencies and leave independent branches parallel. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- one bounded component with a single verification surface
- tasks that only differ by file location
