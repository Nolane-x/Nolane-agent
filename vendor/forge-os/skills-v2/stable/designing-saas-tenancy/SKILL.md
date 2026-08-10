---
name: designing-saas-tenancy
description: "Use when define tenant identity, data ownership, isolation, provisioning, lifecycle, and operational boundaries, especially when can any identifier be used without tenant context?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Designing Saas Tenancy

## Core principle

Define tenant identity, data ownership, isolation, provisioning, lifecycle, and operational boundaries. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- a single-user local application
- shared data with no tenant isolation requirement

Load only the sections selected by the RoutePlan.
