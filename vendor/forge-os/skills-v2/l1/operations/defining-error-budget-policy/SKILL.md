---
name: defining-error-budget-policy
description: "Use when defining error budget policy within operations lifecycle boundaries, especially when does the artifact make the owned decision for defining error budget policy explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Defining Error Budget Policy

## Core principle

Defining error budget policy within operations lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require defining error budget policy within operations lifecycle boundaries
- the typed inputs for defining-error-budget-policy are absent and another technique owns the outcome
