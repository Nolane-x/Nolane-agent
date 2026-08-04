---
name: testing-agent-tool-abuse
description: "Use when verify that untrusted prompts, retrieved content, and agent outputs cannot exceed tool authority or bypass human decisions, especially when can content from a file or webpage cause a privileged call?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Testing Agent Tool Abuse

## Core principle

Verify that untrusted prompts, retrieved content, and agent outputs cannot exceed tool authority or bypass human decisions. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- a model with no tool access
- ordinary input validation unrelated to agent authority

Load only the sections selected by the RoutePlan.
