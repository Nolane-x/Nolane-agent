# Procedure

1. Evaluate source revision, observed date, compatibility window, and last eval.
2. Identify dependency or policy changes that force early revalidation.
3. Move stale providers out of stable routing without deleting history.
4. Schedule bounded re-sync, scan, and evaluation work.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
