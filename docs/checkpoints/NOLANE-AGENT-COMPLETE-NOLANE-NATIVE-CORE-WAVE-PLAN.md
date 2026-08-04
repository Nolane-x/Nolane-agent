# Nolane Agent — Complete NolaneNative-to-Nolane Native Core Wave Plan

**Baseline:** Nolane Agent 5.0.0-beta.6  
**Mục tiêu:** Viết lại toàn bộ hành vi core còn có giá trị của NolaneNative thành kiến trúc Nolane-native, loại bỏ mọi phụ thuộc runtime vào NolaneNative, và chỉ tuyên bố parity khi từng contract có implementation, production wiring, test âm, scenario receipt và bằng chứng môi trường thật.

## 1. Trạng thái xuất phát

Beta.6 hiện có:

- 75 behavioral contract;
- 52 contract verified local;
- 23 contract external;
- 2.110 upstream candidate path được theo dõi;
- 413 path verified local;
- 1.697 path còn thuộc external certification;
- Master Acceptance Ledger: 1.420 canonical, 1.324 verified, 96 external;
- Full Release Matrix: 134/134 pass.

Điều này **không có nghĩa còn thiếu 1.697 tính năng**. Nhiều path là UI component, adapter cụ thể, test upstream hoặc phần triển khai của cùng một hành vi. Đơn vị triển khai chính thức là behavioral contract, còn path/SHA-256 là bằng chứng coverage.

## 2. Nguyên tắc không được vi phạm

1. **Clean-room behavioral rewrite:** nghiên cứu contract và hành vi, không đổi tên hoặc chép source NolaneNative thành mã Nolane.
2. **Nolane-owned architecture:** module, schema, event, receipt và lifecycle phải được thiết kế theo kiến trúc Nolane.
3. **Không proof bằng file tồn tại:** một module chỉ verified khi có production entrypoint, direct test, negative test và evidence hash mới.
4. **Không xanh hóa theo regex rộng:** mỗi upstream path phải được ánh xạ vào đúng behavioral contract.
5. **External không đồng nghĩa hoàn tất:** adapter có code local nhưng chưa chạy với dịch vụ thật vẫn phải giữ certification gate.
6. **Fail-closed:** secret, OAuth, browser write, remote execution, messaging và updater phải từ chối khi thiếu permission hoặc proof.
7. **Không lưu hidden reasoning:** chỉ lưu public state, action, effect, verifier result và receipt.
8. **Mọi wave phải phát hành hoàn chỉnh:** regression → independent lanes → clean commit → full matrix → package → checksum → archive scan → clean-room → reconstruction.

## 3. Definition of Done cho một contract core

Một contract chỉ được chuyển sang `verified` khi đáp ứng đủ:

- implementation Nolane-native;
- không import hoặc thực thi NolaneNative;
- API có kiểu và version;
- production wiring qua orchestration/app/server/Electron hoặc TUI;
- persistence/restart nếu contract có state;
- timeout, cancellation và resource budget;
- concurrency/idempotency nếu có mutation hoặc delivery;
- redaction và credential-reference-only;
- direct conformance test;
- negative/malicious test;
- scenario end-to-end;
- evidence SHA-256 mới;
- full release matrix pass.

## 4. Các wave đã hoàn thành

### Wave 0 — Truth Reset và Inventory — Hoàn thành trong beta.2

- Kiểm toán 7.617 upstream entry.
- Phân loại core/excluded.
- Pin 2.110 behavior path bằng SHA-256.
- Tạo Native Core Catalog và Master Acceptance Ledger.
- Loại phép suy diễn “14 replacement file = complete parity”.

### Wave 1 — Native Foundation Fabrics — Hoàn thành trong beta.2

- Agent turn kernel.
- Context/prompt fabric.
- Provider fallback.
- Tool/execution fabric.
- Session/memory/learning.
- Plugin/MCP/scheduler/subagent.
- Gateway/API/product projection.
- Operations/security.
- Adapter TCK, Mixture-of-Agents và Goal Evidence Contract.

