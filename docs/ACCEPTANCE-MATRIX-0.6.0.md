# Forge Studio 0.6.0 Acceptance Matrix

Tài liệu này biến checklist sản phẩm người dùng cung cấp thành cổng nghiệm thu có trạng thái rõ ràng. “Đạt” chỉ được dùng khi source hiện tại có implementation và kiểm thử; “một phần” ghi rõ phần còn thiếu; các khả năng cloud/enterprise không được giả vờ là đã hoàn thành.

| # | Nhóm tiêu chuẩn | Trạng thái 0.6.0 | Bằng chứng/phạm vi |
|---:|---|---|---|
| 1 | Kiến trúc nền tảng | **Đạt phần lõi** | Lõi agent, Electron UI, storage và ForgeOS tách lớp; local-first; Windows package. Linux/macOS source-compatible nhưng chưa có artifact đã kiểm chứng; cloud là giai đoạn sau. |
| 2 | Mục tiêu sản phẩm | **Đạt phần lớn** | Khảo sát codebase, plan/edit/test/debug/review/docs/browser/recovery/parallel tasks có luồng thật. PR/CI/deploy preview phụ thuộc provider/tool và chưa có connector sản phẩm đầy đủ. |
| 3 | Các chế độ sử dụng | **Đạt một phần** | Chat, read/plan/autopilot/review/debug/test/refactor/architecture/background/multi-agent/local model có nền tảng. Enterprise và cloud sandbox chưa hoàn chỉnh. |
| 4 | Giao diện người dùng | **Đạt desktop/API, thiếu IDE/SDK** | Electron chat-first, task/session/progress/terminal/file/diff/test/log/plan/browser/permissions/model/MCP/secrets/cost/context/memory/agents/review. VS Code/JetBrains, Python/TS SDK và web cloud dashboard chưa phát hành. |
| 5 | Agent runtime cốt lõi | **Đạt** | Loop, schema tools, permissions, budgets, progress, checkpoints, tracing/events, usage, file/command/test records, cleanup and recovery are implemented. |
| 6 | Trạng thái agent | **Đạt phần lớn** | Durable project/goal/mission/task/run/provider/tool/usage/checkpoint/worktree/evidence state. Organization/user cloud tenancy fields are intentionally absent from local release. |
| 7 | Vòng đời tác vụ | **Đạt** | Normalize, discovery, instructions, plan, worktree, execute, verify, review, report, recover and cleanup are explicit states. |
| 8 | Task specification | **Đạt phần lớn** | Objective, constraints, path ownership, tools, network/autonomy/budget/risk/stop conditions are represented. Performance/security criteria are supported as acceptance/evidence requirements rather than dedicated fields everywhere. |
| 9 | Bộ lập kế hoạch | **Đạt** | DAG, dependencies, parallelism, risk, reversible steps, test requirements, plan revisions and verified completion. |
| 10 | Bộ quản lý context | **Đạt phần lớn** | Bounded role-specific ContextPacks, retrieval, compaction, stale-hash checks, provenance, secret filtering and omissions. Full vector paging is optional rather than mandatory. |
| 11 | Repository discovery | **Đạt phần lớn** | Language/framework/package/build/test/config/instructions/Git/entry points are detected. Database/deploy/environment inference varies by ecosystem and remains extensible. |
| 12 | File hướng dẫn agent | **Đạt phần lớn** | AGENTS.md, CLAUDE.md, Cursor/Windsurf/project rules, inheritance, provenance, hash cache and security precedence. Formal public schema/import graph is partial. |
| 13 | Codebase intelligence | **Đạt một phần mạnh** | Incremental file/symbol/import/test index, lexical/regex/symbol ranking and snippets. Complete LSP reference/call/inheritance/Git-history semantic graph is not yet implemented. |
| 14 | Công cụ đọc file | **Đạt** | Bounded reads, line ranges, hashes, binary/secret/symlink/path policy, paging and audit receipts. |
| 15 | Công cụ tìm kiếm | **Đạt phần lớn** | File/content/regex/symbol/config/test/diff/log search and ranking. Full definition/reference queries depend on language tooling not yet universal. |
| 16 | Công cụ chỉnh sửa file | **Đạt phần lớn** | Create/write/unified patch/atomic multi-file discipline, hash preconditions, scope and rollback. AST-specific replace/insert is not universal. |
| 17 | Patch engine | **Đạt phần lớn** | Unified diff validation, path/hash/hunk checks, atomicity, dry-run/reverse/rollback and newline safety. Native three-way merge and rename synthesis are partial. |
| 18 | Terminal và shell tool | **Đạt** | ConPTY, streaming, stdin, resize, timeout/cancel, bounded output, argv execution, path/permission control, process cleanup and redaction. |
| 19 | Phân loại lệnh nguy hiểm | **Đạt phần lớn** | Risk categories and autonomy policies cover file/Git/network/credential/deploy/destructive/outside-workspace actions. OS-specific firewall/service/admin classifiers are conservative hard stops. |
| 20 | Sandbox | **Đạt local worktree/process boundary** | Task/agent worktrees, scoped filesystem, environment, budgets, timeout, network policy and receipts. Strong namespace/container/cloud isolation is not complete on every OS. |
| 21 | Local sandbox | **Đạt một phần** | Worktree/process isolation, ConPTY, path/symlink controls, trusted/untrusted profiles. Docker/Podman/WSL/Job Object enforcement is not a complete cross-platform matrix. |
| 22 | Cloud sandbox | **Chưa đạt** | Architecture allows remote workers, but provisioning, tenant isolation, region/data residency and remote preview are not a shipped 0.6 feature. |
| 23 | Hệ thống quyền | **Đạt phần lớn** | Tool/path/project/goal/browser/MCP/secret/network scopes, allow/deny, one-time/session/autopilot decisions and audit. Organization policy UI is not shipped. |
| 24 | Guardrails | **Đạt phần lớn** | Input/tool/patch/shell/network/secret/budget/schema/completion controls with codes and recovery. Specialized SQL/deploy guards require dedicated connectors. |
| 25 | Secret management | **Đạt local** | Windows Credential Manager, aliases, injection, redaction, diff scanning and provider ownership. Enterprise external vault/rotation integrations are not shipped. |
| 26 | Git integration | **Đạt phần lớn** | Status/diff/branch/worktree/checkpoints/commit/review/rollback/merge queue. Hosted GitHub/GitLab/Bitbucket PR APIs are not complete product connectors. |
| 27 | Worktree và đa nhiệm | **Đạt** | Task/agent worktrees, branch/base tracking, ownership, leases/fencing, conflict prevention, bounded parallelism and cleanup. |
| 28 | Test engine | **Đạt phần lớn** | Related tests, automatic verification, diff check, unit/integration/e2e commands, failure parsing and evidence. Universal flaky/visual/performance/security test adapters are extensible, not all built in. |
| 29 | Debugger agent | **Đạt quy trình, một phần công cụ** | Systematic hypothesis/reproduction/regression workflow and logs are supported. Native debugger/profiler/bisect automation varies by project. |
| 30 | Linter, formatter và type checker | **Đạt** | Project commands, changed-file scope, structured receipts and no out-of-scope autofix policy. |
| 31 | Build system | **Đạt** | Detected commands, bounded execution, logs, failure evidence and distinction from test completion. |
| 32 | Dependency management | **Đạt policy, một phần intelligence** | Lockfile/package-manager preservation, network approval and receipts. Automated maintenance/license/vulnerability scoring is not comprehensive. |
| 33 | Browser và computer-use | **Đạt phần lớn** | Official Playwright CLI, headed/persistent sessions, DOM/accessibility, screenshot, console/network, responsive/actions and explicit write grants. Payment/publish remain hard stops. |
| 34 | Hiểu hình ảnh và giao diện | **Đạt một phần** | Screenshots and visual evidence are supported; complete automated pixel/layout diagnosis and visual regression orchestration are not yet universal. |
| 35 | Web research | **Đạt phần lớn** | HTTP cache, extraction, domain diversity, provenance, prompt-injection labeling and browser research. Search-provider availability depends on configured keys. |
| 36 | MCP và hệ thống công cụ mở rộng | **Đạt stdio, một phần remote** | JSON-RPC stdio, discovery, schema validation, namespace, timeout/cancel/cache/permissions/receipts. Streamable HTTP, OAuth and full resources/prompts UI are incomplete. |
| 37 | Tool registry | **Đạt phần lớn** | Unique IDs, schemas, risk, permissions, timeout, idempotency, source, health and enablement. Package signatures/usage analytics are partial. |
| 38 | Tool execution layer | **Đạt** | Argument/schema/policy/budget/timeout/events/stream/redaction/artifact/receipt/cancel/retry boundaries are implemented. |
| 39 | Model gateway | **Đạt phần lớn** | OpenAI, Anthropic, Gemini, compatible/local, CLI/Codex, streaming/tools/structured output/retry/fallback/usage. Azure/Bedrock/Vertex require compatible adapters/configuration and are not all first-class UI cards. |
| 40 | Model router | **Đạt phần lớn** | Capability/cost/latency/privacy/health routing, fallback and circuit breaker with reasons. Internal benchmark-based routing is early. |
| 41 | Prompt system | **Đạt phần lớn** | Role-specific prompts, trusted/untrusted labels, constraints and versioned context. Formal A/B production management UI is not shipped. |
| 42 | Structured output | **Đạt** | Versioned schemas for plan/actions/events/errors/handoffs/evidence/checkpoints with validation and identifiers. |
| 43 | Event bus | **Đạt** | Durable task/plan/model/tool/file/command/test/agent/checkpoint/budget/guardrail/artifact events. |
| 44 | Streaming protocol | **Đạt phần lớn** | SSE/WebSocket, sequence resume, dedup, buffering, backpressure, bounded event size and separate artifacts. Binary live artifact channel is limited. |
| 45 | Session management | **Đạt phần lớn** | Create/resume/pause/fork-like recovery, repository/branch/worktree binding, history, tools, plan, checkpoints, usage and archive data. Encryption/access control is local-user scoped. |
| 46 | Bộ nhớ | **Đạt phần lớn** | Working/session/project/task/convention/error memory with provenance/confidence/status/TTL and quarantined promotion. Organization memory is not shipped. |
| 47 | Tóm tắt và compaction | **Đạt phần lớn** | Bounded summaries preserve constraints/errors/commands/tests/paths/approvals and original artifacts. Automated summary quality scoring is basic. |
| 48 | Multi-agent orchestration | **Đạt phần lớn** | Coordinator/scout/builder/reviewer/integrator roles, isolated context/tools/budgets/worktrees, structured handoffs, lineage and bounded spawn. |
| 49 | Kiểu điều phối đa agent | **Đạt các mẫu chính** | Planner-executor, reviewer-executor, researcher-implementer, fan-out/fan-in and sequential DAG. Unbounded debate is intentionally excluded. |
| 50 | Agent scheduler | **Đạt local** | Priority/dependency/concurrency/leases/heartbeat/retry/cancel/resume and resource-aware bounded scheduling. Distributed queue/region scheduling is not shipped. |
| 51 | Background agent | **Đạt một phần** | Interval/repository-change goals, isolated budgets/policies/history and no-overlap. GitHub issue/PR/CI/security webhook triggers need cloud connectors. |
| 52 | Workflow và skill system | **Đạt phần lớn** | Versioned Forge skills plus Claude-compatible skills/agents/commands, project activation, source hash and capability review. Signed curated public marketplace is not production-ready. |
| 53 | Hooks | **Quarantine only** | Hook metadata is detected but executable community hooks are intentionally not run in 0.6. A governed hook runtime with timeout/schema/audit remains future work. |
| 54 | Human-in-the-loop | **Đạt** | Impact/risk/scope/commands/rollback, pause/stop/manual control and remembered safe workspace grants; hard stops remain explicit. |
| 55 | Error handling | **Đạt phần lớn** | Structured codes, cause, retryability, severity, next action, fallback/circuit breaker/degraded states and safe redaction. |
| 56 | Chống vòng lặp | **Đạt** | Turn/tool/time/token/repetition/progress/strategy limits, checkpoint rollback, provider fallback and bounded reviewer escalation. |
| 57 | Checkpoint và rollback | **Đạt phần lớn** | Git/worktree/task/plan/context/test checkpoints and safe rollback. Database/deployment snapshot connectors are not general-purpose yet. |
| 58 | Observability và tracing | **Đạt phần lớn** | Task/session/agent/model/tool/command/patch/test/handoff/guardrail spans, timing, usage, metadata, search and user projection. External trace exporters are limited. |
| 59 | Logging | **Đạt local** | Structured redacted application/agent/tool/shell/security/audit/performance logs with IDs. Central retention/alerts require enterprise backend. |
| 60 | Metrics | **Đạt nền tảng, thiếu dashboard đầy đủ** | Usage, latency, success/failure, tools, files/tests and budgets are recorded. Long-term product analytics and satisfaction dashboards are incomplete. |
| 61 | Evaluation system | **Đạt harness cơ bản** | Deterministic fake models/tools, repository-state assertions and eval runner exist. A broad public/hidden multi-OS benchmark corpus and release leaderboard remain incomplete. |
| 62 | Reviewer agent | **Đạt** | Independent review context, diff/tests/security/scope/evidence checks and power to reject completion. |
| 63 | Security reviewer | **Đạt một phần** | Secret/path/command/prompt/tool/exfiltration/supply-chain checks. Full SAST rules for every web vulnerability class are not built in. |
| 64 | Performance | **Đạt phần lớn** | Lazy assets/tools/index/plugins, incremental parsing, caching, bounded parallel reads, streaming/truncation and UI budget tests. |
| 65 | Token và chi phí | **Đạt phần lớn** | Per-task/goal/provider/agent budgets, usage/cost estimates, warnings, hard stops, routing and context dedup. Exact billing varies by provider. |
| 66 | Database và lưu trữ | **Đạt local subset** | SQLite tables for projects/goals/missions/tasks/sessions/messages/plans/runs/tools/evidence/usage/memory/plugins/settings/audit. Cloud users/orgs/billing/RLS/object/vector services are not shipped. |
| 67 | Artifact system | **Đạt phần lớn** | Diff/log/test/screenshot/plan/report/trace artifacts with hashes and references. Video/build binary lifecycle and remote object storage are limited. |
| 68 | API backend | **Đạt local versioned subset** | Authenticated local project/task/session/provider/goal/browser/plugin/settings/streaming APIs with validation. Cloud auth/billing/admin/webhooks/SDK generation are not shipped. |
| 69 | Worker architecture | **Đạt local process separation** | Electron UI, utility runtime, native PTY/credential helpers and bounded tasks are separated. Distributed queues/autoscaling/regions are not shipped. |
| 70 | Desktop app | **Đạt Windows developer preview** | Electron project/thread/agent/workroom/browser/artifact/permission/model/secret/update/recovery UI. Code signing and physical OS verification remain. |
| 71 | IDE extension | **Chưa đạt** | VS Code extension is intentionally deferred until daemon and protocol stabilize. |
| 72 | CLI | **Đạt một phần** | Slash command registry, source one-shot/server operation and diagnostics exist. A polished standalone interactive/non-interactive distributable CLI and shell completion are not shipped. |
| 73 | Configuration system | **Đạt phần lớn** | User/project/local layers, precedence, validation, provenance, protected keys and effective settings. Organization layer awaits enterprise backend. |
| 74 | Authentication | **Đạt model/provider auth, thiếu product account auth** | Codex/Claude official login, API keys and local credential storage. Email/SSO/SAML/passkey application accounts are not relevant to local-only release and not shipped. |
| 75 | Team và enterprise | **Chưa đạt** | Organizations, RBAC, SSO/SCIM, central policy, compliance and tenant isolation require a cloud control plane. |
| 76 | Privacy | **Đạt local-first phần lớn** | Data minimization, local-only models, secret/PII redaction, bounded context and user-controlled integrations. Enterprise retention/region/legal workflows are not shipped. |
| 77 | Reliability production | **Đạt local phần lớn** | Health/readiness, provider fallback, retries, circuit breakers, idempotency, event dedup, recovery, update rollback and graceful shutdown. Distributed failover/DR/status page are not shipped. |
| 78 | Testing hệ thống agent | **Đạt mạnh cho local source** | 254 Studio tests plus ForgeOS/native/smoke/package gates cover state, policy, MCP, browser, Git, recovery, Electron and packaging. Physical Windows/macOS/Linux, load and long soak matrices remain. |
| 79 | Báo cáo cuối | **Đạt** | Summary, file changes, tests/build/review/evidence, risks, unfinished work, rollback, branch/commit/artifacts, token/time and unverified items. |

## Quy tắc phát hành

- Không tuyên bố vượt Codex/Claude nếu chưa có benchmark đối chứng cố định.
- Không chuyển mục “một phần” thành “đạt” chỉ vì có nút UI hoặc schema.
- Mọi capability mới phải có policy ForgeOS, test, recovery và observability.
- Cloud, IDE và enterprise được phát hành thành sản phẩm con riêng; không làm phình lõi local.
- Ma trận này phải được cập nhật ở mỗi release và được dùng làm regression scope.
