---
name: compiling-global-context
description: "Use when an agent request must combine system policy, task state, skill sections, code, artifacts, memory, tools, and references under one hard model-context budget."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Compiling Global Context

## Core principle

Reserve output and safety capacity before selecting inputs. Emit a context receipt and omission manifest for every excluded source. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the complete request is already far below every category budget
- archival storage with no model invocation
