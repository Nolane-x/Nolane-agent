# Procedure

1. Retrieve outcome candidates from intent and current gate gaps.
2. Apply hard policy filters before any utility score.
3. Retrieve techniques by triggers, anti-triggers, inputs, and outputs.
4. Freeze the minimal executable route with inclusion and exclusion reasons.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
