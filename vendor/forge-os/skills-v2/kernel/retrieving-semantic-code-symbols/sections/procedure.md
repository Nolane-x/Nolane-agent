# Procedure

1. Build or update a language-specific symbol graph incrementally.
2. Return compact IDs, signatures, hashes, and graph neighbors for orientation.
3. Fetch bodies only for explicitly requested symbol IDs and expected hashes.
4. Reject stale requests and include directly relevant tests and call sites.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
