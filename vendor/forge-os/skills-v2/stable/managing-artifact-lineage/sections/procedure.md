# Procedure

1. Read the current project state and active gate.
2. Resolve only the minimum missing state required for routing.
3. Assign stable project-scoped IDs and canonical content hashes.
4. Record producing skill, agent identity, consumed artifacts, decisions, evidence, and residual risks.
5. Append new versions; never mutate previously verified content in place.
6. When upstream content changes, compute descendants and mark only affected artifacts invalidated.
7. Require independent verification before changing state to verified.
8. Compile a bounded context pack from direct dependencies.
9. Execute the contracted operation without authoring unrelated artifacts.
10. Record decisions, provenance, and audit events.
11. Emit the next eligible skill set and stop condition.
