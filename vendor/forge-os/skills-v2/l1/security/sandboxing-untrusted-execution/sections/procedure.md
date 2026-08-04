# Procedure

1. Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by sandboxing untrusted execution.
2. Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to sandboxing untrusted execution.
3. Apply sandboxing untrusted execution only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.
4. Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.
5. Create reproducible checks that would fail if sandboxing untrusted execution were incomplete or implemented incorrectly.
