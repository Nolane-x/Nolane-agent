---
name: designing-model-routing
description: "Use when route AI requests by capability, risk, latency, cost, context, privacy, and measured task quality, especially when can a cheaper model safely handle the task class?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Designing Model Routing

## Core principle

Route AI requests by capability, risk, latency, cost, context, privacy, and measured task quality. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- a single fixed model required by policy
- prompt wording optimization within one model

Load only the sections selected by the RoutePlan.
