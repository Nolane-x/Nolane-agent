# Procedure

1. Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by choosing deployment strategy.
2. Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to choosing deployment strategy.
3. Apply choosing deployment strategy only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.
4. Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.
5. Create reproducible checks that would fail if choosing deployment strategy were incomplete or implemented incorrectly.
