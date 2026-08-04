# Forge Studio 2.15.0 Adversarial Weakness Matrix

This matrix intentionally distrusts feature-count and release-gate success. A row is considered closed only when the production path, resource behavior, failure behavior, and user-visible evidence are all verified.

## Measured baseline

- Unpacked source: 122,012,533 bytes.
- `vendor/`: 87,381,072 bytes.
- embedded NolaneNative archive: 67,431,284 bytes.
- `src/app.mjs`: 171 static imports and 192 `new` expressions.
- HTTP server constructor: roughly 65 optional service dependencies.
- Eight eager SQLite-backed subsystem stores are constructed in `src/app.mjs` before the HTTP server starts.
- UI: 16 lazy centers, 19 rail buttons, 36 `<section>` surfaces.
- SSE: SQLite catch-up query every 250 ms per connected client.
- Measured cold start in the review environment: 1.0806 s; idle backend RSS: 119,380 KiB; 82 file descriptors; 11 threads.
- `docs/ARCHITECTURE.md` and `docs/SECURITY.md` still identify themselves as 0.6.0 documents.

## Priority matrix

| ID | Priority | Weakness | Evidence | Failure mode | Remediation | Planned release |
|---|---|---|---|---|---|---|
| W01 | P0 | Eager application composition | `src/app.mjs` imports and constructs almost every optional subsystem; enterprise/cloud stores open unconditionally | idle resource cost, large dependency hub, slow changes, broad conflict surface | adaptive microkernel, lazy module factories, lifecycle state and bounded unload | 2.16.0 |
| W02 | P0 | Process-only resource governor | `ResourceGovernor` considers process RSS/event-loop/output but not system available memory | Windows/IDE/browser/compiler exhaust the machine before Forge enters brownout | system memory sampler, emergency state, profile-aware admission and module shedding | 2.16.0 |
| W03 | P0 | Defaults are not 8-GB-first | defaults: 2 agents, 4 terminals, 12 editor models, 1 MB output, 10,000 events | aggregate memory and UI pressure even when each limit appears reasonable | auto/lite/balanced/performance profiles; lite is default on low-memory machines | 2.16.0 |
| W04 | P0 | SSE polls SQLite four times per second | `/events` uses `setInterval(send, 250)` | needless DB wakeups and scaling cost for long-running sessions | durable event hub push + catch-up + slow reconciliation heartbeat | 2.16.0 |
| W05 | P0 | Repository intelligence has fragmented schedulers | multiple index services and portable watcher; no single CPU/I/O budget owner | duplicate scans and UI contention after edits | incremental intelligence scheduler, hash queue, cancellation, governor integration | 2.17.0 |
| W06 | P0 | Provider fan-out can become process fan-out | CLI providers spawn per call while app-server is persistent | multi-agent can multiply Codex/Claude/Gemini processes | provider process pool and logical-session multiplexing | 2.17.0 |
| W07 | P0 | Review coverage is still model-led | review services exist, but no deterministic file selection/bundling/rule/position/reflection pipeline | skipped files, unstable coverage, inaccurate review locations | OCR-inspired deterministic review harness with coverage ledger | 2.17.0 |
| W08 | P1 | Swarm graph is mostly submitted up-front | `runGraph()` executes dependency-ready jobs but workers do not own a dynamic task market | churn, duplicate work, no adaptive ownership or planner reconciliation | dynamic task market, symbol ownership, uncertainty-based stop and reconciler | 2.18.0 |
| W09 | P1 | Polyglot structural intelligence is uneven | deepest AST patch/relationship paths are JS/TS-centric; Tree-sitter runtime lacks managed grammar fleet evidence | weak impact analysis outside JS/TS | managed grammars plus LSP/build/runtime/coverage fusion | 2.19.0 |
| W10 | P1 | Browser verification is a toolset, not a complete journey loop | browser open/screenshot actions exist; no mandatory build→journey→DOM/a11y/network/console→repair→replay contract | frontend can pass code tests while user flow is broken | browser journey verifier and demonstration artifacts | 2.20.0 |
| W11 | P1 | UX has too many peer-level centers | 16 centers and 19 rail buttons | cognitive overload and weak mission narrative | Mission / Work / Evidence primary surfaces; advanced centers become contextual drawers | 2.21.0 |
| W12 | P1 | Release package is monolithic | source contains 65 MB NolaneNative ZIP and 93 MB vendor tree | download/update/antivirus/extraction cost | core package plus optional NolaneNative/browser/enterprise/docs packs | 2.16.0 |
| W13 | P1 | Architectural documentation is stale | architecture/security titles remain 0.6.0 | maintainers reason from obsolete boundaries | generated current architecture/security inventories and version-coherence gate | 2.16.0 |
| W14 | P1 | Core files are dependency hubs | routes 87.9 KB, app 75.6 KB, store 44.9 KB, agent loop 41.3 KB, UI app 39.5 KB | difficult isolation, conflicts and hidden coupling | route groups, module factories, store repositories, agent-loop stages | staged from 2.16.0 |
| W15 | P1 | External lifecycle stops before real hosted review/CI repair | 56 external gates include PR, CI, preview, remote runtimes | local completion is not repository delivery | provider adapters and hosted lifecycle receipts | after local runtime hardening |
| W16 | P2 | Visual effects are not profile-governed | blur, shadows, animated backgrounds and live graphs remain available on low-end GPU | frame drops in Electron on integrated GPUs | reduced-motion/blur/animation policy tied to runtime profile and frame monitor | 2.16.0 |

## Open Code Review lessons applied

Forge Studio should copy the engineering principle, not merely invoke another generic reviewer:

1. deterministic file selection;
2. related-file bundling with isolated review contexts;
3. rule matching before model invocation;
4. independent location validation;
5. reflection/deduplication after the model;
6. explicit coverage accounting;
7. bounded concurrency based on resources.

These belong in W07 and must reuse Forge Studio evidence, permission, worktree and completion receipts instead of becoming an ungoverned external command.