### Wave 2 — Runtime Protocol và Repository — Hoàn thành trong beta.3

- ACP streaming.
- Provider protocol normalization.
- Repository intelligence.
- Delegation context.
- Browser action boundary.
- Gateway lifecycle.
- Shared command surface.
- Usage accounting.

### Wave 3 — Agent, Session, Governance, Profile, OAuth — Hoàn thành trong beta.4

- Agent behavior runtime.
- Session lifecycle/search/export/branching.
- Tool governance.
- Profile configuration.
- OAuth security runtime.

### Wave 4 — Kanban, Observability, Skills và Dashboard — Hoàn thành trong beta.5

- Persistent Kanban core.
- Local observability.
- Skill bundle/preprocessing.
- Dashboard auth/drain mode.
- Session search.
- Cron contract.
- JSON fast path.

### Wave 5 — MCP OAuth, Browser Supervisor và Recovery — Hoàn thành trong beta.6

- MCP OAuth lifecycle.
- Browser supervisor/dialog recovery.
- Async delegation live log.
- PTY session/retry.
- Gateway recovery/watchdog.
- Local media/playback pipeline.

---

# PHẦN CÒN LẠI

## Wave 6 — Residual Contract Decomposition

**Phiên bản mục tiêu:** `5.0.0-beta.7`  
**Mục tiêu:** Xóa toàn bộ chín contract residual dạng catch-all và thay bằng contract hành vi nhỏ, có tên, có owner và điều kiện nghiệm thu riêng.

### Contract hiện tại phải được tách

- `NATIVE-RESIDUAL-TOOL_EXECUTION-CERTIFICATION`
- `NATIVE-RESIDUAL-SESSIONS-CERTIFICATION`
- `NATIVE-RESIDUAL-GATEWAY_INTEGRATIONS-CERTIFICATION`
- `NATIVE-RESIDUAL-ACP_API-CERTIFICATION`
- `NATIVE-RESIDUAL-MEDIA_VOICE-CERTIFICATION`
- `NATIVE-RESIDUAL-OBSERVABILITY_OPERATIONS-CERTIFICATION`
- `NATIVE-RESIDUAL-SECURITY-CERTIFICATION`
- `NATIVE-RESIDUAL-PRODUCT_SURFACES-CERTIFICATION`
- `NATIVE-RESIDUAL-CONFIGURATION-CERTIFICATION`

### Việc phải làm

1. Cluster upstream path theo hành vi, không theo thư mục.
2. Tạo contract mới cho shell hooks, lazy dependency loading, daemon pool, session stream, correction workflow, gateway remote lifecycle, ACP proxy transport, voice composer, reauthentication, TUI stores, update lifecycle và billing/entitlement policy.
3. Mỗi path chỉ thuộc một contract canonical.
4. Contract không có path phải bị xóa.
5. Billing/marketing không phải core phải được chuyển sang `excluded` bằng quyết định audit có lý do; nếu Nolane cần entitlement thì viết generic Nolane Entitlement Core, không port billing NolaneNative.

### Gate bắt buộc

- `native-core-no-residual-catchall`
- `native-core-single-owner-mapping`
- `native-core-zero-empty-contract`
- `native-core-exclusion-policy`

### Điều kiện thoát

- Không còn pattern residual `^.*$`.
- 2.110/2.110 path vẫn được map.
- Không tăng `unmapped` hoặc `not_implemented`.

## Wave 7 — Complete Tool Execution và Remote Environment Core

**Phiên bản mục tiêu:** `5.0.0-beta.8`  
**Contract chính:** remote execution, tool-execution residual.

### Module Nolane-native cần xây

- `ExecutionBackendTCK`
- `LocalProcessBackend`
- `ContainerBackend` cho Docker/Podman
- `SshExecutionBackend`
- `HostedExecutionBackend` cho Daytona/Modal-like provider contract
- `DaemonPool`
- `LazyDependencyResolver`
- `ToolDispatchPipeline`
- `ShellHookPolicy`
- `McpStdioWatchdog`
- `ExecutionArtifactTransfer`

