# Procedure

1. Read the current project state and active gate.
2. Resolve only the minimum missing state required for routing.
3. Start from declared consumes and traverse only direct dependencies within the reference-depth budget.
4. Represent large project structures through stable IDs, hashes, signatures, and deltas.
5. Include unresolved findings and decisions that constrain the output.
6. Reject stale artifacts whose hashes no longer match the graph.
7. Emit an explicit omission list so the worker knows what was deliberately excluded.
8. Compile a bounded context pack from direct dependencies.
9. Execute the contracted operation without authoring unrelated artifacts.
10. Record decisions, provenance, and audit events.
11. Emit the next eligible skill set and stop condition.
