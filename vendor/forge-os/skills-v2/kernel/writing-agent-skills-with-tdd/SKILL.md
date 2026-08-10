---
name: writing-agent-skills-with-tdd
description: "Use when creating or changing an agent skill whose behavior, routing, discipline, or technique must improve over a measurable baseline rather than merely sound persuasive."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Writing Agent Skills with TDD

## Core principle

Write pressure or application scenarios before the skill. Rerun, close new loopholes, and preserve the evidence matrix. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- project-specific instructions that are not reusable
- a mechanical rule better enforced entirely in code
