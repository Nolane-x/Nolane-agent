---
name: routing-capability-graph
description: "Use when the system must translate confirmed intent, failed gates, missing artifacts, risks, and tools into the smallest safe set of outcome capabilities and techniques."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Routing the Capability Graph

## Core principle

Retrieve outcome candidates from intent and current gate gaps. Freeze the minimal executable route with inclusion and exclusion reasons. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the exact technique and provider were explicitly selected
- provider installation before the desired outcome is known
