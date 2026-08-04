---
name: testing-cost-abuse
description: "Use when find attacker-controlled paths that amplify metered compute, model, storage, notification, or third-party spend, especially when can one cheap request trigger many expensive downstream calls?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Testing Cost Abuse

## Core principle

Find attacker-controlled paths that amplify metered compute, model, storage, notification, or third-party spend. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- fixed offline computation with no metered resource
- performance tuning without adversarial consumption

Load only the sections selected by the RoutePlan.
