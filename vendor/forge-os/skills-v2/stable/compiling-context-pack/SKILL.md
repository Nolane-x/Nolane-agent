---
name: compiling-context-pack
description: "Use when compile the minimum sufficient context needed for one skill cell while preserving provenance and freshness, especially when can the task be completed without asking for already-known facts?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Compiling Context Pack

## Core principle

Compile the minimum sufficient context needed for one skill cell while preserving provenance and freshness. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- a request that fits safely without retrieval or omission
- raw transcript archival with no model call

Load only the sections selected by the RoutePlan.
