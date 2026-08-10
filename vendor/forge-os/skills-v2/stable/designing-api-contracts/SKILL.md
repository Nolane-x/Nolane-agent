---
name: designing-api-contracts
description: "Use when define stable request, response, error, idempotency, authorization, pagination, versioning, and observability contracts before implementation, especially when can a client recover from every documented error?."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: stable
  skill-type: technique
---

# Designing Api Contracts

## Core principle

Define stable request, response, error, idempotency, authorization, pagination, versioning, and observability contracts before implementation. Activate only when the typed entry conditions are present; stop rather than inventing a missing tool, decision, or proof.

## When not to use

- internal code with no boundary or consumer
- observability instrumentation without an API change

Load only the sections selected by the RoutePlan.
