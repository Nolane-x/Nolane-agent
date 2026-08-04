# Procedure

1. Load one task, its direct contracts, and its failing test.
2. Verify the test fails for the intended missing behavior.
3. Define why the module is critical and identify assets, callers, side effects, invariants, and failure consequences.
4. Trace every input from origin through validation, transformation, authorization, persistence, and output.
5. Review each branch, error path, cleanup path, retry, timeout, and concurrent interleaving.
6. Cross-check code against requirements, tests, dependency behavior, and operational telemetry.
7. Record findings with exact lines, exploit or failure scenario, severity, and required evidence for closure.
8. Implement the minimum sufficient change.
9. Run focused tests, then relevant regression tests.
10. Review the diff for complexity, security, and contract drift.
11. Commit evidence and hand off to independent review.
