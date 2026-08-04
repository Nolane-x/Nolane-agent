# ForgeOS v0.2.0 — Audit Remediation Matrix

This document maps every finding from the [ForgeOS v0.1.0 Vietnamese audit](audits/forgeos-v0.1-audit-vi.md) to the v0.2.0 implementation status. It is intentionally stricter than a changelog: **FIXED** means the reported invariant or overclaim has a regression test or an explicit capability correction; **MITIGATED** means the risk is reduced but not eliminated; **OPEN** means the limitation remains and is part of the published trust boundary.

## Summary

| Status | Findings |
|---|---:|
| Fixed | 163 |
| Mitigated | 11 |
| Open | 16 |
| **Total** | **190** |

## Remaining architectural limits

- The local revisioned JSON store is durable and conflict-aware, but not a distributed database.
- Remote identity supports authenticated principals and scoped bearer mappings, but not project-level multi-tenant IAM/SSO.
- Third-party skill execution is not sandboxed by ForgeOS.
- TLS is expected at a trusted reverse proxy.
- Cryptographic signed provenance is represented as an assurance evidence requirement, but ForgeOS does not yet operate a signing PKI.
- The Studio exposes lineage data and dependencies, but does not yet render a fully interactive graph or semantic idea-cluster map.
- Documentation-only adapters are not presented as executable or vendor-certified.
- The first-party catalog currently uses output ownership rather than curated explicit skill-conflict pairs.
- Snapshots are retained for recovery, but there is not yet a public point-in-time restore command.

## Full finding matrix

