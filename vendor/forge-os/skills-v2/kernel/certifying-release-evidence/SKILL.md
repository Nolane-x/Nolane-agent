---
name: certifying-release-evidence
description: "Use when a source archive, package, container, skill registry, or product release needs reproducible proof bound to the exact bytes being distributed."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Certifying Release Evidence

## Core principle

Freeze the source manifest and all release subjects. Publish claims boundaries and residual risks alongside evidence. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- an uncommitted experiment has no release subject
- verification ran on a different source tree or archive
