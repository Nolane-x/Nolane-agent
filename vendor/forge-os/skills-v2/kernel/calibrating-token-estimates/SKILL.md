---
name: calibrating-token-estimates
description: "Use when estimated token counts differ systematically from provider-reported usage across models, content classes, languages, or tool schemas."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Calibrating Token Estimates

## Core principle

Record estimated and actual usage with model version and content class. Increase safety margin when uncertainty or model drift rises. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the provider exposes an exact offline tokenizer already in use
- one isolated observation is the only evidence
