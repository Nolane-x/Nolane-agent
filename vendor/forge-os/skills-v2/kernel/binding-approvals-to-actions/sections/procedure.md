# Procedure

1. Canonicalize the complete action envelope and current semantic snapshot.
2. Issue a one-time capability to an authenticated human principal.
3. Bind expiry, tenant, policy version, and payload digest.
4. Consume atomically and record revocation or replay attempts.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
