# Procedure

1. Load one task, its direct contracts, and its failing test.
2. Verify the test fails for the intended missing behavior.
3. List required behaviors, quality attributes, and extension points that have current consumers.
4. Choose the fewest concepts that make invalid states hard to represent.
5. Delete duplicate paths, speculative flags, pass-through layers, and narration-shaped abstractions.
6. Measure complexity through public surface, branches, state transitions, dependencies, and change amplification—not line count alone.
7. Verify behavior and readability after simplification.
8. Implement the minimum sufficient change.
9. Run focused tests, then relevant regression tests.
10. Review the diff for complexity, security, and contract drift.
11. Commit evidence and hand off to independent review.