### Hành vi bắt buộc

- quota CPU/RAM/time/output;
- PTY hoặc non-PTY rõ ràng;
- cancellation truyền đến process tree;
- deterministic teardown;
- upload/download hash;
- no secret in command receipt;
- working directory, symlink và path guard;
- retry chỉ với lỗi retryable;
- remote backend không sẵn sàng phải trả `BACKEND_UNAVAILABLE`.

### Test

- local fixture command;
- Docker fixture nếu daemon có sẵn;
- loopback SSH fixture;
- fake hosted provider chỉ dùng cho protocol conformance;
- process leak test;
- cancellation and timeout test;
- credential isolation test;
- teardown idempotency test.

### Điều kiện thoát

- Toàn bộ logic remote execution được viết Nolane-native.
- `NATIVE-REMOTE-EXECUTION-CERTIFICATION` chỉ còn phần chạy hạ tầng thật, không còn logic core chưa viết.

## Wave 8 — Complete Session và Conversation Product Core

**Phiên bản mục tiêu:** `5.0.0-beta.9`

### Phạm vi

- large-session resume;
- hidden/public history separation;
- message-stream recovery;
- compression và queue stop;
- session switcher;
- virtual session list data model;
- correction workflow;
- undo history;
- context-drift detection;
- context suggestion;
- terminal-session binding;
- session drag/reorder/pin/archive;
- cross-window session ownership.

### Module

- `SessionStreamCoordinator`
- `SessionWindowLeaseRegistry`
- `SessionCompressionService`
- `ConversationCorrectionService`
- `SessionContextDriftEngine`
- `SessionVirtualListModel`
- `SessionTerminalBinding`

### Gate

- restart/resume with 10k-message fixture;
- correction does not expose hidden history;
- compression lineage reproducible;
- queue stop cancels provider and tool work;
- optimistic concurrency conflict does not poison future writes;
- cross-window lease prevents duplicate execution.

## Wave 9 — Complete Provider Transport và ACP/API Core

**Phiên bản mục tiêu:** `5.0.0-beta.10`

### Provider transport phải viết Nolane-native

- OpenAI Responses;
- OpenAI Chat Completions;
- Anthropic Messages;
- Gemini native;
- Bedrock message protocol;
- Azure identity token provider;
- Codex app-server/session;
- local OpenAI-compatible endpoint;
- MCP tools server transport;
- proxy-source contract.

### Core behavior

- unified streaming events;
- partial tool-call assembly;
- structured error taxonomy;
- retry-after/rate-limit rotation;
- credential pool;
- auxiliary model routing;
- usage and cost receipt;
- session multiplexing;
- disconnect/reconnect;
- cancellation;
- schema downgrade/compatibility.

### Tách implementation và certification

- Local protocol simulators chứng minh parser/lifecycle.
- Real credentials chỉ được đóng ở Wave 17.
- Không ghi raw request chứa secret vào evidence.

## Wave 10 — Complete Gateway và Messaging Core

**Phiên bản mục tiêu:** `5.0.0-beta.11`

### Gateway core

- WebSocket probe và reconnect;
- remote lifecycle;
- HMR survivor;
- command manifest;
- pairing và enrollment;
- inbound/outbound normalization;
- attachment/media relay;
- sticker/cache;
- cgroup/process cleanup;
- remote working-directory placeholder;
- platform identity mapping;
- queue, retry và idempotency;
- drain/shutdown/recovery.

### Platform adapters cần có Nolane implementation

- Telegram;
- Discord;
- Slack;
- WhatsApp bridge;
- Matrix;
- Teams;
- Feishu/Lark;
- generic webhook adapter.

### TCK chung

Mỗi adapter phải vượt:

- manifest và permission;
- credential reference;
- receive/send lifecycle;
- attachment size/hash;
- rate limit;
- reconnect;
- duplicate delivery;
- shutdown;
- redaction.

