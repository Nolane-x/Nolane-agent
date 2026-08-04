# Forge Studio 2.13.0 verification contract

A 2.13.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Local Operations & Human Control gate

`local-operations-human-control` must prove:

- project-contained image inspection and authenticated no-store binary delivery with content hashes;
- LSP-backed, sanitized call-graph projection with explicit unavailable evidence;
- bounded and sanitized local-only Git history;
- recorded-usage-only mission cost summaries;
- command edits with validated argv, a fresh fingerprint, and no reusable prior approval;
- manual takeover that pauses the governed mission run;
- bounded sandbox retain/release controls, retention TTL, and continuing resource enforcement;
- plain-text hostile-content sanitization with control/bidi removal, flags, and receipts;
- controlled cache project/principal/namespace isolation, TTL, quota, LRU, secret denial, purge, and receipts;
- authenticated bounded API routes and a six-tab text-safe lazy UI;
- item-level audit evidence for all ten checklist requirements;
- explicit non-claim boundaries in `docs/LIMITATIONS-2.13.0.md`;
- inclusion in source reconstruction and release packaging.

All verification evidence is bound to the exact Git commit and written beneath `release/matrix-2.13.0/`.
