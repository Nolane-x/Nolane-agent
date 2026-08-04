# Procedure

1. Load one task, its direct contracts, and its failing test.
2. Verify the test fails for the intended missing behavior.
3. Write the smallest behavior test from the acceptance contract before production code.
4. Run it and confirm it fails for the intended missing behavior rather than setup or syntax.
5. Implement only enough behavior to pass, then run the focused and relevant regression suites.
6. Refactor only while all tests remain green and no behavior changes.
7. Record the red output, green output, diff review, and remaining risks.
8. Implement the minimum sufficient change.
9. Run focused tests, then relevant regression tests.
10. Review the diff for complexity, security, and contract drift.
11. Commit evidence and hand off to independent review.
