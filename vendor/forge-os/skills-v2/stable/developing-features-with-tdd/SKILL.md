---
name: developing-features-with-tdd
description: "Use when implement one externally observable feature through a verified red-green-refactor cycle, especially when was the failure observed before implementation?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Developing Features With Tdd

## Core principle

Implement one externally observable feature through a verified red-green-refactor cycle. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- generated fixtures or disposable experiments
- documentation-only changes with no executable behavior

Load only the sections selected by the RoutePlan.
