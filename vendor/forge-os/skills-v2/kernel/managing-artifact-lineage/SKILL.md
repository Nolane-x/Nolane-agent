---
name: managing-artifact-lineage
description: "Use when artifacts consume, replace, verify, invalidate, or derive from other versioned artifacts and downstream state must remain explainable and fresh."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
  kernel-level: L0
---

# Managing Artifact Lineage

## Core principle

Validate typed dependencies and active version slots before write. Invalidate downstream artifacts and proof when an upstream subject changes. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- ephemeral notes with no downstream consumer
- independent artifacts with no dependency relation