Adapter không có credential thật vẫn giữ external certification đến Wave 17.

## Wave 11 — Full Browser và Computer-Use Engine

**Phiên bản mục tiêu:** `5.0.0-beta.12`

### Runtime cần hoàn thiện

- Playwright backend;
- CDP backend;
- browser profile isolation;
- snapshot/DOM accessibility tree;
- selector resolution;
- click/type/scroll/hover;
- file chooser;
- dialog handling;
- download quarantine;
- screenshot/vision bridge;
- browser crash recovery;
- search provider routing;
- computer-use approval;
- visual effect receipt.

### Security

- host allowlist;
- private network deny by default;
- download MIME/hash scan;
- no arbitrary JavaScript from HTTP clients;
- write action approval;
- maximum navigation/action count;
- sensitive-field masking.

### Test

- local fixture website;
- malicious redirect;
- download traversal;
- dialog storm;
- stale selector;
- crash/restart;
- cancellation;
- replayable browser journey.

## Wave 12 — Memory, Plugin, Scheduler, Kanban và Observability Adapters

**Phiên bản mục tiêu:** `5.0.0-beta.13`

### Memory provider framework

- SQLite local;
- file-backed local;
- vector-store adapter TCK;
- external memory adapter lifecycle;
- conflict/delete/restart semantics;
- provenance và retention.

### Plugin system

- signed plugin package;
- transparency log;
- capability permission;
- lifecycle hooks;
- provider/tool/command contributions;
- hot-disable;
- rollback;
- compatibility version.

### Scheduler/Kanban

- external cron provider adapter;
- durable delivery;
- real clock skew handling;
- Kanban sync/reconnect/conflict;
- duplicate card prevention;
- UI projection receipt.

### Observability

- OTLP-compatible local exporter contract;
- Langfuse-like adapter contract;
- disk cleanup provider;
- disconnect/backpressure;
- redaction and retention.

## Wave 13 — Secret, Auth, Pairing và Trust Core

**Phiên bản mục tiêu:** `5.0.0-beta.14`

### Module

- `SecretProviderTCK`
- environment/file/OS-keychain adapters;
- 1Password-style CLI adapter;
- vault reference resolver;
- OAuth provider registry;
- token refresh/revocation;
- dashboard/session auth;
- gateway pairing;
- boot-failure reauthentication;
- web auth state projection.

### Bắt buộc

- raw secret không bao giờ nằm trong config/snapshot/log;
- state/nonce một lần;
- PKCE;
- redirect allowlist;
- expiry/revocation;
- profile-scoped credential;
- audit without secret;
- key rotation;
- permission downgrade after revoke.

## Wave 14 — Complete Media, Vision và Voice Core

**Phiên bản mục tiêu:** `5.0.0-beta.15`

### Core

- media attachment persistence;
- image generation provider TCK;
- video generation provider TCK;
- transcription provider TCK;
- streaming TTS;
- voice activity detection;
- recorder lifecycle;
- barge-in;
- reference-image validation;
- generated-media UI state;
- clipboard image handling;
- meeting/Spotify integration contract.

### Local engines

- deterministic local audio fixture;
- optional FFmpeg pipeline;
- local transcription/TTS adapter where hardware permits;
- content-addressed output;
- cancellation and byte/time budget.

### External

Real image/video/STT/TTS providers remain external until Wave 17.

## Wave 15 — Complete Product Surfaces và Configuration

**Phiên bản mục tiêu:** `5.0.0-beta.16`

### Shared product model

Electron, web, TUI, CLI và VS Code phải dùng chung:

- session state;
- command registry;
- permission model;
- provider/profile configuration;
- updates;
- tool activity;
- delegation state;
- runtime health;
- evidence viewer.

### Desktop/web/TUI behavior

- session list/switcher;
- composer/voice/image state;
- gateway remote state;
- files/terminal panes;
- settings/profile/toolset;
- onboarding;
- update overlay;
- deep links;
- error/recovery surfaces;
- responsive layout;
- keyboard and screen-reader semantics.

