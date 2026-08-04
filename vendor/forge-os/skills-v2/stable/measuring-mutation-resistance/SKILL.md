---
name: measuring-mutation-resistance
description: "Use when measure whether tests detect plausible incorrect implementations rather than merely execute lines, especially when do critical branches have surviving mutants?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Measuring Mutation Resistance

## Core principle

Measure whether tests detect plausible incorrect implementations rather than merely execute lines. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- a project with no executable tests
- coverage reporting without test-quality questions

Load only the sections selected by the RoutePlan.
