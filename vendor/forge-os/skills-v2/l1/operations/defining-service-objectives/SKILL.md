---
name: defining-service-objectives
description: "Use when defining service objectives within operations lifecycle boundaries, especially when does the artifact make the owned decision for defining service objectives explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Defining Service Objectives

## Core principle

Defining service objectives within operations lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require defining service objectives within operations lifecycle boundaries
- the typed inputs for defining-service-objectives are absent and another technique owns the outcome
