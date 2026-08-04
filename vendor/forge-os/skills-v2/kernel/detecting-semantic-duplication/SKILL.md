---
name: detecting-semantic-duplication
description: "Use when several skills or providers may express the same trigger, mechanism, outputs, evaluation surface, or benchmark coverage under different names."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Detecting Semantic Skill Duplication

## Core principle

Compare exact and normalized structural signatures. Require human merge review before changing canonical identity. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- two techniques share an outcome but use distinct mechanisms
- exact duplicates already match by content hash
