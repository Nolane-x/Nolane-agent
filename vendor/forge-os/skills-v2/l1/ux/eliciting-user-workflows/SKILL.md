---
name: eliciting-user-workflows
description: "Use when eliciting user workflows within ux lifecycle boundaries, especially when does the artifact make the owned decision for eliciting user workflows explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Eliciting User Workflows

## Core principle

Eliciting user workflows within ux lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require eliciting user workflows within ux lifecycle boundaries
- the typed inputs for eliciting-user-workflows are absent and another technique owns the outcome
