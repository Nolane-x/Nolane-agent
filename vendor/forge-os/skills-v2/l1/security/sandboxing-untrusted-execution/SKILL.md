---
name: sandboxing-untrusted-execution
description: "Use when sandboxing untrusted execution within security lifecycle boundaries, especially when does the artifact make the owned decision for sandboxing untrusted execution explicit and bounded?."
license: MIT
compatibility: ForgeOS v0.6 Deterministic Skill Fabric and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L1
---

# Sandboxing Untrusted Execution

## Core principle

Sandboxing untrusted execution within security lifecycle boundaries. Deterministic checks own scope, typed preconditions, evidence, and coverage; the agent performs only the domain judgment that cannot be encoded safely.

## Do not activate when

- the requested outcome does not require sandboxing untrusted execution within security lifecycle boundaries
- the typed inputs for sandboxing-untrusted-execution are absent and another technique owns the outcome
