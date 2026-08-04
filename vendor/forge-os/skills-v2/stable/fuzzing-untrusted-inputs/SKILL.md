---
name: fuzzing-untrusted-inputs
description: "Use when exercise parsers, protocol boundaries, file formats, and user-controlled fields with structured malformed input, especially when does the fuzzer reach deep parser states?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Fuzzing Untrusted Inputs

## Core principle

Exercise parsers, protocol boundaries, file formats, and user-controlled fields with structured malformed input. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- fully enumerated finite inputs
- performance load testing without malformed input risk

Load only the sections selected by the RoutePlan.
