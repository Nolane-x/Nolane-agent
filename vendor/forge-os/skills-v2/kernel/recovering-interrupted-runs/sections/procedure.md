# Procedure

1. Load the last committed state, lease, coverage, and output locks.
2. Reclaim only expired work using a higher fencing sequence.
3. Verify completed receipts and identify uncommitted side effects.
4. Resume the minimal remaining units with idempotency keys.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