### Configuration core

- bootstrap runner;
- connection config;
- SSH config;
- profile deletion routing;
- updater state/relaunch/rebuild;
- model picker;
- toolset config;
- generic Nolane entitlement policy hoặc explicit exclusion của upstream billing.

### Điều kiện thoát

- Không còn residual product-surface/config contract.
- UI chỉ là projection của shared runtime, không tự giữ core state riêng.

## Wave 16 — Windows Desktop, Installer và Accessibility Certification

**Phiên bản mục tiêu:** `5.0.0-rc.1`

### Contract đóng

- `NATIVE-DESKTOP-WINDOWS-CERTIFICATION`
- `NATIVE-UI-SURFACE-CERTIFICATION`
- `NATIVE-INSTALLER-BOOTSTRAP-CERTIFICATION`
- `NOL-UI-002`, `NOL-UI-030`, `NOL-UI-031`, `NOL-UI-032`

### GitHub Windows matrix

- Windows 11 x64;
- RAM 8 GB labelled runner hoặc máy thật;
- NSIS install/upgrade/uninstall;
- data preservation;
- signed update beta → RC;
- crash recovery;
- startup, RAM, CPU, long-task và input-latency budget;
- screenshots 640/900/1180/1440;
- visual regression;
- keyboard-only;
- Narrator/NVDA checklist;
- reduced motion và zoom 200%.

### Artifact

- signed `.exe`;
- Authenticode receipt;
- update manifest;
- performance JSON;
- accessibility Markdown;
- visual diff bundle;
- machine metadata.

## Wave 17 — Real Provider và Integration Certification Matrix

**Phiên bản mục tiêu:** `5.0.0-rc.2`

### Provider lanes

- OpenAI/Codex;
- Anthropic;
- Gemini;
- Bedrock/Azure nếu credential tồn tại;
- local OpenAI-compatible endpoint.

### Integration lanes

- messaging platforms;
- remote execution providers;
- browser desktop journey;
- memory providers;
- plugin auth;
- external cron;
- Kanban dashboard;
- observability sink;
- secret stores;
- media/voice providers.

### Receipt bắt buộc

Mỗi lane phải có:

- environment and adapter version;
- credential reference ID, không có secret;
- exact request/action sequence;
- rate-limit/retry/cancellation;
- output/effect hash;
- teardown;
- restart/reconnect;
- negative path;
- cost/usage;
- independent verifier.

Không có credential thì lane giữ external; không được thay bằng mock.

## Wave 18 — Provider-Real Dogfood, Adversarial Replay và Parity Freeze

**Phiên bản mục tiêu:** `5.0.0-rc.3`

### Dogfood suite trên Windows

1. Sửa bug có reproduction test.
2. Thêm tính năng có hidden acceptance test.
3. Audit và sửa security issue.
4. Browser/computer-use journey.
5. Multi-agent delegated task.
6. Scheduled/background task.
7. Messaging-triggered task.
8. Media/voice task.
9. Remote execution task.
10. Update/restart/resume task.

### Adversarial replay

- prompt injection;
- tool-result injection;
- secret exfiltration;
- path traversal;
- symlink escape;
- malicious plugin;
- OAuth replay;
- messaging duplicate/reorder;
- browser malicious download;
- provider disconnect;
- worker crash;
- corrupted session store.

### Contract đóng

- `NOL-AUDIT-012`
- mọi external contract đã có credential và môi trường.

## Wave 19 — Final Stable Audit và Nolane 5.0.0

**Phiên bản mục tiêu:** `5.0.0`

### Điều kiện bắt buộc

