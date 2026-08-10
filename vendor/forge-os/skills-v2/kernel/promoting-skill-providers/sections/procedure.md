# Procedure

1. Verify immutable provider digest, signature, license, scans, and source revision.
2. Load trusted evaluation and mapping-attestation receipts.
3. Apply maturity thresholds and risk-specific reviewer separation.
4. Commit status change atomically with expiry and audit events.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
