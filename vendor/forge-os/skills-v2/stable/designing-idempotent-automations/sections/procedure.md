# Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Identify the business operation and define its idempotency boundary.
4. Choose stable keys from event identity and operation scope; define retention and collision behavior.
5. Persist claim, progress, result, and terminal failure atomically with side-effect ordering.
6. Handle concurrent claims, partial external success, provider timeouts, and replay.
7. Expose operator-safe retry, reconciliation, and audit evidence.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.
