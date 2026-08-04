# Procedure

1. Read the current project state and active gate.
2. Resolve only the minimum missing state required for routing.
3. Build an eligibility set from contract preconditions before scoring.
4. Score state match, artifact need, domain fit, assurance fit, available tools, measured utility, and context cost separately.
5. Apply hard exclusions before soft ranking.
6. Resolve conflicts by preferring the route that satisfies the gate with fewer assumptions and less context.
7. Persist route reasons so the same state produces deterministic ordering.
8. Compile a bounded context pack from direct dependencies.
9. Execute the contracted operation without authoring unrelated artifacts.
10. Record decisions, provenance, and audit events.
11. Emit the next eligible skill set and stop condition.
