# ForgeOS v0.3.0 — v0.2 Deep Audit Remediation Matrix

> This matrix maps all 197 findings from the independent v0.2 deep audit to the v0.3 Trust Kernel. **FIXED** means the reported behavior is covered by code and a regression/conformance test. **MITIGATED** means the attack surface or claim was narrowed, but the underlying production property is not fully solved. **OPEN** remains an explicit boundary.

**Summary:** 105 fixed · 11 mitigated · 81 open.

## Highest-impact changes

- Fenced, heartbeat-backed process leases and commit-time ownership checks.
- Hash-chained aggregate audit, durable verified snapshots, and approval-gated public restore.
- Deterministic v0.1/v0.2→v0.3 migrations with legacy proof downgraded to unverified.
- Trusted evidence providers: callers request execution; providers issue content-addressed receipts.
- Artifact content/envelope hashes, slots, assurance-aware lifecycle, and two-way lineage.
- Append-only assurance gates and trusted skill-run/eval receipts.
- Project ACLs across MCP, A2A, HTTP Studio, export, recovery, review, and release operations.
- Archive-first verification, extracted-archive acceptance testing, SBOM, and detached Ed25519 provenance support.

## Full matrix

| Finding | Status | v0.3 disposition |
|---|---|---|
| FOS2-001 — `npm run release:verify` thất bại ngay trên gói ZIP chính thức | **FIXED** | Node-only dashboard capture and archive-first verifier. |
| FOS2-002 — Verifier tiếp tục phụ thuộc `.git` sau khi sửa quyền thực thi | **FIXED** | Git metadata is optional; source manifest is authoritative. |
| FOS2-003 — Verifier sửa đổi cây làm việc trước khi kiểm tra Git | **FIXED** | Generated evidence is written under immutable dist run directories. |
| FOS2-004 — `git diff --check` không chứng minh cây nguồn sạch | **FIXED** | Canonical source content is hashed (text line endings normalized; binary bytes exact); dirty Git is a policy input. |
| FOS2-005 — `dirtyAtStart` chỉ được ghi nhận, không chặn release | **FIXED** | Dirty source fails the default release policy. |
| FOS2-006 — Commit/tree không ràng buộc nội dung thực sự đã chạy | **FIXED** | Verification binds the actual source manifest. |
| FOS2-007 — Pipeline dừng ở lỗi đầu tiên | **FIXED** | Independent checks continue and all results are reported. |
| FOS2-008 — Báo cáo có thể tồn tại với `status: pass` từ môi trường khác nhưng không chứng minh ZIP hiện tại | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-009 — Không có chữ ký hay attestation kiểm chứng nguồn | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-010 — Ảnh dashboard phụ thuộc renderer/môi trường nhưng không có chuẩn tái lập đầy đủ | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-011 — Evidence được sinh trong source tree thay vì artifact output | **FIXED** | Generated evidence is separated from source baselines. |
| FOS2-012 — Không có test “install from release archive” | **FIXED** | Archive acceptance runner installs and verifies extracted packages. |
| FOS2-013 — Khóa cross-process có thể bị cướp và gây mất update | **FIXED** | Token-owned lease, heartbeat and fencing regression test. |
| FOS2-014 — Chủ khóa cũ có thể xóa khóa của chủ mới | **FIXED** | Only the current lease token may release the lock. |
| FOS2-015 — CAS chỉ bảo vệ khi mọi writer đi qua cùng cơ chế | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-016 — Snapshot được ghi trực tiếp, không theo atomic-write path | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-017 — Snapshot có thể ghi nhận revision chưa bao giờ commit | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-018 — Có snapshot nhưng không có API restore công khai | **FIXED** | Public list/verify/restore tools with checksum and human approval. |
| FOS2-019 — Mỗi mutation đọc/clone/serialize toàn aggregate | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-020 — Nhiều collection vẫn tăng không giới hạn | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-021 — No-op update vẫn tăng revision và ghi file | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-022 — Revision và semanticRevision là số trong file, không có MAC/hash chain | **FIXED** | Project events are hash-chained and validated on read. |
| FOS2-023 — Quarantine bỏ qua file hỏng nhưng không cung cấp workflow sửa chữa | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-024 — Durability semantics phụ thuộc filesystem | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-025 — Không có transaction nhiều project | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-026 — Không có lock/transaction metrics | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-027 — Project v0.1 có artifact thật không migrate được | **FIXED** | Real v0.1 artifact fixture migrates and validates. |
| FOS2-028 — Evidence v0.1 bị gán revision 0 trái schema mới | **FIXED** | Legacy evidence becomes revision-valid but unverified. |
| FOS2-029 — Legacy principal thiếu `roles` | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-030 — Test migration dùng fixture quá sạch | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-031 — Migration tính lại artifact hash nhưng không lưu hash cũ | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-032 — Không có migration journal/backup tự động | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-033 — Không kiểm tra migration idempotent và deterministic trên dữ liệu thật | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-034 — Chỉ có nhánh tổng quát `version <= 2` thay vì chuỗi migration | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-035 — Agent có thể tự tạo evidence `pass` giả | **FIXED** | PASS cannot be supplied by a caller. |
| FOS2-036 — Cùng agent có thể mở rồi đóng critical finding bằng evidence tự khai | **FIXED** | Critical findings require trusted proof and independent closer. |
| FOS2-037 — `sha256` chỉ được kiểm tra định dạng, không kiểm tra nội dung | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-038 — `method.kind` là chuỗi tùy ý | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-039 — Không có policy ai được tạo evidence loại nào | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-040 — Artifact producer có thể tạo evidence cho chính artifact | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-041 — Finding closer chỉ cần authenticated principal | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-042 — Evidence không có payload bắt buộc | **FIXED** | Trusted provider stores and hashes proof payloads. |
| FOS2-043 — `semantic:false` khi thêm evidence có thể giữ approval/gate sống ngoài ý định | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-044 — Approval không bind toàn bộ payload hành động | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-045 — Không có API revoke/purge approval rõ ràng | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-046 — `sourceCommit` do caller tự khai | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-047 — Research evidence bị sao chép sang `research` | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-048 — Assurance chỉ yêu cầu tên evidence type | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-049 — Timestamp do server tạo nhưng không có trusted time/order | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-050 — README nói “một record security-review không phải proof” nhưng runtime vẫn gần như vậy | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-051 — Artifact hash không bao phủ state/provenance/review/verification | **FIXED** | Artifact envelope hash covers lifecycle and provenance. |
| FOS2-052 — Cho phép draft → verified, bỏ qua review | **FIXED** | A1+ verification requires review. |
| FOS2-053 — Không kiểm tra role reviewer/verifier | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-054 — Kiểm tra độc lập chỉ dựa principal ID | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-055 — Artifact registry chỉ kiểm tra top-level field tối thiểu | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-056 — Một active artifact duy nhất theo `type` gây nghẽn composition | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-057 — Replacement chỉ ghi `old.supersededBy`, không ghi `new.supersedes` | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-058 — Supersede chưa nối chặt với outputCandidateIds của skill run | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-059 — `invalidates` trong skill contract không được runtime thực thi tổng quát | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-060 — `decisions` chỉ là danh sách ID không được kiểm tra đầy đủ | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-061 — `residualRisks` và evidence refs không nằm trong content hash | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-062 — Review notes/verification metadata có thể sửa tại rest | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-063 — DAG kiểm tra tồn tại/cycle nhưng không kiểm tra version compatibility | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-064 — Invalidation/supersession transitions chưa được formal hóa toàn cục | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-065 — Hầu hết artifact gate chấp nhận cả `draft` | **FIXED** | Artifact-state requirements vary by assurance. |
| FOS2-066 — Chỉ release dossier bắt buộc verified | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-067 — A0 và A1 có profile runtime giống nhau | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-068 — README mô tả evidence level mạnh hơn code | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-069 — Assurance evidence chỉ là label | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-070 — Implementation gate yêu cầu evidence nhưng planner nhắm artifact `verified-build` | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-071 — `verification-report` vừa là artifact type vừa là evidence type | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-072 — Rerun gate thay thế kết quả cũ cùng stage | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-073 — Gate score là tỷ lệ rule bằng trọng số | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-074 — `completelyMissing` dựa trên dữ liệu toàn project, không rule-specific | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-075 — Approval bind semanticRevision nhưng không bind input digest | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-076 — Released project protection dựa vào API option nội bộ | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-077 — `forge_project_export` luôn lỗi qua MCP | **FIXED** | Public MCP export DTO is conformance-tested. |
| FOS2-078 — `forge_skills_route` luôn lỗi output | **FIXED** | Route DTO is conformance-tested. |
| FOS2-079 — `forge_next_action` luôn lỗi output | **FIXED** | Next-action DTO is conformance-tested. |
| FOS2-080 — Tool có thể mutate rồi mới bị output validator từ chối | **FIXED** | Public conformance matrix catches serialization before retry loops. |
| FOS2-081 — Public lifecycle test bypass một phần MCP output validation | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-082 — Nhiều output dùng `freeObject` | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-083 — `forge_skills_route` route hai lần | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-084 — Một số read-only/idempotent semantics cần audit lại | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-085 — Client chỉ nhận lỗi output chung chung | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-086 — Tool schema được viết tay tách khỏi runtime schemas | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-087 — MCP cursors là offset base64 không ký | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-088 — Initialize HTTP session được tạo trước khi params được chấp nhận | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-089 — Principal B có thể xóa MCP session của principal A | **FIXED** | Session deletion is owner- and version-bound. |
| FOS2-090 — DELETE không yêu cầu `MCP-Protocol-Version` | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-091 — Session chỉ expire khi được truy cập | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-092 — Rate-limit bucket không được dọn | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-093 — Không expose `Mcp-Session-Id` cho browser | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-094 — `.env.example` dùng sai tên biến origin | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-095 — Default allowed origin dùng full base URL thay vì origin | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-096 — `publicBaseUrl` cho phép credentials/query/fragment/path | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-097 — Docker mặc định không khởi động | **FIXED** | Docker entrypoint generates authenticated ephemeral credentials. |
| FOS2-098 — Network guard chỉ ở CLI main | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-099 — CSP connect/image destinations rộng | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-100 — `requestTimeout` không hủy operation phía dưới | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-101 — Session Map theo process cản horizontal scaling | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-102 — Version negotiation initialize quá cứng | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-103 — Duplicate `notifications/initialized` bị bỏ qua | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-104 — A2A file store mất update giữa hai instance | **FIXED** | A2A file store serializes with fenced revisions. |
| FOS2-105 — Create task có TOCTOU duplicate race | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-106 — Temp filename có thể collision trong cùng ms | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-107 — Queue cleanup so sánh sai Promise | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-108 — MemoryA2aTaskStore.list() ném lỗi | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-109 — Memory store update không serialize | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-110 — `historyLength: 0` trả toàn bộ history | **FIXED** | historyLength=0 returns an empty history. |
| FOS2-111 — ListTasks đọc và parse toàn bộ task trước pagination | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-112 — Page token offset không ổn định | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-113 — Task hỏng bị list bỏ qua âm thầm | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-114 — Task file không được runtime schema validate | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-115 — `task.defer` không có worker/queue thực | **FIXED** | Deferred work has a real leased scheduler. |
| FOS2-116 — Cancel không abort action đang chạy | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-117 — Store không enforce legal task transitions | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-118 — A2A chỉ expose sáu action nhỏ | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-119 — `GetExtendedAgentCard` tồn tại khi capability false | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-120 — Agent Card quảng bá `/docs` nhưng endpoint trả 404 | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-121 — Tham số `tenant` được nhận nhưng bỏ qua | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-122 — Task owner chỉ là principal ID string | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-123 — Không có TTL/archive/dead-letter cho task | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-124 — GetTask biến mọi lỗi thành not found | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-125 — 242 skill chỉ tạo khoảng 45 flow signature khác nhau | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-126 — 96 domain skill có cùng I/O `product-definition → domain-blueprint/domain-evidence` | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-127 — Active artifact uniqueness làm domain skill không composable | **FIXED** | Artifact slots allow composable domain outputs. |
| FOS2-128 — Flow được harden bằng substring/pack heuristic | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-129 — Toàn catalog không có conflict declarations | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-130 — Ngay cả có conflict, router chỉ trừ điểm | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-131 — Tool requirements rất nghèo và generic | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-132 — Domain `all` làm mọi domain skill eligible | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-133 — Planner `allowed()` bỏ qua nhiều ràng buộc runtime | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-134 — Graph reachability test không phản ánh executable reachability | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-135 — Producer được chọn theo stable/token/name hơn là chất lượng context | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-136 — `skillChannel` không xuyên suốt planner | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-137 — Route được tính từ snapshot rồi ghi mà không CAS semantic snapshot | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-138 — Duplicate route vẫn có thể tăng revision | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-139 — README đưa ví dụ contract không khớp file thật | **MITIGATED** | Risk reduced and claims narrowed; see architecture/security limits. |
| FOS2-140 — `reviewerRole`/gate rules trong contract không được engine enforce | **FIXED** | Skill-run inspector enforces reviewer/evidence obligations. |
| FOS2-141 — `requiredEvidence` và `requiredFields` không được completeSkillRun kiểm tra theo contract đầy đủ | **FIXED** | Required evidence/fields are checked against frozen contracts. |
| FOS2-142 — `invalidates`/context limits/reference depth/verbosity chỉ là metadata | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-143 — Method/procedure/verification là prose, không executable | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-144 — Nhiều core skill cùng produce generic type | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-145 — Gate failure → target mapping còn thô | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-146 — Catalog cache chưa có robust invalidation/version identity | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-147 — Skill contract nói provider-neutral nhưng method có thể phụ thuộc ngầm vào tool | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-148 — Skill completion chấp nhận metrics caller tự khai | **FIXED** | Workers cannot submit utility metrics. |
| FOS2-149 — Một success ít dữ liệu có thể tăng utility mạnh | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-150 — Utility không phân đoạn theo context | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-151 — Skill run không có lease/heartbeat/expiry | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-152 — Không có max concurrent/resource lock thực | **FIXED** | Overlapping output targets are rejected. |
| FOS2-153 — `virtualInputs` không chứng minh input đã dùng | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-154 — Eval update sửa catalog nhưng không sửa contract source | **FIXED** | Catalog changes derive from persisted EvalRun records. |
| FOS2-155 — Catalog mutation không lock/CAS | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-156 — Eval runner chưa là product surface hoàn chỉnh | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-157 — Evaluator tin `quality` và tokenCount do executor trả | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-158 — Required evidence check chỉ tìm phrase/list | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-159 — Forbidden pattern dùng substring | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-160 — Confidence interval không điều khiển đầy đủ promotion | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-161 — 24 case cho 242 skill quá mỏng | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-162 — Không có sandbox cho executor | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-163 — Không có immutable EvalRun store/link bắt buộc | **FIXED** | EvalRun is immutable and content-addressed. |
| FOS2-164 — Seed deterministic chưa đủ phân loại flaky | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-165 — Catalog promotion/quarantine thiếu rollback history dễ dùng | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-166 — “Semantic overlap” mạnh hơn implementation | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-167 — Stopword/stemming/concept dictionary hạn chế ngôn ngữ | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-168 — Union-find tạo transitive chaining | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-169 — Representative/fingerprint cluster phụ thuộc thứ tự input | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-170 — Concept family generic có thể gom ý tưởng khác nhau | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-171 — Paraphrase ngoài dictionary vẫn tách cluster | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-172 — README nói idea genome có trigger/incentive/ownership/timing nhưng schema không có | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-173 — Điểm idea vẫn do evaluator tự nhập | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-174 — Cùng principal có thể tạo và chấm idea | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-175 — Selection không bắt buộc chọn top score | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-176 — Validator không phải implementation đầy đủ draft 2020-12 | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-177 — `date-time` dựa `Date.parse` lỏng | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-178 — URI validation bằng `new URL` không đủ policy | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-179 — Project subrecords còn `additionalProperties:true` | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-180 — Cross-record validation chưa bao phủ mọi reference | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-181 — Public schemas, runtime schemas và tool schemas có thể drift | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-182 — Không có compatibility suite với archive lịch sử thật | **FIXED** | Historical archives are represented by real migration fixtures. |
| FOS2-183 — Project output tool schema cho revision minimum 0 | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-184 — A2A task record không dùng runtime schema | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-185 — Artifact content registry không đủ sâu để interoperability | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-186 — Standalone dashboard không có MCP Apps bridge | **FIXED** | Studio negotiates same-origin MCP without a host bridge. |
| FOS2-187 — `applyProject` chỉ cập nhật header cơ bản | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-188 — Refresh yêu cầu reload để redraw | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-189 — Primary next-action button gọi tool đang hỏng schema | **FIXED** | Resolved by the v0.3 Trust Kernel and regression suite. |
| FOS2-190 — Start skill gửi `tools: []`/target rỗng | **FIXED** | Studio starts runs with routed output targets. |
| FOS2-191 — Không có UI lifecycle artifact/evidence/finding đầy đủ | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-192 — `/dashboard` load/embed tất cả projects | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-193 — Dashboard không có project-level ACL | **FIXED** | Owner/ACL filtering applies across protocol and dashboard paths. |
| FOS2-194 — 9 executable adapter config chạy cùng local stdio behavior | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-195 — 6 documentation-only không có machine execution | **OPEN** | Still unsupported or only partially enforceable; remains in the published trust boundary. |
| FOS2-196 — Manifest không được ký/ràng buộc archive | **FIXED** | Source/archive manifests and detached signing tooling are provided. |
| FOS2-197 — Coverage cao vẫn bỏ lọt public-tool/migration/release bugs | **FIXED** | Invariant, protocol, migration, archive, ACL and trust tests were added. |

## Open-boundary themes

The remaining open findings are concentrated in properties that require a different deployment class rather than another local patch: distributed transactions and horizontal session state; deep per-artifact schemas; a sandbox for arbitrary executors; stable cursor/index infrastructure; enterprise SSO/delegated authorization; richer Studio CRUD/graph visualization; broader A2A surfaces; and statistically deep, cross-model evaluation. ForgeOS v0.3 does not present these as complete.
