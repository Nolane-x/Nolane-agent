# Local Operations & Human Control Center Design

## Goal

Ship Forge Studio 2.13.0 with one authenticated local operations surface that completes image viewing, call-graph viewing, Git history, cost management, command editing before execution, manual takeover, sandbox retain/release, controlled cache, and malicious-content sanitization.

## Architecture

`LocalOperationsCenterService` is project- and principal-bound. It composes existing image, code-intelligence, Git, mission-state, command-governance, and sandbox services without exposing workspace roots or raw shell input. It emits canonical SHA-256 receipts for every projection or state transition.

A new UI center lazy-loads six tabs: Images, Call Graph, Git History, Cost, Human Control, and Cache. Binary image responses use an authenticated, project-contained route. All untrusted text is sanitized before projection and rendered with `textContent` only.

## Components

1. `ContentSanitizer`: removes control characters, strips bidi overrides, bounds size, marks prompt-injection patterns, and never interprets HTML.
2. `ControlledLocalCache`: SQLite-backed entries scoped by project/principal/namespace, TTL, byte quota, LRU eviction, hash verification, explicit purge, and durable receipts.
3. `LocalOperationsCenterService`: image metadata/content, LSP call graph projection, bounded local Git history, cost ledger summary, editable command candidate creation, manual takeover, sandbox retain/release, and cache status.
4. Authenticated HTTP routes with no caller-supplied workspace root.
5. `local-operations-center.js/css` lazy-loaded from the main application shell.
6. Release verifier and full-matrix gate.

## Safety and Truthfulness

- Images must be regular project-contained files with signature validation and size/pixel bounds.
- Call graph is LSP-derived and must expose unresolved/unavailable states instead of inventing edges.
- Git history is local-only, read-only, bounded, and rendered as untrusted text.
- Cost manager reports recorded usage only; it does not estimate unrecorded provider billing.
- Editing a command creates a new candidate fingerprint and invalidates prior approval reuse.
- Manual takeover revokes autonomous execution for the selected run; resume requires an explicit later action.
- Retained sandboxes keep enforcement and TTL; release closes the lease and may terminate the attached process tree.
- Cache entries are never shared across principals or projects and cannot store plaintext secrets.

## Testing

Use TDD for sanitizer/cache, service behavior, routes/app wiring, UI, audit movement, release verifier, portable packaging, full Node suite, and Full Release Matrix.
