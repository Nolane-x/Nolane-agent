---
name: routing-skill-graph
description: "Use when select skills using lifecycle state, typed dependencies, risk, tools, utility history, conflicts, and context cost, especially when do ineligible skills ever receive a score?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Routing Skill Graph

## Core principle

Select skills using lifecycle state, typed dependencies, risk, tools, utility history, conflicts, and context cost. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- a single explicitly selected skill
- provider installation before capability intent is known

Load only the sections selected by the RoutePlan.
