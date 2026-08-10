# Procedure

1. Derive checks from requirements, contracts, invariants, and observed risks.
2. Create a test that can fail for the intended defect class.
3. Extract invariants from domain and acceptance contracts.
4. Define generators that cover valid, invalid, boundary, and structurally diverse values.
5. Use shrinking to minimize failing cases and persist seeds.
6. Test invariants across round trips, permutations, retries, and state transitions.
7. Convert every discovered counterexample into a deterministic regression fixture.
8. Run the test against the current system and record the baseline.
9. Exercise positive, negative, boundary, and recovery behavior.
10. Classify findings by impact, reproducibility, and affected scope.
11. Publish evidence without masking critical failures behind aggregate scores.
