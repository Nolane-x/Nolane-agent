# Forge Studio 2.16.0 — adversarial weakness matrix

This matrix does not treat feature-audit status as proof of architectural strength. It records measured weaknesses, the 2.16.0 response and remaining exposure.

| Area | Direct evidence before 2.16 | Severity | 2.16 response | Remaining weakness | Next action |
|---|---|---:|---|---|---|
| Eager application composition | 171 static imports, 192 constructor expressions, enterprise/cloud stores opened at startup | P0 | Module manager; enterprise/cloud first-use activation; 157 imports, 177 constructors | Many essential and optional services still share `app.mjs` | Convert browser, semantic graph, MCP and plugins into separate modules; split composition roots |
| Host memory pressure | Governor primarily reacted to process RSS and event-loop delay | P0 | System available-memory sampling; Lite defaults; emergency unload policy | Child-process/provider/browser memory is not yet attributed per mission | Process-tree accounting, provider/browser pools and mission memory budgets |
| Multi-agent process cost | Subagents can multiply provider/browser/terminal processes | P0 | Lite profile defaults to one active agent and zero idle browsers | Provider runtime multiplexing is incomplete | Persistent provider host with logical sessions and adaptive concurrency |
| Repository intelligence load | Multiple indexes can compete on large repositories | P0 | Lite profile makes semantic work on-demand; module emergency policy can suspend optional work | Full incremental priority scheduler not unified across all indexes | Content-hash queue, cancellation, I/O/CPU budget and shared graph update journal |
| SSE database polling | SQLite queried every 250 ms per client | P1 | Commit-time event hub; 5 s reconciliation; 15 s heartbeat | In-process hub is single-node only | Durable cursor broker for multi-process/remote mode |
| UI/GPU cost | Many blur, aurora, orbit and graph animations | P1 | Runtime reduced-effects policy; optional visuals suspended; terminal batching to 30 FPS | Navigation still exposes many centers | Collapse UI into Mission, Work and Evidence shells; virtualize long lists |
| Distribution weight | 128 MB unpacked; vendor 93 MB; NolaneNative ZIP 67,431,284 bytes | P1 | NolaneNative moved to separate verified pack; Core includes only provenance | ForgeOS/docs/other optional packs remain bundled | Core/ForgeOS/Browser/Enterprise/Docs pack manifest and updater |
| Architecture file size | routes/app/store/loop/UI files remain large | P1 | Eager imports reduced and enterprise composition extracted | Conflict surface and test isolation remain poor | Split routes by bounded context, composition factories, storage repositories and UI shell |
| Dynamic swarm | Existing graph execution is bounded but planner cannot freely add/revoke/reconcile work | P1 | Not addressed in this release | Static ownership and conflict resolution can cause churn | Dynamic task market, symbol ownership, uncertainty stop conditions and reconciler |
| Polyglot intelligence | Deep AST remains strongest for JS/TS | P1 | Not addressed in this release | Python/Rust/Go/Java/C/C#/Kotlin/Swift/PHP/Ruby depth incomplete | Managed Tree-sitter grammar packs + LSP/build/runtime/coverage fusion |
| Browser journey verification | Browser primitives exist without a complete demo-repair-replay loop | P1 | Not addressed in this release | Frontend completion can over-rely on code tests | Playwright journey receipts: DOM, a11y, network, console, screenshot and video |
| Hosted lifecycle | Push/PR/CI/deploy gates remain external | P1 | Remain explicitly external | End-to-end Issue→PR→CI→repair is incomplete | Provider adapters with least privilege and human merge gate |
| Open Code Review lessons | Review coverage, file selection, rule scopes and delegation need deterministic orchestration | P1 | Used as design evidence, not run because environment lacked network/config | No operational OCR receipt for this source tree | Add local review adapter and compare findings against reviewer ensemble |

## Acceptance rule

A row is not closed by adding a class or UI. Closure requires source behavior, direct tests, a release gate, raw measurement and explicit non-claims. The next recommended release is provider/browser/index pooling and dynamic work scheduling, not another dashboard.
