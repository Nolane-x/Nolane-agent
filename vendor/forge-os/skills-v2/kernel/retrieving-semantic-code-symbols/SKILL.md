---
name: retrieving-semantic-code-symbols
description: "Use when an agent must orient in a large codebase or fetch one implementation body by stable symbol identity, content hash, dependency, test, or call-site relation."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Retrieving Semantic Code Symbols

## Core principle

Build or update a language-specific symbol graph incrementally. Reject stale requests and include directly relevant tests and call sites. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- a tiny file can be read safely in full
- the language adapter cannot identify symbol boundaries
