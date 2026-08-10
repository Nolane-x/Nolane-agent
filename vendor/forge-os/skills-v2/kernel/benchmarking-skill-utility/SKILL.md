---
name: benchmarking-skill-utility
description: "Use when deciding whether a skill or provider should be promoted, quarantined, selected, or retired based on paired task outcomes, quality, token cost, and uncertainty."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
  kernel-level: L0
---

# Benchmarking Skill Utility

## Core principle

Pin the skill version, corpus, models, seeds, tools, and policy. Store confidence, failure clusters, token deltas, and decision provenance. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- single anecdotal success without a baseline
- production promotion without paired runs
