---
name: classifying-delivery-risk
description: "Use when classifying delivery risk within planning lifecycle boundaries, especially when does the artifact make the owned decision for classifying delivery risk explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Classifying Delivery Risk

## Core principle

Classifying delivery risk within planning lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require classifying delivery risk within planning lifecycle boundaries
- the typed inputs for classifying-delivery-risk are absent and another technique owns the outcome
