---
name: testing-skill-behavior
description: "Use when prove that a skill changes agent behavior under realistic pressure rather than merely sounding persuasive, especially when was a failing baseline observed?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Testing Skill Behavior

## Core principle

Prove that a skill changes agent behavior under realistic pressure rather than merely sounding persuasive. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- a runtime code bug unrelated to agent instructions
- a reference document with no behavioral expectation

Load only the sections selected by the RoutePlan.
