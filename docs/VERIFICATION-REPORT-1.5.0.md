# Forge Studio 1.5.0 verification contract

Date: 2026-07-29

The required command is:

```bash
npm run release:matrix
```

Evidence is written to `release/matrix-1.5.0/`, bound to the exact Git commit, and every required gate must pass.

## Context & Memory evidence

- SQLite-backed idempotent artifact pins scoped to a real project and principal.
- Bounded history, memory, citation, TTL, freshness, and role-budget snapshot with a canonical receipt.
- Context artifact scope checks before pinning and byte-range reads for content inspection.
- Freshness verification that can mark active memory stale when cited files change or TTL expires.
- Authenticated HTTP routes for snapshot, pin, unpin, and freshness verification.
- Lazy UI with History, Artifacts, Memory, and Budgets panels plus real approve/revoke/purge actions through governed APIs.
- Dedicated `context-memory-governance` release gate.
- A 160 KB eager-shell ceiling plus mandatory lazy-loading checks for every large Control Center.
- Futuristic visual-layer markers and a reduced-motion regression gate.

The full matrix also runs every prior governance, runtime, ForgeOS, SDK, IDE, audit, benchmark, reconstruction, packaging, and archive-integrity gate.
