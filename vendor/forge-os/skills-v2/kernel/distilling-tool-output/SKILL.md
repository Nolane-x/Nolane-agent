---
name: distilling-tool-output
description: "Use when test, compiler, browser, database, or terminal output is too large for model context but must remain retrievable and evidentially complete."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Distilling Tool Output

## Core principle

Store raw bytes in content-addressed evidence storage. Bind the summary to the raw digest and retrieval URI. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- the raw output is already concise
- the output contains binary data requiring a specialized parser
