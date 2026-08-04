# Forge Studio 2.13.0 release notes

## Local Operations & Human Control Center

Forge Studio now provides a single authenticated local operations surface for evidence viewing and explicit human intervention. Images are inspected within the configured project root and served through an authenticated binary endpoint with content hashes. Call graphs are projected from the existing language-server intelligence and preserve unavailable states rather than inventing edges. Git history is read from the local repository only, sanitized as untrusted content, bounded, and receipt-bound. Cost summaries use the mission-state usage ledger already recorded by Forge Studio.

A command revision creates a new validated executable/argv candidate and a new fingerprint with `approvalReusable=false`; it never mutates an already-approved command. Manual takeover pauses the mission through the run coordinator. Local sandbox leases can be retained for a bounded TTL or released explicitly while the resource watchdog remains active. A controlled SQLite cache adds project/principal/namespace isolation, TTL, byte quota, LRU eviction, plaintext-secret denial, purge operations, and canonical receipts. Repository-derived text passes through a plain-text sanitizer that removes control and bidi override characters and flags prompt-injection and HTML-like patterns.

## Audit movement

Ten checklist items move from partial to source-and-test verified: 4.22, 4.24, 4.25, 4.32, 4.43, 4.44, 5.32, 5.33, 14.18, and 20.9. Exact counts are generated in `docs/feature-audit-2.13.0.json`; every remaining non-verified item appears in `docs/REMAINING-GAPS-2.13.0.md`.
