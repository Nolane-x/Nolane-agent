---
name: issuing-trusted-execution-receipts
description: "Use when a command, test, scanner, brokered tool, or sandbox run must produce evidence whose pass status and digest cannot be chosen by the requesting agent."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Issuing Trusted Execution Receipts

## Core principle

Authorize the evidence type and bind the request to a subject hash. Sign or content-address the immutable receipt before returning metadata. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- a human opinion is the evidence type
- the provider is not authorized for the requested evidence method
