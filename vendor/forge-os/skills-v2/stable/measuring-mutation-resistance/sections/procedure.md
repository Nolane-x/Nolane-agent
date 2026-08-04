# Procedure

1. Derive checks from requirements, contracts, invariants, and observed risks.
2. Create a test that can fail for the intended defect class.
3. Select mutation operators that represent realistic defects for the language and domain.
4. Exclude generated, unreachable, and non-behavioral code with recorded reasons.
5. Run mutations against focused suites and classify killed, survived, timed out, and uncovered mutants.
6. Review surviving mutants in critical logic before using a global score.
7. Add behavior tests that kill meaningful survivors without asserting implementation details.
8. Run the test against the current system and record the baseline.
9. Exercise positive, negative, boundary, and recovery behavior.
10. Classify findings by impact, reproducibility, and affected scope.
11. Publish evidence without masking critical failures behind aggregate scores.
