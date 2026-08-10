# Procedure

1. Identify changed semantic subjects and old hashes.
2. Traverse artifact, route, context, provider, and evidence dependencies.
3. Mark affected receipts and gates stale without deleting audit history.
4. Compute the minimal rerun plan needed to regain assurance.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
