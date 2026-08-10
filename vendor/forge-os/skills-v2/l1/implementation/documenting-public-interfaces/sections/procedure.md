# Procedure

1. Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by documenting public interfaces.
2. Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to documenting public interfaces.
3. Apply documenting public interfaces only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.
4. Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.
5. Create reproducible checks that would fail if documenting public interfaces were incomplete or implemented incorrectly.
