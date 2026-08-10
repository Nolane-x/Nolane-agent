---
name: enforcing-review-separation
description: "Use when artifact, code, finding, provider, or release approval requires independent review across principal, role, team, or trust-domain boundaries."
license: MIT
compatibility: ForgeOS v0.5 Skill Intelligence and Agent Skills-compatible hosts.
metadata:
  version: "1.0.0"
  maturity: candidate
  skill-type: technique
  kernel-level: L0
---

# Enforcing Review Separation

## Core principle

Resolve producer, resolver, evaluator, closer, and signer trust domains. Bind the authorized reviewer and evidence set to the reviewed subject. The runtime owns deterministic scope, coverage, policy, and evidence checks; the agent owns only the judgment that cannot be reduced safely to code.

## Do not activate when

- A0 prototype policy explicitly permits self-review
- the action is a reversible draft with no assurance claim
