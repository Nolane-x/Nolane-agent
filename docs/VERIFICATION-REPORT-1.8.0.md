# Forge Studio 1.8.0 verification contract

Date: 2026-07-29

The required command is:

```bash
npm run release:matrix
```

Evidence is written to `release/matrix-1.8.0/`, bound to the exact Git commit. Every required gate must pass.

## Instruction-policy evidence

- Typed frontmatter parsing and bounded recursive discovery.
- Global, repository, directory, language, and task scope conformance.
- Deterministic inheritance and precedence graph.
- Same-precedence typed conflict detection.
- Higher-precedence conflict resolution.
- Invalid schema reporting.
- Safe imports with traversal, symlink, cycle, depth, byte, and count limits.
- Workspace Trust enforcement.
- AgentLoop policy context wiring.
- Authenticated API and lazy Instruction Governance Center.
- Dedicated `instruction-policy-governance` release gate.

## Remaining-gaps evidence

Every non-verified checklist item must appear exactly once in `REMAINING-GAPS-1.8.0.md` and the machine-readable release report, with status, reason, current evidence, and completion condition.
