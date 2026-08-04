# Procedure

1. Read deployment topology, service objectives, and rollback constraints.
2. Define observable success and failure signals.
3. Freeze the release candidate and record source, dependency, build, and artifact hashes.
4. Collect requirement traceability, test logs, coverage, mutation, fuzz, security, UX, performance, compatibility, migration, and rollback evidence required by assurance.
5. Verify evidence freshness and that every report targets the frozen candidate.
6. List unresolved findings and exact human acceptances without summarizing them away.
7. Generate a machine-readable dossier plus a concise human release decision.
8. Rehearse the operational change in a controlled environment.
9. Verify monitoring, alerting, rollback, and incident ownership.
10. Capture production-safe evidence and residual risks.
11. Publish an operations artifact with explicit go/no-go criteria.
