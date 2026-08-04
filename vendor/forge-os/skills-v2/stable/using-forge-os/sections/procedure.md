# Procedure

1. Read the current project state and active gate.
2. Resolve only the minimum missing state required for routing.
3. Read only the project header, current gate, open findings, direct artifact hashes, and confirmed decisions.
4. Compute missing gate artifacts before selecting any skill.
5. Exclude skills with failed preconditions, unavailable tools, conflicts, quarantine status, or assurance mismatch.
6. Activate the smallest non-conflicting skill set that can close the current evidence gap.
7. Commit the route explanation, context budget, stop condition, and invalidation impact before dispatch.
8. Compile a bounded context pack from direct dependencies.
9. Execute the contracted operation without authoring unrelated artifacts.
10. Record decisions, provenance, and audit events.
11. Emit the next eligible skill set and stop condition.
