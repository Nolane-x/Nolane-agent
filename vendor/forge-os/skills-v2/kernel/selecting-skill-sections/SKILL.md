---
name: selecting-skill-sections
description: "Use when a technique package contains overview, procedure, decisions, verification, failure modes, examples, or references and only a subset is needed for the current operation."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Selecting Skill Sections

## Core principle

Classify the operation as planning, execution, verification, recovery, or unfamiliar transfer. Bind section IDs, digests, token counts, and omitted sections into the route. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the complete skill is shorter than the section-selection overhead
- the requested section digest is stale