- Không còn contract residual/catch-all.
- Không còn NolaneNative runtime, archive, route hoặc executable package path.
- 2.110/2.110 path có verified contract hoặc exclusion hợp lệ.
- `not_implemented=0`, `unmapped=0`, `implemented_not_wired=0`.
- External chỉ được phép còn nếu sản phẩm stable công khai rõ adapter chưa hỗ trợ; muốn tuyên bố complete parity thì external phải bằng 0.
- Full release matrix chạy trên Linux và Windows.
- Installer/update signed.
- Provider-real dogfood pass.
- Clean-room source reconstruction pass.
- Every marketing claim links tới receipt.

### Cờ claim

Chỉ được đổi:

```text
completeParityClaimAllowed=true
```

khi:

- toàn bộ 23 external contract hiện tại đã được đóng hoặc được loại khỏi scope core bằng quyết định audit hợp lệ;
- không có external canonical requirement liên quan tới parity;
- independent review xác nhận receipt.

`superiorityClaimAllowed` vẫn phải giữ `false` cho tới khi benchmark đối thủ cùng model, máy, token, quyền và task đạt yêu cầu thống kê.

## 5. Ma trận bao phủ 23 contract external hiện tại

| Contract hiện tại | Wave viết core | Wave chứng nhận thật |
|---|---:|---:|
| Provider real certification | 9 | 17 |
| Remote execution | 7 | 17 |
| Browser/computer use | 11 | 17–18 |
| Memory providers | 12 | 17 |
| Plugin auth | 12–13 | 17 |
| Cron provider | 12 | 17 |
| Kanban dashboard | 12 | 17 |
| Messaging adapters | 10 | 17 |
| Media/voice | 14 | 17–18 |
| Observability plugins | 12 | 17 |
| Secret/auth providers | 13 | 17 |
| Desktop Windows | 15 | 16 |
| UI surfaces | 15 | 16 |
| Installer/bootstrap | 15 | 16 |
| Residual tool execution | 6–7 | 17 |
| Residual sessions | 6–8 | 18 |
| Residual gateway | 6–10 | 17–18 |
| Residual ACP/API | 6–9 | 17 |
| Residual media/voice | 6–14 | 17–18 |
| Residual observability | 6–12 | 17 |
| Residual security | 6–13 | 17–18 |
| Residual product surfaces | 6–15 | 16 |
| Residual configuration | 6–15 | 16 |

## 6. Chuỗi release bắt buộc sau MỌI wave

Không wave nào được kết thúc trước khi hoàn thành đủ:

1. TDD RED → GREEN → refactor.
2. Direct module tests.
3. Production wiring tests.
4. Negative/malicious tests.
5. Native-core catalog và Master Ledger regeneration.
6. Evidence freshness/quality.
7. Full Node regression.
8. Runtime smoke và eval non-claim.
9. VSIX, Go, Python SDK và ForgeOS lanes.
10. Clean Git commit.
11. Full Release Matrix từ commit sạch.
12. Source ZIP, Electron ZIP, update payload, VSIX.
13. Change-set và evidence bundle.
14. SHA-256 toàn bộ artifact.
15. Archive scan cấm NolaneNative runtime/audit module trong package.
16. Clean-room từ đúng source ZIP.
17. Fresh source reconstruction.
18. Release notes, limitations, verification và remaining gaps.

## 7. Thứ tự ưu tiên thực thi

Thứ tự không nên đổi:

1. Wave 6 — xóa residual catch-all.
2. Wave 7 — execution core.
3. Wave 8 — session core.
4. Wave 9 — provider/ACP core.
5. Wave 10 — gateway/messaging.
6. Wave 11 — browser/computer use.
7. Wave 12 — adapter ecosystem.
8. Wave 13 — security/auth/secrets.
9. Wave 14 — media/voice.
10. Wave 15 — product surfaces/configuration.
11. Wave 16 — Windows/UI/installer certification.
12. Wave 17 — provider/integration real certification.
13. Wave 18 — dogfood/adversarial parity freeze.
14. Wave 19 — stable release.

Lý do: phải hoàn tất contract decomposition và runtime logic trước; nếu chạy certification quá sớm, ta sẽ chỉ chứng nhận một abstraction còn thô và phải làm lại toàn bộ receipt sau đó.