| Finding | Status | Audit title | v0.2 evidence / boundary |
|---|---|---|---|
| FOS-001 | **FIXED** | Race condition làm mất update trong cùng một process | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-002 | **FIXED** | Khóa chỉ có hiệu lực trong một instance Node.js | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-003 | **FIXED** | Không có revision, ETag hoặc compare-and-swap | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-004 | **FIXED** | `read()` tin tưởng tuyệt đối nội dung file | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-005 | **FIXED** | `update()` không validate trạng thái project sau mutation | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-006 | **FIXED** | Một file project hỏng làm hỏng toàn bộ `list()` | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-007 | **FIXED** | Không có migration cho `schemaVersion` | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-008 | **FIXED** | Atomic rename chưa bảo đảm durability sau mất điện | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-009 | **MITIGATED** | Không có backup, snapshot, rollback hoặc corruption recovery | Mitigated: bounded pre-write snapshots and corrupt-file quarantine exist; a public point-in-time restore/rollback command is not yet implemented. |
| FOS-010 | **OPEN** | Toàn bộ project bị đọc/clone/stringify/ghi lại cho mỗi mutation | Open: project state is still rewritten as one aggregate; revision/CAS prevents corruption but large-project storage compaction remains future work. |
| FOS-011 | **OPEN** | `routes` và `history` tăng vô hạn | Open: route/history are bounded in new router writes, but a general configurable retention/compaction service is not yet implemented. |
| FOS-012 | **FIXED** | Export trả đường dẫn filesystem cục bộ thay vì artifact tải được | `tests/project-store-invariants.test.mjs`, `src/core/project-store.mjs`, `src/core/project-validator.mjs` |
| FOS-013 | **OPEN** | Không có tenant isolation hoặc authorization theo project | Open: authenticated principals exist, but project ACL and tenant isolation are not yet implemented. |
| FOS-014 | **FIXED** | Gate cũ có thể mở khóa stage mới sau khi dữ liệu đã thay đổi | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-015 | **FIXED** | `runCurrentGate()` có race giữa read và write | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-016 | **FIXED** | Mọi mutation liên quan không tự làm stale gate | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-017 | **FIXED** | Gate chấp nhận artifact `invalidated` hoặc `superseded` | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-018 | **FIXED** | Evidence rỗng vẫn đủ để vượt verification gate | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-019 | **FIXED** | Gate chỉ kiểm tra sự hiện diện, không kiểm tra chất lượng proof | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-020 | **FIXED** | Evidence không gắn với artifact hoặc project revision cụ thể | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-021 | **FIXED** | Gate attach toàn bộ evidence ID thay vì evidence theo rule | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-022 | **FIXED** | Assurance A0 và A4 không khác nhau về hành vi gate | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-023 | **FIXED** | `critical` finding chặn nhưng `high` finding có thể không chặn | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-024 | **FIXED** | Đóng finding không xác thực evidence resolution | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-025 | **FIXED** | “Human confirmation” chỉ là chuỗi đoán được | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-026 | **FIXED** | `acceptedBy` là dữ liệu caller tự khai báo | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-027 | **FIXED** | `selectIdea()` luôn ghi `decidedBy: 'human'` | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-028 | **OPEN** | Stage transition không khóa các command không phù hợp stage | Open: irreversible and selection operations are stage/approval constrained; a universal per-command stage policy table is not yet complete. |
| FOS-029 | **FIXED** | Released project vẫn có thể bị mutation tự do | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-030 | **FIXED** | Gate ID dựa trên thời gian có nguy cơ collision | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-031 | **FIXED** | Catch-all trong rule evaluation có thể che bug code thành “rule fail” | `tests/proof-invariants.test.mjs`, `tests/approval-security.test.mjs`, `src/core/gates.mjs` |
| FOS-032 | **OPEN** | Equal weighting tạo điểm số có vẻ chính xác nhưng thiếu semantics | Open: blockers override score, but non-blocking gate rules still use a simple completion percentage. |
| FOS-033 | **FIXED** | Public API không có đường đi hợp lệ tới release | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-034 | **FIXED** | Artifact lifecycle helpers tồn tại nhưng không được nối runtime | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-035 | **FIXED** | Artifact ID trùng được chấp nhận | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-036 | **FIXED** | Evidence ID và finding ID trùng cũng được chấp nhận | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-037 | **FIXED** | Hash artifact không canonical | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-038 | **FIXED** | Hash không được tái xác minh khi đọc hoặc verify | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-039 | **MITIGATED** | Artifact content không thực sự immutable | Mitigated: canonical hashes are recomputed on read and lifecycle transitions; local JSON remains physically editable outside the trusted process. |
| FOS-040 | **FIXED** | Missing dependency bị graph bỏ qua âm thầm | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-041 | **FIXED** | Cycle chỉ được phát hiện khi chủ động gọi graph utility | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-042 | **FIXED** | Duplicate graph node chỉ được phát hiện muộn | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-043 | **FIXED** | Supersession không được validate chặt | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-044 | **FIXED** | Invalidation không tự chạy khi upstream thay đổi | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-045 | **FIXED** | Gate không phân biệt artifact active và historical | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-046 | **FIXED** | Không có registry schema theo artifact type | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-047 | **OPEN** | `schemaVersion` artifact là chuỗi tự khai báo | Open: artifact types have content registries, but per-type schema-version migration registries are not yet implemented. |
| FOS-048 | **FIXED** | Hai artifact contract không tương thích cùng tồn tại | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-049 | **FIXED** | Reviewer independence chỉ là string comparison | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-050 | **FIXED** | Review evidence/gate reference không được kiểm tra tồn tại và pass | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-051 | **OPEN** | Residual risk và decision references không được xác thực | Open: core dependency/evidence references are validated; residual-risk and arbitrary decision foreign keys are not yet universally enforced. |
| FOS-052 | **FIXED** | Không có active-version uniqueness theo artifact type | `tests/artifact-lifecycle-invariants.test.mjs`, `src/core/artifacts.mjs`, `src/core/graph.mjs` |
| FOS-053 | **OPEN** | Artifact provenance không có chữ ký hoặc principal xác thực | Open: provenance is bound to authenticated principals and content hashes, but no built-in cryptographic signing PKI exists. |
| FOS-054 | **FIXED** | “Semantic fingerprint” thực chất là hash của chuỗi normalize | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-055 | **FIXED** | Tuyên bố “compared at mechanism level” chưa được runtime chứng minh | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-056 | **FIXED** | Fingerprint bị truncate còn 64 bit | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-057 | **FIXED** | Logic fingerprint bị lặp ở nhiều module | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-058 | **FIXED** | Duplicate score cho cùng idea vẫn vượt gate | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-059 | **FIXED** | Không bắt buộc đúng một score cho mỗi idea | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-060 | **MITIGATED** | Điểm số hoàn toàn do caller tự khai báo | Mitigated: exact coverage, idea hash, evaluator identity, and rubric version are enforced; score values still originate from an evaluator/host. |
| FOS-061 | **FIXED** | Không kiểm tra provenance và freshness của score | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-062 | **FIXED** | Selection có thể xảy ra trước scoring hoặc sai stage | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-063 | **FIXED** | `saveIdeas()` thay toàn bộ ideas nhưng không invalidate downstream | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-064 | **FIXED** | Selected idea không được liên kết bắt buộc với artifact downstream | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-065 | **FIXED** | Clustering novelty chỉ là exact fingerprint grouping | `tests/idea-engine-invariants.test.mjs`, `src/core/idea-fingerprint.mjs`, `src/core/scoring.mjs` |
| FOS-066 | **FIXED** | 242 skill không tạo thành graph nối được | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-067 | **FIXED** | Toàn bộ 255 output type không có consumer | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-068 | **FIXED** | Có 23 input type không có producer | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-069 | **FIXED** | Không có producer cho nhiều artifact mà gate yêu cầu | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-070 | **FIXED** | Test tên “every skill is connected” là false positive | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-071 | **FIXED** | Không có reachability test từ intent tới release | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-072 | **FIXED** | `handoff.next = "router-selected"` không trỏ tới skill thật | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-073 | **FIXED** | Router không thật sự dùng gate failures để remediate | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-074 | **FIXED** | Tuyên bố “scores missing artifacts” chưa đúng với runtime | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-075 | **FIXED** | Tuyên bố “risk-aware router” chưa đúng | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-076 | **FIXED** | Candidate skills không bị quarantine trong runtime | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-077 | **FIXED** | Utility mặc định 0.5 và không được học tự động | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-078 | **FIXED** | Router không biết skill đã thực sự được thực thi hay chưa | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-079 | **FIXED** | Tool availability feature là giả về dữ liệu catalog | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-080 | **OPEN** | Conflict handling feature là giả về dữ liệu catalog | Open: the router enforces declared conflicts, but the first-party v0.2 catalog intentionally declares no speculative conflict pairs. Output ownership and active-version uniqueness prevent competing writes; explicit method-conflict curation remains future work. |
| FOS-081 | **FIXED** | `forge_next_action` bỏ qua tham số `tools` | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-082 | **FIXED** | `project.domain = all` làm domain packs khó được chọn | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-083 | **FIXED** | Domain tùy ý có thể phá routing | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-084 | **FIXED** | Invalidated artifact vẫn được đưa vào router context | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-085 | **FIXED** | Router load toàn bộ nội dung 242 skill mỗi lần | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-086 | **FIXED** | Không có cache/index catalog | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-087 | **MITIGATED** | Estimated token chỉ là metadata tự khai báo | Mitigated: context estimates are generated from actual skill body size, but are not provider-specific tokenizer measurements. |
| FOS-088 | **MITIGATED** | Skill generated có tính template cao nhưng được mô tả “method-specific” mạnh | Mitigated: generated cells now have typed methods and gates; not every one of 242 skills is claimed as independently hand-authored or empirically promoted. |
| FOS-089 | **FIXED** | Router chỉ trả tên/score/reason, không trả skill instruction | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-090 | **FIXED** | Route không phải minimal execution plan | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-091 | **FIXED** | Không có downstream invalidation ảnh hưởng router | `tests/skill-graph-invariants.test.mjs`, `tests/skill-run-invariants.test.mjs`, `src/router/planner.mjs` |
| FOS-092 | **FIXED** | Cho gọi tool trước `initialize` | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-093 | **FIXED** | Không negotiate protocol version | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-094 | **FIXED** | Header `MCP-Protocol-Version` không được validate | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-095 | **FIXED** | `GET /mcp` trả 404 thay vì transport behavior phù hợp | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-096 | **FIXED** | Không validate Origin | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-097 | **FIXED** | Không kiểm tra `Accept` theo Streamable HTTP | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-098 | **FIXED** | Không có `Mcp-Session-Id` hoặc session lifecycle | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-099 | **FIXED** | Notification có thể nhận response lỗi | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-100 | **FIXED** | `initialized` không thiết lập state thật | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-101 | **FIXED** | Tool input schema chỉ để quảng bá, không dùng runtime validation | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-102 | **FIXED** | Required prompt/tool arguments không được enforcement thống nhất | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-103 | **MITIGATED** | Output schemas quá rộng | Mitigated: every tool has runtime input/output validation; some nested route/project payloads intentionally remain extensible objects. |
| FOS-104 | **FIXED** | Không có pagination cho tools/resources/prompts | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-105 | **FIXED** | Error nội bộ có thể bị trả trực tiếp | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-106 | **MITIGATED** | Không có request timeout/rate limit/concurrency guard | Mitigated: rate limits, body limits, session TTL, and timeouts exist; a distributed admission-control queue is not included. |
| FOS-107 | **FIXED** | Tool annotation `readOnlyHint` sai | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-108 | **FIXED** | Export annotation cũng không phản ánh side effect | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-109 | **MITIGATED** | MCP resource UI là static snapshot, không gắn project/tool result | Mitigated: Studio consumes tool structured content and host state updates; the initial MCP resource remains a bootstrap document. |
| FOS-110 | **FIXED** | `.mcp.json`/adapter command khởi chạy HTTP server nhưng không có stdio loop | `tests/mcp-lifecycle-invariants.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/server/stdio.mjs` |
| FOS-111 | **FIXED** | Khai báo A2A 1.0 nhưng wire format là kiểu cũ | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-112 | **FIXED** | Agent Card tự mâu thuẫn với implementation | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-113 | **FIXED** | `stateTransitionHistory: true` nhưng không có persisted task history | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-114 | **FIXED** | A2A “Create project” không tạo project thật | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-115 | **FIXED** | `context.forge` không được sử dụng | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-116 | **FIXED** | `tasks/get` không hỗ trợ task retrieval thật | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-117 | **FIXED** | Không có task cancellation | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-118 | **FIXED** | Không có streaming/push notification implementation | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-119 | **FIXED** | Không có A2A authentication/authorization identity mapping | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-120 | **FIXED** | Không validate A2A payload bằng schema v1 | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-121 | **FIXED** | Agent Card endpoint có thể bị Host header poisoning | `tests/a2a-v1-invariants.test.mjs`, `src/server/a2a.mjs`, `src/server/a2a-task-store.mjs` |
| FOS-122 | **FIXED** | Docker bind `0.0.0.0` trong khi API key là tùy chọn | `tests/security.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/core/security.mjs` |
| FOS-123 | **OPEN** | Không có TLS ở runtime | Open: the built-in server is HTTP; production deployment requires TLS termination. |
| FOS-124 | **OPEN** | Một API key có toàn quyền | Open: multiple token-to-principal mappings and scopes exist, but project-level ACL/RBAC is not complete. |
| FOS-125 | **FIXED** | Không có rate limiting và brute-force protection | `tests/security.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/core/security.mjs` |
| FOS-126 | **OPEN** | Không có structured audit log theo authenticated principal | Open: actions record authenticated principals and request IDs; a separate append-only tamper-evident security log is not yet included. |
| FOS-127 | **FIXED** | Secret detector bỏ sót nhiều loại credential | `tests/security.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/core/security.mjs` |
| FOS-128 | **FIXED** | Secret detector có thể lỗi trên giá trị JSON không stringify được | `tests/security.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/core/security.mjs` |
| FOS-129 | **FIXED** | Evidence URI không được kiểm tra scheme/trust | `tests/security.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/core/security.mjs` |
| FOS-130 | **FIXED** | Public base URL phụ thuộc untrusted Host header | `tests/security.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/core/security.mjs` |
| FOS-131 | **FIXED** | Không có timeout/header timeout/connection limit rõ ràng | `tests/security.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/core/security.mjs` |
| FOS-132 | **FIXED** | Error responses chưa có stable public error model | `tests/security.test.mjs`, `tests/http-protocol-invariants.test.mjs`, `src/core/security.mjs` |
| FOS-133 | **OPEN** | Không có sandbox cho tool/skill execution | Open: ForgeOS does not execute arbitrary third-party code and does not provide an executor sandbox. |
| FOS-134 | **FIXED** | Eval Lab không tự chạy behavioral cases | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-135 | **FIXED** | Forbidden patterns không được kiểm tra tự động | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-136 | **FIXED** | Candidate metrics có thể được caller bịa | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-137 | **FIXED** | Không có bounds validation đầy đủ cho eval metrics | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-138 | **FIXED** | `compareRuns()` không đảm bảo cùng tập case | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-139 | **FIXED** | Không có variance, seed, confidence interval hoặc flaky detection | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-140 | **OPEN** | Không có judge calibration hoặc blind evaluation | Open: deterministic evaluators and confidence intervals exist; LLM-judge calibration/blinding is provider-dependent and not built in. |
| FOS-141 | **FIXED** | Eval decision không cập nhật catalog status | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-142 | **FIXED** | Eval không cập nhật `skillUtility` | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-143 | **FIXED** | `release:verify` không tạo/kiểm tra freshness của release evidence report | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-144 | **FIXED** | Verification report hardcode nhiều số/chuỗi | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-145 | **FIXED** | Existing residual-risk report đánh giá thấp lỗi protocol/integrity | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-146 | **FIXED** | Không có end-to-end public release test | `tests/eval-runner-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-147 | **FIXED** | JSON Schemas không được dùng để validate runtime payload | `tests/schema-boundaries.test.mjs`, `src/core/runtime-schemas.mjs`, `src/core/project-validator.mjs` |
| FOS-148 | **FIXED** | Project schema quá permissive | `tests/schema-boundaries.test.mjs`, `src/core/runtime-schemas.mjs`, `src/core/project-validator.mjs` |
| FOS-149 | **FIXED** | Evidence schema thiếu format constraints | `tests/schema-boundaries.test.mjs`, `src/core/runtime-schemas.mjs`, `src/core/project-validator.mjs` |
| FOS-150 | **FIXED** | Skill schema không bắt buộc các field router phụ thuộc | `tests/schema-boundaries.test.mjs`, `src/core/runtime-schemas.mjs`, `src/core/project-validator.mjs` |
| FOS-151 | **FIXED** | A2A schema phản ánh shape cũ trong khi metadata nói v1 | `tests/schema-boundaries.test.mjs`, `src/core/runtime-schemas.mjs`, `src/core/project-validator.mjs` |
| FOS-152 | **FIXED** | MCP result schema generic không bảo đảm output contract | `tests/schema-boundaries.test.mjs`, `src/core/runtime-schemas.mjs`, `src/core/project-validator.mjs` |
| FOS-153 | **FIXED** | Không có cross-field/cross-record validation | `tests/schema-boundaries.test.mjs`, `src/core/runtime-schemas.mjs`, `src/core/project-validator.mjs` |
| FOS-154 | **FIXED** | “Schema validator” trong sơ đồ kiến trúc không có runtime tương ứng đầy đủ | `tests/schema-boundaries.test.mjs`, `src/core/runtime-schemas.mjs`, `src/core/project-validator.mjs` |
| FOS-155 | **FIXED** | Dashboard chỉ hiển thị project đầu tiên | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-156 | **FIXED** | Nút gọi tool nhưng bỏ kết quả và không rerender | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-157 | **FIXED** | Không có loading, disable hoặc error state | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-158 | **FIXED** | Route cards là nội dung tĩnh, không điều khiển execution | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-159 | **OPEN** | Artifact lineage chỉ là danh sách phẳng | Open: Studio renders dependencies, hashes, states, and versions, but not an interactive node-edge canvas. |
| FOS-160 | **FIXED** | Risk console hiển thị findings, không dùng `risks` | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-161 | **FIXED** | Proof ledger chỉ hiển thị nhãn, không hiển thị proof | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-162 | **OPEN** | Novelty engine UI không có semantic cluster | Open: mechanisms and fingerprints are visible; interactive semantic cluster visualization remains roadmap work. |
| FOS-163 | **FIXED** | Stage rail đánh dấu stage trước là pass theo index | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-164 | **FIXED** | UI không hiển thị hash, invalidation và residual risks đầy đủ | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-165 | **FIXED** | Standalone fullscreen/action có chức năng giả hoặc no-op | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-166 | **FIXED** | `openai:set_globals` không cập nhật project content | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-167 | **FIXED** | CSP dùng `unsafe-inline` | `tests/studio-v2.test.mjs`, `src/ui/forge-studio.mjs`, `tests/http-protocol-invariants.test.mjs` |
| FOS-168 | **FIXED** | Adapter validator chủ yếu kiểm tra file tồn tại | `tests/adapter-tck-v2.test.mjs`, `scripts/run-adapter-tck.mjs`, `scripts/generate-manifest.mjs` |
| FOS-169 | **FIXED** | Một assertion adapter JSON gần như vô nghĩa | `tests/adapter-tck-v2.test.mjs`, `scripts/run-adapter-tck.mjs`, `scripts/generate-manifest.mjs` |
| FOS-170 | **MITIGATED** | ChatGPT adapter “implemented” nhưng evidence không chứng minh integration thật | Mitigated: MCP Apps behavior is protocol-tested and documented; no claim of ChatGPT vendor certification is made. |
| FOS-171 | **FIXED** | TCK capability là dữ liệu tự khai báo | `tests/adapter-tck-v2.test.mjs`, `scripts/run-adapter-tck.mjs`, `scripts/generate-manifest.mjs` |
| FOS-172 | **MITIGATED** | Không có contract test trên từng host adapter | Mitigated: nine executable configs run the stdio TCK; six host packs are explicitly documentation-only. |
| FOS-173 | **FIXED** | Project manifest đánh dấu tất cả file `verified` chỉ vì đọc/hash được | `tests/adapter-tck-v2.test.mjs`, `scripts/run-adapter-tck.mjs`, `scripts/generate-manifest.mjs` |
| FOS-174 | **FIXED** | Manifest version/source metadata có thể hardcode và stale | `tests/adapter-tck-v2.test.mjs`, `scripts/run-adapter-tck.mjs`, `scripts/generate-manifest.mjs` |
| FOS-175 | **FIXED** | “15 adapters” là số lượng pack, không phải 15 integration đã verified | `tests/adapter-tck-v2.test.mjs`, `scripts/run-adapter-tck.mjs`, `scripts/generate-manifest.mjs` |
| FOS-176 | **FIXED** | Coverage cao nhưng không kiểm tra invariant | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-177 | **FIXED** | Không có deterministic concurrency regression test | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-178 | **FIXED** | Không có stale-gate regression test | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-179 | **FIXED** | Không test artifact state trong gate | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-180 | **FIXED** | Không test evidence quality | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-181 | **FIXED** | Không test exact score coverage | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-182 | **FIXED** | Skill connectivity test không dựng graph | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-183 | **FIXED** | MCP tests xác nhận behavior nội bộ thay vì conformance | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-184 | **FIXED** | A2A tests xác nhận shape cũ trong khi claim v1 | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-185 | **FIXED** | Adapter tests không chạy adapter | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-186 | **FIXED** | Schema tests không validate real positive/negative instances | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-187 | **FIXED** | Smoke test quá nông | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-188 | **FIXED** | Không kiểm tra release evidence khớp commit/test hiện tại | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-189 | **FIXED** | Không có fuzz/property tests cho state machine | `tests/*-invariants.test.mjs`, `tests/public-lifecycle-e2e.test.mjs`, `scripts/release-verify.mjs` |
| FOS-190 | **MITIGATED** | Không có negative security tests đủ sâu | Mitigated: negative protocol, approval, secret, origin, session, schema, and lifecycle tests were added; security testing remains an ongoing process. |
