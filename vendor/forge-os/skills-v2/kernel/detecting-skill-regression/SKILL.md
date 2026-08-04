---
name: detecting-skill-regression
description: "Use when a skill, policy profile, provider dependency, model version, or section change may reduce completion rate, quality, safety, routing accuracy, or token efficiency."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Detecting Skill Regression

## Core principle

Resolve affected benchmark and transfer-test slices. Quarantine or roll back when confidence shows harmful change. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- no behavior-affecting content changed
- the skill has no prior validated baseline
