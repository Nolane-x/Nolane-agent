# Nolane Agent — NolaneNative-to-Nolane Native Wave Checkpoint

Checkpoint: **5.0.0-beta.6-wave15-checkpoint.1**

## Trạng thái trung thực

- **Waves 6–15: local core implemented and verified.**
- Behavioral contracts: **115**; verified local: **100**; external: **15**.
- Upstream paths: **2110/2,110 mapped**; verified local: **873**; external certification: **1237**; unmapped: **0**.
- **Waves 16–19: blocked by external certification.**
- Không tuyên bố complete parity hoặc superiority khi chưa có Windows, credential thật, dogfood và independent review.

## Waves 6–15 đã đưa vào checkpoint

| Wave | Phạm vi | Kết quả |
|---:|---|---|
| 6 | Residual contract decomposition | Không còn catch-all; single-owner mapping; zero empty contract |
| 7 | Tool execution và remote environment core | Local process/TCK/daemon/watchdog/artifact transfer; remote adapters fail-closed |
| 8 | Session và conversation core | 10k resume, correction/undo, compression lineage, drift, leases |
| 9 | Provider transport và ACP/API core | Unified protocol parsers, streaming, tool assembly, retry/cancel/cost |
| 10 | Gateway và messaging core | Shared adapter TCK, pairing, idempotency, reconnect, drain |
| 11 | Browser/computer-use core | Isolation, network policy, approval, quarantine, recovery, replay receipts |
| 12 | Memory/plugin/scheduler/Kanban/observability | Local framework cores and negative-path tests |
| 13 | Secret/auth/pairing/trust core | PKCE, one-time state, credential references, revoke downgrade |
| 14 | Media/vision/voice core | Content-addressed media, provider TCK, recorder/VAD/barge-in |
| 15 | Product surfaces/configuration core | Shared state projection and versioned fail-closed configuration |

## External contracts còn mở

- `NATIVE-BROWSER-COMPUTER-USE-CERTIFICATION` — 35 paths (browser-computer-use)
- `NATIVE-CRON-PROVIDER-CERTIFICATION` — 1 paths (scheduler)
- `NATIVE-DESKTOP-WINDOWS-CERTIFICATION` — 679 paths (product-surfaces)
- `NATIVE-INSTALLER-BOOTSTRAP-CERTIFICATION` — 27 paths (configuration)
- `NATIVE-MEDIA-VOICE-CERTIFICATION` — 39 paths (media-voice)
- `NATIVE-MEMORY-PROVIDER-CERTIFICATION` — 29 paths (memory-learning)
- `NATIVE-MESSAGING-PLATFORM-ADAPTERS` — 115 paths (gateway-integrations)
- `NATIVE-OBSERVABILITY-PLUGIN-CERTIFICATION` — 2 paths (observability-operations)
- `NATIVE-PLUGIN-AUTH-CERTIFICATION` — 3 paths (plugin-system)
- `NATIVE-PROVIDER-REAL-CERTIFICATION` — 77 paths (provider-fabric)
- `NATIVE-REMOTE-EXECUTION-CERTIFICATION` — 6 paths (tool-execution)
- `NATIVE-SECRET-AUTH-PROVIDER-CERTIFICATION` — 17 paths (security)
- `NATIVE-SKILL-TOOL-OPERATIONS` — 7 paths (tool-execution)
- `NATIVE-TOOL-INTEGRATION-ADAPTERS` — 21 paths (tool-execution)
- `NATIVE-UI-SURFACE-CERTIFICATION` — 179 paths (product-surfaces)

## Nolane acceptance gaps còn mở

- `NOL-AUDIT-012` — Run provider-real dogfooding on Windows with replayable receipts
- `NOL-UI-002` — Capture a machine-labelled Windows 8 GB performance and visual baseline
- `NOL-UI-030` — Meet WCAG 2.2 AA, keyboard, focus, live-region and reduced-motion requirements
- `NOL-UI-031` — Meet responsive desktop layouts from 640 px through 1440 px and above
- `NOL-UI-032` — Pass DOM, memory, idle CPU, long-task, latency and visual release budgets

## Wave 16–19 gate

- Wave 16 cần Windows 11 x64 8 GB được gắn nhãn, NSIS install/upgrade/uninstall, Authenticode, visual/performance/accessibility receipts.
- Wave 17 cần credential reference và receipt môi trường thật cho provider/integration; mock không được chấp nhận.
- Wave 18 cần chạy đủ 10 dogfood scenario và adversarial replay trên Windows.
- Wave 19 chỉ mở khi external contract = 0, Nolane gap = 0 và independent parity review pass.

Checkpoint receipt SHA-256: `7c3b70410f6ac53120a52fd8413e83bd01cbc3e313d6509e984ad2ae05f08d9a`

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`

