# Procedure

1. Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by mapping existing solutions.
2. Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to mapping existing solutions.
3. Apply mapping existing solutions only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.
4. Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.
5. Create reproducible checks that would fail if mapping existing solutions were incomplete or implemented incorrectly.
