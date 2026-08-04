# ForgeOS v0.2.0 — Kiểm toán kỹ thuật chuyên sâu và thiết kế nâng cấp mạnh

> Báo cáo này tập trung vào lỗi, rủi ro, giới hạn kiến trúc, tính năng mới chỉ hoạt động một phần hoặc mới tồn tại ở tầng mô tả; đồng thời đưa ra kiến trúc nâng cấp cụ thể. Đây **không phải lịch trình theo ngày/tuần**.

## 1. Định danh đối tượng kiểm toán

- Archive: `forge-os-v0.2.0(1).zip`
- Kích thước: `1,808,083` bytes
- SHA-256 archive: `678b3b4aa6122592f489ff6e63387ccdab0043431c1f416228d6e4b646dfb2e6`
- Số file sau giải nén: `736`
- Thời điểm lập báo cáo: `2026-07-25T01:42:43+07:00`
- Phạm vi: source, tests, scripts, schemas, 242 skill contracts, 15 adapter packs, MCP, A2A, Studio, evidence và release assets.

## 2. Phương pháp và bằng chứng thực thi

Các kết luận được phân loại:

- **BUG/CONCURRENCY/INTEGRITY tái hiện:** đã chạy ca độc lập và quan sát output sai.
- **Xác nhận từ code:** luồng điều khiển/schema cho thấy hành vi chắc chắn.
- **Giới hạn kiến trúc:** hệ thống không thể bảo đảm thuộc tính được mô tả trong deployment thực tế.
- **Overclaim/feature theater:** giao diện, metadata hoặc tài liệu mô tả mạnh hơn runtime.

Các phép kiểm tra chính:

| Kiểm tra | Kết quả |
|---|---:|
| `npm ci` | Thành công, 0 vulnerability từ npm audit ở thời điểm chạy |
| `npm test` | 132/132 pass |
| Line coverage | 95.09% |
| Branch coverage | 74.63% |
| Function coverage | 92.78% |
| `npm run validate` | Pass |
| `npm run smoke` | Pass |
| `npm run release:verify` từ ZIP | **Fail** |
| Cross-process ProjectStore repro | **Mất một update** |
| v0.1 migration repro | **Validation fail** |
| Fake evidence/critical finding repro | **Finding bị đóng bằng self-attestation** |
| MCP export/route/next-action repro | **3 tool trả `invalid_tool_output`** |
| Cross-principal session DELETE | **Principal khác xóa được session** |
| A2A cross-store update | **Mất một update** |
| A2A historyLength=0 | **Trả full history** |
| Docker default command | **Process thoát ngay** |

## 3. Kết luận điều hành

ForgeOS v0.2.0 là một bước tiến lớn so với v0.1.0 về cấu trúc: stale gate đã được xử lý bằng semantic revision/input digest; duplicate score, artifact invalidation, lifecycle public, MCP origin/session lifecycle và A2A 1.0 shape đều tốt hơn. Tuy vậy, lõi “evidence-backed trust” chưa đạt mức tin cậy mà tên gọi và README gợi ý.

Bốn sự thật quan trọng nhất:

1. **State vẫn có thể mất dữ liệu** trong multi-process do stale-lock/file-store race.
2. **Evidence vẫn là self-attestation:** caller tự khai pass, digest và method; một agent có thể tự đóng critical finding.
3. **Public protocol không đồng nhất với internal API:** ít nhất ba MCP tool quan trọng bị output schema chặn.
4. **Nhiều “hệ thống” mới là lớp metadata/harness:** task.defer, full skill composability, assurance evidence rigor, Studio standalone, migration compatibility và archive release verification chưa hoạt động như lời mô tả mạnh nhất.

### Đánh giá định tính

| Lĩnh vực | Điểm | Nhận xét |
|---|---:|---|
| Tổ chức code và tài liệu | 8.5/10 | Có kỷ luật, module hóa và claims boundary tốt hơn |
| State integrity một process | 8/10 | Queue/revision/fsync cải thiện rõ |
| State integrity nhiều process/node | 4/10 | Lock stealing và A2A lost update |
| Evidence trust | 3.5/10 | Subject-bound nhưng chưa truth-bound |
| Artifact lifecycle | 6.5/10 | Public lifecycle thật, envelope integrity còn yếu |
| Gate freshness | 8.5/10 | Một trong các phần mạnh nhất |
| Assurance semantics | 4/10 | Tài liệu/policy lệch; label-based proof |
| MCP internal lifecycle | 7/10 | Tốt hơn, nhưng public tool drift/session DELETE |
| A2A protocol shape | 7/10 | V1 shape khá tốt; task engine yếu |
| Skill graph | 5/10 | Connected vocabulary nhưng thiếu semantic/executable constraints |
| Eval/utility | 4.5/10 | Harness thật, trust/statistics/productization chưa đủ |
| Studio | 5/10 | Hiển thị tốt hơn, interaction/rerender còn partial |
| Release engineering | 4/10 | Report giàu dữ liệu nhưng archive tự verify thất bại |
| Production readiness | 4.5/10 | Prototype mạnh, chưa phải trust control plane production |

## 4. Đối chiếu nhanh với v0.1.0

### Đã sửa thật hoặc cải thiện đáng kể

- Gate pass được bind semantic revision và input SHA; mutation semantic làm gate stale.
- Exact idea score coverage và duplicate score được chặn.
- Artifact invalidated/superseded không còn được coi active; DAG/dependency validation được nối khi lưu.
- Artifact lifecycle create/review/verify/supersede đã có public tools.
- Domain validation, corrupt-project isolation và canonical content hash tốt hơn.
- MCP có initialize/ready lifecycle, Origin allowlist, version/session header và runtime input/output validation.
- A2A dùng PascalCase methods, ROLE/TASK_STATE enum và supportedInterfaces theo v1.
- Test tăng từ 60 lên 132 và có nhiều negative/invariant tests hơn.

### Chỉ sửa một phần hoặc thay lỗi cũ bằng lỗi mới

- In-process lock sửa, nhưng cross-process stale lock vẫn mất update.
- Evidence có subject/hash/method, nhưng không xác minh proof thật.
- Artifact content hash canonical, nhưng provenance/lifecycle envelope không được bảo vệ.
- Skill graph nối được type, nhưng nhiều skill chỉ là biến thể prose trên cùng flow template.
- Eval runner chạy thật, nhưng metrics/evidence vẫn có thể do executor tự khai.
- Studio có state/error UI hơn, nhưng standalone buttons và rerender chưa hoàn chỉnh.
- Release report được sinh động, nhưng ZIP không chạy được verifier và không bind archive.

### Regression/lỗi mới đáng chú ý của v0.2

- Migration v0.1 artifact/evidence bị hỏng.
- Ba MCP tool bị output schema drift.
- A2A `historyLength=0`, Memory list và queue cleanup bug.
- Dockerfile mặc định tự mâu thuẫn với network guard.
- `.env.example` dùng sai tên biến origin.
- MCP session DELETE thiếu ownership check.

## 5. Ma trận tính năng thật, một phần và “có vẻ có”

| Tính năng | Trạng thái | Phán quyết |
|---|---|---|
| Semantic stale gate | **Thật** | Có revision/hash check và regression path hợp lý |
| Duplicate score guard | **Thật** | Gate và score path kiểm exact coverage |
| Artifact public lifecycle | **Thật nhưng policy yếu** | Tool có thật; review có thể bị bỏ qua khi verify |
| Canonical artifact content hash | **Thật một phần** | Bảo vệ content subset, không bảo vệ provenance/lifecycle |
| Cross-process durable store | **Một phần** | fsync/lock có, nhưng lock stealing gây lost update |
| Evidence-backed proof | **Một phần/overclaim** | Structured self-attestation, chưa trusted execution |
| A0–A4 assurance | **Một phần** | Rule labels có thật; A0=A1 và docs lệch code |
| 242 typed composable skills | **Một phần mạnh** | Type graph tốt hơn, semantic uniqueness/composition còn yếu |
| Conflict-aware routing | **Gần như metadata** | Không có conflict declaration thực |
| Utility learning | **Một phần** | Update có thật, metrics/priors/context yếu và gameable |
| Forge Lab | **Library harness** | Chạy case/seed thật, chưa trusted/persisted eval platform |
| MCP 25 tools | **Không hoàn toàn** | Ít nhất 3 tool công khai hỏng output |
| A2A persistent task engine | **Một phần** | File persistence thật; race/cancel/defer/retention yếu |
| `task.defer` | **Feature theater** | Không có worker thực thi tiếp |
| Forge Studio standalone | **Một phần** | Render được; action phụ thuộc bridge không tồn tại trong browser thường |
| Release verifier | **Không dùng được từ ZIP** | Fail permission rồi fail Git dependency |
| v0.1 migration | **Không đạt** | Dữ liệu artifact/evidence thật bị reject |
| Adapter coverage | **Protocol TCK thật, vendor integration không** | 9 config spawn; 6 docs-only |

## 6. Danh sách phát hiện chi tiết

Tổng số phát hiện trong báo cáo này: **197**.

### Phân bố mức độ

| Mức độ | Số lượng |
|---|---:|
| CRITICAL | 8 |
| HIGH | 54 |
| MEDIUM | 119 |
| LOW | 16 |

## A. Hệ thống phát hành, gói ZIP và bằng chứng release

v0.2.0 quảng bá một pipeline release “source-bound”, có báo cáo xác minh, ảnh dashboard, adapter TCK và manifest. Phần này có nhiều tiến bộ so với v0.1, nhưng gói ZIP được cung cấp không tự xác minh được theo chính hướng dẫn của dự án.

### FOS2-001 — `npm run release:verify` thất bại ngay trên gói ZIP chính thức

- **Mức độ:** `HIGH`
- **Loại:** `BUG`
- **Vị trí/bề mặt:** ``scripts/release-verify.mjs`; `scripts/capture-dashboard.sh``

**Phân tích**

File shell được đóng gói với mode `0644`, trong khi verifier gọi trực tiếp `./scripts/capture-dashboard.sh`. Trên hệ Unix, lệnh dừng tại `Permission denied`. Đây là lỗi phân phối có thể tái hiện từ archive, không phụ thuộc logic ứng dụng.

**Hậu quả**

Người tải bản phát hành không thể chạy lệnh xác minh mà README yêu cầu. Tuyên bố “release evidence pipeline” không áp dụng cho chính artifact được phát hành.

**Hướng nâng cấp trực tiếp**

Dùng script Node.js thay cho shell cần executable bit, hoặc gọi `bash scripts/capture-dashboard.sh`; thêm test giải nén archive sạch rồi chạy verifier.

### FOS2-002 — Verifier tiếp tục phụ thuộc `.git` sau khi sửa quyền thực thi

- **Mức độ:** `HIGH`
- **Loại:** `BUG`
- **Vị trí/bề mặt:** ``scripts/release-verify.mjs:10-22, 126-140``

**Phân tích**

Sau khi cho phép script chạy, bước cuối `git diff --check` trả mã 129 vì archive không có thư mục `.git`. `sourceCommit` và `sourceTree` cũng trở thành `null` ngoài repository.

**Hậu quả**

Archive phát hành không thể tự chứng minh nguồn, trong khi báo cáo có trường commit/tree và README gọi nó là source-bound.

**Hướng nâng cấp trực tiếp**

Xây verifier theo hướng archive-first: dùng manifest và digest được nhúng lúc build; Git chỉ là nguồn metadata tùy chọn ở môi trường phát hành.

### FOS2-003 — Verifier sửa đổi cây làm việc trước khi kiểm tra Git

- **Mức độ:** `MEDIUM`
- **Loại:** `DESIGN`
- **Vị trí/bề mặt:** ``scripts/release-verify.mjs`; `scripts/run-adapter-tck.mjs`; capture dashboard`

**Phân tích**

Pipeline tái tạo `evidence/adapter-tck.json`, dashboard và báo cáo trước khi gọi `git diff --check`. Bản thân verifier tạo thay đổi rồi mới hỏi Git về diff.

**Hậu quả**

Khó phân biệt thay đổi do người phát hành tạo trước với thay đổi do verifier tạo; bằng chứng có thể làm cây nguồn “dirty” một cách dự kiến.

**Hướng nâng cấp trực tiếp**

Ghi toàn bộ output vào thư mục build tách biệt, ví dụ `dist/evidence/<run-id>/`, hoặc dùng worktree sạch bất biến.

### FOS2-004 — `git diff --check` không chứng minh cây nguồn sạch

- **Mức độ:** `MEDIUM`
- **Loại:** `INTEGRITY`
- **Vị trí/bề mặt:** ``scripts/release-verify.mjs``

**Phân tích**

`git diff --check` chủ yếu phát hiện whitespace error và conflict marker. Nó không thất bại chỉ vì có mọi loại thay đổi hợp lệ trong working tree.

**Hậu quả**

Báo cáo có thể được tạo từ mã đã sửa nhưng chưa commit, trong khi `source.tree` vẫn là tree của HEAD.

**Hướng nâng cấp trực tiếp**

Kiểm tra `git status --porcelain` và bắt buộc sạch, hoặc tính Merkle/file manifest của nội dung thực tế được chạy.

### FOS2-005 — `dirtyAtStart` chỉ được ghi nhận, không chặn release

- **Mức độ:** `MEDIUM`
- **Loại:** `INTEGRITY`
- **Vị trí/bề mặt:** ``runReleaseVerification()``

**Phân tích**

Biến `dirtyAtStart` được đưa vào report nhưng trạng thái `pass` không phụ thuộc nó.

**Hậu quả**

Một release có thể “pass” trên cây đã sửa cục bộ; người đọc phải tự phát hiện dòng `dirty before verification: yes`.

**Hướng nâng cấp trực tiếp**

Đưa cleanliness thành policy rõ ràng: fail mặc định, chỉ cho phép override có lý do và ghi approval.

### FOS2-006 — Commit/tree không ràng buộc nội dung thực sự đã chạy

- **Mức độ:** `HIGH`
- **Loại:** `INTEGRITY`
- **Vị trí/bề mặt:** ``git(["rev-parse","HEAD^{tree}"])` và command loop`

**Phân tích**

Verifier lấy tree của HEAD, nhưng command chạy trên working directory hiện tại. Không có hash toàn bộ file đầu vào hoặc kiểm tra chúng đúng với tree.

**Hậu quả**

Có thể báo cáo một tree sạch trong metadata nhưng thực thi mã khác nằm trong working tree.

**Hướng nâng cấp trực tiếp**

Tạo source bundle bất biến, tính digest trước khi chạy, thực thi từ bundle đó và ghi digest vào mọi evidence receipt.

### FOS2-007 — Pipeline dừng ở lỗi đầu tiên

- **Mức độ:** `MEDIUM`
- **Loại:** `OBSERVABILITY`
- **Vị trí/bề mặt:** `command loop trong `runReleaseVerification()``

**Phân tích**

Vòng lặp `break` ngay khi một command thất bại. Báo cáo không cho biết các bước sau có lỗi độc lập hay không.

**Hậu quả**

Người bảo trì nhận ít dữ liệu chẩn đoán và dễ sửa tuần tự nhiều lỗi mà mỗi lần chỉ thấy một lỗi.

**Hướng nâng cấp trực tiếp**

Phân loại command bắt buộc và command độc lập; tiếp tục chạy các kiểm tra an toàn sau lỗi để tạo report đầy đủ, nhưng vẫn trả trạng thái fail.

### FOS2-008 — Báo cáo có thể tồn tại với `status: pass` từ môi trường khác nhưng không chứng minh ZIP hiện tại

- **Mức độ:** `MEDIUM`
- **Loại:** `OVERCLAIM`
- **Vị trí/bề mặt:** ``evidence/verification-report.json`; archive digest không được ghi`

**Phân tích**

Report cũ không mang SHA-256 của file ZIP, manifest archive hoặc danh sách file được đóng gói. Nó chỉ mô tả môi trường tạo report.

**Hậu quả**

Người dùng không thể chứng minh report đi kèm chính xác với archive họ nhận.

**Hướng nâng cấp trực tiếp**

Phát hành `archive.sha256`, signed provenance và manifest toàn file; report phải tham chiếu digest archive cuối cùng.

### FOS2-009 — Không có chữ ký hay attestation kiểm chứng nguồn

- **Mức độ:** `MEDIUM`
- **Loại:** `SUPPLY_CHAIN`
- **Vị trí/bề mặt:** `release assets`

**Phân tích**

SHA-256 trong report là hash tự khai báo bên trong cùng gói; không có khóa tin cậy bên ngoài, Sigstore hoặc chữ ký detached.

**Hậu quả**

Kẻ có quyền sửa archive có thể sửa cả mã, hash và report đồng thời.

**Hướng nâng cấp trực tiếp**

Dùng Sigstore/cosign hoặc chữ ký phát hành; công bố public key/chính sách verification độc lập.

### FOS2-010 — Ảnh dashboard phụ thuộc renderer/môi trường nhưng không có chuẩn tái lập đầy đủ

- **Mức độ:** `LOW`
- **Loại:** `REPRODUCIBILITY`
- **Vị trí/bề mặt:** ``capture-dashboard.sh`; `dashboard-renderer.txt``

**Phân tích**

Report ghi renderer và hash ảnh, nhưng chưa khóa font, phiên bản trình duyệt, viewport, locale và nondeterministic rendering.

**Hậu quả**

Hash ảnh có thể đổi trên môi trường khác dù UI không đổi, hoặc không đổi nếu capture không bao phủ trạng thái tương tác.

**Hướng nâng cấp trực tiếp**

Dùng container capture cố định, ghi browser digest, viewport, timezone, locale và input fixture.

### FOS2-011 — Evidence được sinh trong source tree thay vì artifact output

- **Mức độ:** `MEDIUM`
- **Loại:** `DESIGN`
- **Vị trí/bề mặt:** ``evidence/``

**Phân tích**

Kết quả build/verification được lưu cạnh mã nguồn và dễ bị commit như dữ liệu tĩnh.

**Hậu quả**

Người đọc có thể nhầm evidence lịch sử với evidence vừa chạy; verifier cũng tự ghi đè report.

**Hướng nâng cấp trực tiếp**

Tách `evidence/baseline/` khỏi `dist/verification-runs/<id>/`; mỗi run là immutable và có index.

### FOS2-012 — Không có test “install from release archive”

- **Mức độ:** `MEDIUM`
- **Loại:** `TEST_GAP`
- **Vị trí/bề mặt:** ``tests/release-assets.test.mjs``

**Phân tích**

Test hiện kiểm tra file/evidence trong repository, nhưng không tạo tar/zip, giải nén ở thư mục mới, cài production dependencies và chạy lệnh công khai.

**Hậu quả**

Hai lỗi release quan trọng vẫn lọt dù 132 test qua.

**Hướng nâng cấp trực tiếp**

Thêm archive acceptance test như người dùng thật: pack → extract → `npm ci --omit=dev`/`npm ci` → smoke → release verify.

## B. ProjectStore, transaction, khóa và durability

v0.2 sửa lỗi queue trong cùng process, thêm revision/CAS, khóa thư mục, atomic write, fsync, snapshot và quarantine. Tuy nhiên, “cross-process writer lock” vẫn không phải lease an toàn và aggregate JSON còn nhiều giới hạn.

### FOS2-013 — Khóa cross-process có thể bị cướp và gây mất update

- **Mức độ:** `CRITICAL`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** ``src/core/project-store.mjs`, cơ chế stale lock`

**Phân tích**

Khóa bị xem là stale chỉ dựa trên mtime và bị xóa sau ngưỡng timeout. Không có heartbeat, owner token, kiểm tra PID còn sống hoặc fencing number. Ca tái hiện với hai process cho cả hai update fulfilled nhưng metadata cuối chỉ giữ một update.

**Hậu quả**

Mất artifact, evidence, finding hoặc quyết định trong tải đồng thời; revision cuối có thể trông hợp lệ nên lỗi khó phát hiện.

**Hướng nâng cấp trực tiếp**

Dùng database transaction; nếu vẫn dùng file lock, cần lease token, heartbeat, owner verification và fencing token kiểm tra lúc commit.

### FOS2-014 — Chủ khóa cũ có thể xóa khóa của chủ mới

- **Mức độ:** `CRITICAL`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** `release callback của process lock`

**Phân tích**

Sau khi một process bị coi stale và lock directory được process khác tái tạo, process cũ khi hoàn thành vẫn có thể `rm` cùng đường dẫn mà không kiểm tra token sở hữu.

**Hậu quả**

Mở cửa cho process thứ ba vào critical section trong khi process mới vẫn đang ghi.

**Hướng nâng cấp trực tiếp**

Ghi UUID lease trong lock record; chỉ release nếu token trên disk trùng token của owner hiện tại.

### FOS2-015 — CAS chỉ bảo vệ khi mọi writer đi qua cùng cơ chế

- **Mức độ:** `HIGH`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** ``ProjectStore.update()``

**Phân tích**

Expected revision và khóa có ích trong API, nhưng file JSON vẫn là nguồn mở; process/tiện ích khác có thể ghi trực tiếp hoặc dùng instance với timeout khác.

**Hậu quả**

Tính nhất quán không được bảo đảm ở hệ nhiều writer không đồng nhất.

**Hướng nâng cấp trực tiếp**

Đưa state vào SQLite/PostgreSQL với transaction và unique/foreign-key constraints; coi file export chỉ là bản sao.

### FOS2-016 — Snapshot được ghi trực tiếp, không theo atomic-write path

- **Mức độ:** `MEDIUM`
- **Loại:** `DURABILITY`
- **Vị trí/bề mặt:** ``#snapshot()``

**Phân tích**

Snapshot pre-write không dùng temp+rename+fsync như project chính. Crash giữa chừng có thể tạo snapshot JSON dở.

**Hậu quả**

Cơ chế recovery có thể đưa người vận hành đến một snapshot không đọc được.

**Hướng nâng cấp trực tiếp**

Dùng cùng primitive durable atomic write cho snapshot và kèm checksum.

### FOS2-017 — Snapshot có thể ghi nhận revision chưa bao giờ commit

- **Mức độ:** `HIGH`
- **Loại:** `DURABILITY`
- **Vị trí/bề mặt:** ``update(): #snapshot(project)` trước `#atomicWrite(next)``

**Phân tích**

Snapshot lưu trạng thái cũ trước commit mới, nhưng metadata/thứ tự file không có transaction journal. Nếu main write thất bại, chuỗi snapshot không mô tả rõ attempt/commit.

**Hậu quả**

Khôi phục thủ công dễ chọn sai mốc và audit không phân biệt pre-image với committed image.

**Hướng nâng cấp trực tiếp**

Dùng write-ahead log hoặc event store; snapshot phải tham chiếu event sequence đã commit.

### FOS2-018 — Có snapshot nhưng không có API restore công khai

- **Mức độ:** `MEDIUM`
- **Loại:** `FEATURE_GAP`
- **Vị trí/bề mặt:** `ProjectStore và tool registry`

**Phân tích**

Dự án tự thừa nhận chỉ giữ snapshot cho recovery; người dùng không có command liệt kê, kiểm tra, preview hoặc restore.

**Hậu quả**

Tính năng backup/recovery mới là cơ chế nội bộ, chưa thành khả năng vận hành hoàn chỉnh.

**Hướng nâng cấp trực tiếp**

Thêm `snapshot.list`, `snapshot.verify`, `project.restore` với human approval và dry-run diff.

### FOS2-019 — Mỗi mutation đọc/clone/serialize toàn aggregate

- **Mức độ:** `MEDIUM`
- **Loại:** `SCALABILITY`
- **Vị trí/bề mặt:** ``ProjectStore.update()``

**Phân tích**

Project chứa ideas, scores, artifacts, evidence, gates, findings, risks, routes, skillRuns, approvals và history trong một JSON.

**Hậu quả**

Độ trễ, memory và xác suất conflict tăng tuyến tính theo tuổi project; file lớn khiến mọi hành động nhỏ đều đắt.

**Hướng nâng cấp trực tiếp**

Tách event log/relational tables, projection cho current state và pagination cho collections.

### FOS2-020 — Nhiều collection vẫn tăng không giới hạn

- **Mức độ:** `MEDIUM`
- **Loại:** `SCALABILITY`
- **Vị trí/bề mặt:** `project schema và các updater`

**Phân tích**

Route/history có một số trimming, nhưng artifacts, evidence, findings, approvals, skillRuns, decisions, risks và snapshots chưa có retention tổng quát.

**Hậu quả**

Disk và thời gian validation tăng mãi; dashboard/export có thể trở nên rất nặng.

**Hướng nâng cấp trực tiếp**

Định nghĩa retention/archival per collection, immutable cold storage và indexed query.

### FOS2-021 — No-op update vẫn tăng revision và ghi file

- **Mức độ:** `LOW`
- **Loại:** `PERFORMANCE`
- **Vị trí/bề mặt:** ``ProjectStore.update()``

**Phân tích**

Updater trả trạng thái logic giống cũ vẫn dẫn đến snapshot, revision tăng, serialize và fsync.

**Hậu quả**

Tạo noise trong history/revision, làm approval/gate stale không cần thiết nếu semantic flag dùng sai.

**Hướng nâng cấp trực tiếp**

So sánh canonical semantic state hoặc yêu cầu updater trả `{changed, semanticChanged}`.

### FOS2-022 — Revision và semanticRevision là số trong file, không có MAC/hash chain

- **Mức độ:** `MEDIUM`
- **Loại:** `INTEGRITY`
- **Vị trí/bề mặt:** `project aggregate`

**Phân tích**

Local attacker có thể sửa state, revision, history và tính lại artifact hash; runtime chỉ kiểm tra cấu trúc/quan hệ.

**Hậu quả**

Audit log không chống sửa đổi sau sự kiện.

**Hướng nâng cấp trực tiếp**

Dùng append-only event hash chain; ký checkpoint hoặc lưu hash root ngoài máy.

### FOS2-023 — Quarantine bỏ qua file hỏng nhưng không cung cấp workflow sửa chữa

- **Mức độ:** `MEDIUM`
- **Loại:** `RECOVERY`
- **Vị trí/bề mặt:** ``list()` diagnostics`

**Phân tích**

List không sập toàn bộ là cải tiến, nhưng diagnostic chỉ ghi lỗi; không có command export raw, inspect last snapshot, repair hoặc mark resolved.

**Hậu quả**

Project hỏng có thể biến mất khỏi UI và bị bỏ quên.

**Hướng nâng cấp trực tiếp**

Tạo recovery console/API với raw digest, snapshot candidates và audit của thao tác phục hồi.

### FOS2-024 — Durability semantics phụ thuộc filesystem

- **Mức độ:** `LOW`
- **Loại:** `PORTABILITY`
- **Vị trí/bề mặt:** ``rename`, directory `fsync``

**Phân tích**

Atomic rename và fsync mạnh trên local filesystem, nhưng không bảo đảm giống nhau trên NFS, SMB, overlayfs hoặc volume cloud.

**Hậu quả**

Tuyên bố durability có thể không đúng ở deployment khác.

**Hướng nâng cấp trực tiếp**

Ghi rõ supported storage; chạy filesystem capability probe hoặc dùng database được hỗ trợ.

### FOS2-025 — Không có transaction nhiều project

- **Mức độ:** `MEDIUM`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** `ProjectStore API`

**Phân tích**

Các hoạt động liên quan nhiều project hoặc import/merge không thể commit nguyên tử.

**Hậu quả**

Có thể tạo tham chiếu chéo nửa vời nếu sau này mở rộng workflow multi-project.

**Hướng nâng cấp trực tiếp**

Dùng transaction DB và outbox; cấm cross-project reference nếu chưa hỗ trợ.

### FOS2-026 — Không có lock/transaction metrics

- **Mức độ:** `MEDIUM`
- **Loại:** `OPERABILITY`
- **Vị trí/bề mặt:** `ProjectStore`

**Phân tích**

Không đo wait time, stale-lock removal, CAS conflict, snapshot failure hoặc file size.

**Hậu quả**

Lỗi mất update và contention chỉ lộ khi người dùng thấy state sai.

**Hướng nâng cấp trực tiếp**

Phát metrics và structured audit event cho lock acquire/release/steal, retries, conflict và write latency.

## C. Migration và tương thích dữ liệu v0.1 → v0.2

Tuyên bố “schema migration” tồn tại, nhưng migration test không dùng artifact/evidence giống dữ liệu v0.1 thực tế. Đây là một trong các regression nghiêm trọng nhất của v0.2.

### FOS2-027 — Project v0.1 có artifact thật không migrate được

- **Mức độ:** `CRITICAL`
- **Loại:** `DATA_LOSS`
- **Vị trí/bề mặt:** ``src/core/migrations.mjs:28-41`; runtime artifact schema`

**Phân tích**

`migrateArtifacts()` không bổ sung `version`, `title`, timestamp/lifecycle fields và principal shape mới. Sau migrate, runtime validation báo thiếu nhiều trường.

**Hậu quả**

Người dùng nâng cấp có thể không mở được project cũ chứa dữ liệu giá trị.

**Hướng nâng cấp trực tiếp**

Tạo migration theo từng version từ fixture archive v0.1 thật; bổ sung đầy đủ defaults có provenance và báo cáo mọi biến đổi.

### FOS2-028 — Evidence v0.1 bị gán revision 0 trái schema mới

- **Mức độ:** `CRITICAL`
- **Loại:** `DATA_LOSS`
- **Vị trí/bề mặt:** ``migrateEvidence(): revision:0, semanticRevision:0`; schema yêu cầu minimum 1`

**Phân tích**

Migration tự tạo object mà validator v0.2 chắc chắn từ chối.

**Hậu quả**

Mọi project cũ có evidence thiếu subject mới có thể không đọc được.

**Hướng nâng cấp trực tiếp**

Gắn evidence legacy vào revision/semanticRevision 1 hoặc một migration snapshot hợp lệ; status nên `unverified` và không được mở gate.

### FOS2-029 — Legacy principal thiếu `roles`

- **Mức độ:** `HIGH`
- **Loại:** `SCHEMA_DRIFT`
- **Vị trí/bề mặt:** ``legacyPrincipal()` và `EVIDENCE_SCHEMA``

**Phân tích**

Hàm chỉ trả `{id,type}`, trong khi principal schema yêu cầu roles trong nhiều đường validation.

**Hậu quả**

Migration thất bại hoặc tạo object không nhất quán tùy validator path.

**Hướng nâng cấp trực tiếp**

Dùng duy nhất `createPrincipal/principalRecord` hoặc schema migration helper có roles `["legacy-import"]`.

### FOS2-030 — Test migration dùng fixture quá sạch

- **Mức độ:** `HIGH`
- **Loại:** `TEST_GAP`
- **Vị trí/bề mặt:** ``tests/project-store-invariants.test.mjs``

**Phân tích**

Test mang schemaVersion cũ nhưng dữ liệu con đã gần tương thích v0.2, nên không đại diện file v0.1 với artifact/evidence cũ.

**Hậu quả**

Test xanh tạo cảm giác backward compatibility giả.

**Hướng nâng cấp trực tiếp**

Đưa nguyên file v0.1 được tạo bởi release trước vào `tests/fixtures/v0.1/` và kiểm tra migrate end-to-end.

### FOS2-031 — Migration tính lại artifact hash nhưng không lưu hash cũ

- **Mức độ:** `MEDIUM`
- **Loại:** `AUDIT`
- **Vị trí/bề mặt:** ``migrateArtifacts()``

**Phân tích**

Hash mới được tạo theo canonical algorithm mới; không có `legacySha256`, migration reason hoặc transform digest.

**Hậu quả**

Chuỗi provenance bị đứt, không thể chứng minh artifact sau migrate tương ứng artifact cũ nào.

**Hướng nâng cấp trực tiếp**

Lưu `migration.provenance` gồm old hash, new hash, transformer version và source archive digest.

### FOS2-032 — Không có migration journal/backup tự động

- **Mức độ:** `MEDIUM`
- **Loại:** `OPERABILITY`
- **Vị trí/bề mặt:** ``migrateProject()`/read path`

**Phân tích**

Migration xảy ra khi đọc, nhưng không có report, preview, backup bắt buộc hoặc rollback command.

**Hậu quả**

Một lỗi migration có thể khiến người dùng chỉ thấy “corrupt project”.

**Hướng nâng cấp trực tiếp**

Tách `forge migrate --dry-run`, backup immutable, report validation và commit migration có approval.

### FOS2-033 — Không kiểm tra migration idempotent và deterministic trên dữ liệu thật

- **Mức độ:** `MEDIUM`
- **Loại:** `INTEGRITY`
- **Vị trí/bề mặt:** `migration tests`

**Phân tích**

Không có property rằng migrate(migrate(x)) bằng migrate(x), hoặc cùng input luôn cho byte-equivalent output.

**Hậu quả**

Re-run có thể thay timestamp/default và làm hash drift nếu code thay đổi.

**Hướng nâng cấp trực tiếp**

Thêm golden fixtures, determinism test và migration version checksum.

### FOS2-034 — Chỉ có nhánh tổng quát `version <= 2` thay vì chuỗi migration

- **Mức độ:** `MEDIUM`
- **Loại:** `COMPATIBILITY`
- **Vị trí/bề mặt:** ``migrateProject()``

**Phân tích**

Version 1 và 2 được xử lý cùng một transform; khi schema phát triển, khó biết precondition của từng bước.

**Hậu quả**

Nguy cơ bỏ sót khác biệt lịch sử và làm migration v4 phức tạp.

**Hướng nâng cấp trực tiếp**

Dùng `migrate1to2`, `migrate2to3`, validate sau từng bước và lưu migration history.

## D. Evidence, findings và mô hình tin cậy

v0.2 đã gắn evidence với subject/revision/hash, nhưng bằng chứng vẫn do caller tự khai. “Subject-bound” không đồng nghĩa “truth-bound”.

### FOS2-035 — Agent có thể tự tạo evidence `pass` giả

- **Mức độ:** `CRITICAL`
- **Loại:** `TRUST`
- **Vị trí/bề mặt:** ``ForgeOrchestrator.addEvidence()`; `validateEvidence()``

**Phân tích**

Caller cung cấp status, digest, summary và method. Runtime chỉ kiểm tra shape, 64 hex và field presence; không chạy command, đọc URI hoặc tính lại digest.

**Hậu quả**

Mọi gate dựa trên evidence có thể bị vượt bởi một agent đã xác thực nhưng không đáng tin.

**Hướng nâng cấp trực tiếp**

Chỉ executor tin cậy được quyền phát hành evidence receipt; caller gửi yêu cầu chạy, không gửi kết quả pass.

### FOS2-036 — Cùng agent có thể mở rồi đóng critical finding bằng evidence tự khai

- **Mức độ:** `CRITICAL`
- **Loại:** `TRUST`
- **Vị trí/bề mặt:** ``closeFinding()` và evidence matching`

**Phân tích**

Ca tái hiện cho thấy một agent tạo finding critical, thêm evidence pass với digest giả và `manual-claim`, rồi đóng finding bằng chính evidence đó.

**Hậu quả**

Assurance và release blocker mất ý nghĩa chống tự duyệt.

**Hướng nâng cấp trực tiếp**

Áp policy separation-of-duty: producer, resolver và closer khác principal/role; critical cần human/security reviewer độc lập.

### FOS2-037 — `sha256` chỉ được kiểm tra định dạng, không kiểm tra nội dung

- **Mức độ:** `HIGH`
- **Loại:** `OVERCLAIM`
- **Vị trí/bề mặt:** ``validateEvidence()``

**Phân tích**

Chuỗi `aaaaaaaa...` được chấp nhận nếu đủ 64 ký tự. URI có thể null; method không có executor receipt.

**Hậu quả**

Trường digest tạo cảm giác mật mã nhưng không chứng minh payload nào.

**Hướng nâng cấp trực tiếp**

Evidence store phải nhận bytes/log qua trusted provider, tự hash và lưu content-addressed blob.

### FOS2-038 — `method.kind` là chuỗi tùy ý

- **Mức độ:** `HIGH`
- **Loại:** `TRUST`
- **Vị trí/bề mặt:** `evidence schema `method.additionalProperties:true``

**Phân tích**

`manual-claim`, `looks-good` hoặc bất kỳ nhãn nào đều đủ cho pass evidence nếu có field kind.

**Hậu quả**

Policy không phân biệt test runner thật với lời khai.

**Hướng nâng cấp trực tiếp**

Tạo registry method type: command/test/scanner/human-review/external-attestation; mỗi type có schema và verifier riêng.

### FOS2-039 — Không có policy ai được tạo evidence loại nào

- **Mức độ:** `HIGH`
- **Loại:** `AUTHORIZATION`
- **Vị trí/bề mặt:** ``addEvidence()``

**Phân tích**

Mọi principal hợp lệ có thể tạo `security-review`, `signed-provenance`, `formal-invariant-evidence` hoặc `independent-security-review`.

**Hậu quả**

A2–A4 có thể bị thỏa bằng principal không đủ thẩm quyền.

**Hướng nâng cấp trực tiếp**

RBAC/ABAC theo evidence type, organization, assurance và tool identity; ký receipt bằng executor key.

### FOS2-040 — Artifact producer có thể tạo evidence cho chính artifact

- **Mức độ:** `HIGH`
- **Loại:** `SEPARATION_OF_DUTY`
- **Vị trí/bề mặt:** `artifact/evidence flow`

**Phân tích**

Artifact verification cấm reviewer trùng producer, nhưng không cấm evidence producer trùng artifact producer.

**Hậu quả**

Người tạo artifact có thể tự tạo pass proof rồi nhờ bất kỳ principal thứ hai bấm verify.

**Hướng nâng cấp trực tiếp**

Policy evidence độc lập theo assurance; A2+ yêu cầu evidence producer khác artifact producer và reviewer.

### FOS2-041 — Finding closer chỉ cần authenticated principal

- **Mức độ:** `HIGH`
- **Loại:** `SEPARATION_OF_DUTY`
- **Vị trí/bề mặt:** ``closeFinding()``

**Phân tích**

Không yêu cầu role `security-reviewer`, ownership, tenant hoặc original reporter independence.

**Hậu quả**

Agent vận hành có thể tự xóa blocker mà không có người chịu trách nhiệm đúng vai trò.

**Hướng nâng cấp trực tiếp**

Định nghĩa finding workflow: assignee resolves, independent verifier validates, authorized closer closes.

### FOS2-042 — Evidence không có payload bắt buộc

- **Mức độ:** `MEDIUM`
- **Loại:** `INTEGRITY`
- **Vị trí/bề mặt:** `evidence contract`

**Phân tích**

URI có thể null; digest không trỏ đến blob mà store kiểm soát; summary là text caller.

**Hậu quả**

Sau này không thể tái kiểm tra bằng chứng hoặc xem output gốc.

**Hướng nâng cấp trực tiếp**

Bắt buộc content-addressed payload/receipt cho evidence pass; chỉ cho metadata-only ở status unverified.

### FOS2-043 — `semantic:false` khi thêm evidence có thể giữ approval/gate sống ngoài ý định

- **Mức độ:** `MEDIUM`
- **Loại:** `FRESHNESS`
- **Vị trí/bề mặt:** ``addEvidence(...,{semantic:false})``

**Phân tích**

Evidence được đưa vào semantic snapshot nhưng semanticRevision không tăng. Input hash làm gate cũ stale khi advance, nhưng approval chỉ bind semanticRevision có thể vẫn dùng sau khi tập evidence đổi.

**Hậu quả**

Một approval có thể được tiêu thụ trong bối cảnh proof khác với lúc cấp.

**Hướng nâng cấp trực tiếp**

Bind approval với action payload hash và semantic snapshot hash, không chỉ semanticRevision.

### FOS2-044 — Approval không bind toàn bộ payload hành động

- **Mức độ:** `MEDIUM`
- **Loại:** `AUDIT`
- **Vị trí/bề mặt:** `pending approval model`

**Phân tích**

Token gắn action string, principal, project revision và expiry, nhưng action như `select:<id>` mới đủ tốt nếu mọi tham số đều nằm trong action. Các hành động phức tạp dễ bỏ sót payload.

**Hậu quả**

Token có thể được tái diễn giải cho payload khác cùng action label.

**Hướng nâng cấp trực tiếp**

Tạo canonical action envelope và ký/hash toàn bộ args, expected revision và policy version.

### FOS2-045 — Không có API revoke/purge approval rõ ràng

- **Mức độ:** `MEDIUM`
- **Loại:** `LIFECYCLE`
- **Vị trí/bề mặt:** `pendingApprovals`

**Phân tích**

Approval hết hạn/đã dùng vẫn tích lũy; không có quản trị thu hồi sớm theo sự cố.

**Hậu quả**

Dữ liệu tăng và quyền nhạy cảm tồn tại tới expiry nếu bị lộ.

**Hướng nâng cấp trực tiếp**

Thêm revoke, consume audit, TTL cleanup và key rotation.

### FOS2-046 — `sourceCommit` do caller tự khai

- **Mức độ:** `MEDIUM`
- **Loại:** `PROVENANCE`
- **Vị trí/bề mặt:** `evidence subject`

**Phân tích**

Không có kiểm tra commit tồn tại, thuộc repository nào hay nội dung chạy có khớp.

**Hậu quả**

Evidence có thể gắn nhãn commit uy tín nhưng thực thi mã khác.

**Hướng nâng cấp trực tiếp**

Executor lấy source identity từ checkout immutable và ký receipt; không nhận commit từ request tự do.

### FOS2-047 — Research evidence bị sao chép sang `research`

- **Mức độ:** `MEDIUM`
- **Loại:** `DUPLICATION`
- **Vị trí/bề mặt:** ``addEvidence(): research: [..., evidence]``

**Phân tích**

Cùng object sống trong hai collection; update/migration/retention dễ lệch.

**Hậu quả**

Phình aggregate và có hai nguồn sự thật.

**Hướng nâng cấp trực tiếp**

`research` chỉ giữ evidence IDs hoặc bỏ collection derived, dựng projection khi đọc.

### FOS2-048 — Assurance chỉ yêu cầu tên evidence type

- **Mức độ:** `MEDIUM`
- **Loại:** `POLICY`
- **Vị trí/bề mặt:** ``ASSURANCE_PROFILES` + `evidenceForRule()``

**Phân tích**

`signed-provenance` và `independent-security-review` được kiểm tra như string label, không có method/issuer policy riêng.

**Hậu quả**

A3/A4 có vẻ nghiêm ngặt nhưng có thể thỏa bằng cùng primitive yếu.

**Hướng nâng cấp trực tiếp**

Mỗi evidence requirement là policy object: type, allowed issuers, method schema, independence, max age, artifact scope.

### FOS2-049 — Timestamp do server tạo nhưng không có trusted time/order

- **Mức độ:** `LOW`
- **Loại:** `TIME`
- **Vị trí/bề mặt:** `evidence/history`

**Phân tích**

Clock lùi hoặc nhiều node lệch giờ có thể làm thứ tự khó tin.

**Hậu quả**

Audit timeline không đủ cho distributed deployment.

**Hướng nâng cấp trực tiếp**

Dùng DB sequence/event number làm thứ tự chính; timestamp chỉ là metadata.

### FOS2-050 — README nói “một record security-review không phải proof” nhưng runtime vẫn gần như vậy

- **Mức độ:** `MEDIUM`
- **Loại:** `TERMINOLOGY`
- **Vị trí/bề mặt:** `README và evidence implementation`

**Phân tích**

Runtime yêu cầu thêm subject/method/digest, nhưng ba trường này vẫn là self-attestation không được xác minh.

**Hậu quả**

Tài liệu có thể khiến người dùng đánh giá quá cao trust boundary.

**Hướng nâng cấp trực tiếp**

Đổi ngôn ngữ thành “structured attestation” cho tới khi có trusted executor/verification.

## E. Artifact lifecycle, hash và lineage

v0.2 có lifecycle public, canonical content hash, DAG validation và invalidation. Nhưng hash chỉ bảo vệ một phần nội dung, còn envelope provenance/lifecycle có thể bị sửa mà integrity check vẫn qua.

### FOS2-051 — Artifact hash không bao phủ state/provenance/review/verification

- **Mức độ:** `CRITICAL`
- **Loại:** `INTEGRITY`
- **Vị trí/bề mặt:** ``artifactHash()``

**Phân tích**

Hash chỉ gồm type, schemaVersion, version, title, content, consumes, decisions và source idea. Ca tái hiện sửa state thành verified, đổi producer và chèn verification giả nhưng `assertArtifactIntegrity` vẫn chấp nhận.

**Hậu quả**

Tuyên bố “authenticated provenance” và “immutable artifact” quá mạnh; local tampering với lifecycle không bị phát hiện.

**Hướng nâng cấp trực tiếp**

Tách `contentHash` và `envelopeHash`; hash/sign toàn bộ immutable envelope hoặc lưu lifecycle dưới dạng signed append-only events.

### FOS2-052 — Cho phép draft → verified, bỏ qua review

- **Mức độ:** `HIGH`
- **Loại:** `LIFECYCLE`
- **Vị trí/bề mặt:** ``verifyArtifact()` chấp nhận draft hoặc review`

**Phân tích**

Điều kiện chỉ cấm superseded/invalidated/verified; draft có thể verify trực tiếp nếu có evidence.

**Hậu quả**

Reviewer step trong lifecycle không phải invariant, đặc biệt nguy hiểm với assurance cao.

**Hướng nâng cấp trực tiếp**

Định nghĩa state machine theo assurance: A0 có thể direct; A1+ draft→review→verified bắt buộc.

### FOS2-053 — Không kiểm tra role reviewer/verifier

- **Mức độ:** `HIGH`
- **Loại:** `AUTHORIZATION`
- **Vị trí/bề mặt:** ``reviewArtifact()`, `verifyArtifact()``

**Phân tích**

Chỉ cần principal hợp lệ và khác producer; agent/service bất kỳ có thể review/verify.

**Hậu quả**

Không có assurance rằng người phê duyệt có thẩm quyền hoặc độc lập tổ chức.

**Hướng nâng cấp trực tiếp**

Policy engine kiểm tra role, scope, tenant, team và evidence issuer.

### FOS2-054 — Kiểm tra độc lập chỉ dựa principal ID

- **Mức độ:** `MEDIUM`
- **Loại:** `INDEPENDENCE`
- **Vị trí/bề mặt:** `artifact review/verify`

**Phân tích**

Hai account/service do cùng agent hoặc cùng pipeline kiểm soát vẫn được coi độc lập.

**Hậu quả**

Dễ “tách ID” để vượt self-review guard.

**Hướng nâng cấp trực tiếp**

Định nghĩa trust domain/organization/team và minimum independent domains.

### FOS2-055 — Artifact registry chỉ kiểm tra top-level field tối thiểu

- **Mức độ:** `MEDIUM`
- **Loại:** `SCHEMA`
- **Vị trí/bề mặt:** ``artifact-registry.mjs``

**Phân tích**

Mỗi type yêu cầu một vài key không rỗng, nhưng nested structure và semantics gần như tự do.

**Hậu quả**

“Typed artifact” chưa đủ để tool/skill interoperability đáng tin.

**Hướng nâng cấp trực tiếp**

Tạo JSON Schema riêng cho từng artifact type, versioned và generated validator.

### FOS2-056 — Một active artifact duy nhất theo `type` gây nghẽn composition

- **Mức độ:** `HIGH`
- **Loại:** `MODEL`
- **Vị trí/bề mặt:** `active artifact uniqueness/project validator`

**Phân tích**

96 domain skill cùng produce `domain-blueprint`/`domain-evidence`; nhiều module hợp lệ không thể cùng active nếu uniqueness chỉ theo type.

**Hậu quả**

Skill graph có vẻ kết nối nhưng không thể biểu diễn nhiều instance/slot cùng loại.

**Hướng nâng cấp trực tiếp**

Dùng identity `(type, slot, version)` hoặc collection cardinality; gate/planner tham chiếu slot cụ thể.

### FOS2-057 — Replacement chỉ ghi `old.supersededBy`, không ghi `new.supersedes`

- **Mức độ:** `MEDIUM`
- **Loại:** `LINEAGE`
- **Vị trí/bề mặt:** ``supersedeArtifact()``

**Phân tích**

Lineage reverse cần scan toàn bộ project; artifact mới không tự mô tả tiền thân.

**Hậu quả**

Export riêng artifact mất ngữ cảnh replacement.

**Hướng nâng cấp trực tiếp**

Ghi quan hệ hai chiều hoặc event `ArtifactSuperseded(old,new)` làm nguồn sự thật.

### FOS2-058 — Supersede chưa nối chặt với outputCandidateIds của skill run

- **Mức độ:** `MEDIUM`
- **Loại:** `SKILL_RUN`
- **Vị trí/bề mặt:** `orchestrator skill-run/artifact paths`

**Phân tích**

Artifact tạo trong run được gắn candidate; replacement thủ công không chắc cập nhật run provenance/acceptance tương ứng.

**Hậu quả**

Utility/eval của skill có thể tham chiếu output cũ hoặc thiếu output mới.

**Hướng nâng cấp trực tiếp**

Artifact acceptance là command riêng gắn run, slot, candidate và supersession transaction.

### FOS2-059 — `invalidates` trong skill contract không được runtime thực thi tổng quát

- **Mức độ:** `MEDIUM`
- **Loại:** `FEATURE_GAP`
- **Vị trí/bề mặt:** `skill contracts vs orchestrator`

**Phân tích**

Invalidation xảy ra ở một số path cụ thể như replace ideas/supersede artifact, không từ contract declarative.

**Hậu quả**

Contract mô tả hành vi mạnh hơn engine thực hiện.

**Hướng nâng cấp trực tiếp**

Compiler contract thành invalidation rules hoặc bỏ field khỏi claim cho tới khi enforce.

### FOS2-060 — `decisions` chỉ là danh sách ID không được kiểm tra đầy đủ

- **Mức độ:** `MEDIUM`
- **Loại:** `REFERENTIAL_INTEGRITY`
- **Vị trí/bề mặt:** `artifact validation/project validator`

**Phân tích**

Artifact có thể tham chiếu decision không tồn tại.

**Hậu quả**

Lineage quyết định bị đứt dù DAG artifact hợp lệ.

**Hướng nâng cấp trực tiếp**

Thêm foreign-key validation cho decisions, risks, findings và run IDs.

### FOS2-061 — `residualRisks` và evidence refs không nằm trong content hash

- **Mức độ:** `MEDIUM`
- **Loại:** `HASH_SCOPE`
- **Vị trí/bề mặt:** ``artifactHash()``

**Phân tích**

Hai artifact có cùng hash dù danh sách residual risk/evidence khác.

**Hậu quả**

Hash được dùng như identity proof nhưng không phản ánh toàn bộ ý nghĩa release.

**Hướng nâng cấp trực tiếp**

Quyết định rõ: content hash cho payload, envelope hash cho mọi metadata; gate dùng envelope hash thích hợp.

### FOS2-062 — Review notes/verification metadata có thể sửa tại rest

- **Mức độ:** `MEDIUM`
- **Loại:** `TAMPER`
- **Vị trí/bề mặt:** `artifact schema/integrity`

**Phân tích**

Các field này không được hash/MAC; local editor có thể thay reviewer hoặc thời điểm mà hash content vẫn đúng.

**Hậu quả**

Audit trail không chống chỉnh sửa.

**Hướng nâng cấp trực tiếp**

Lưu review/verify thành event bất biến có signer và sequence.

### FOS2-063 — DAG kiểm tra tồn tại/cycle nhưng không kiểm tra version compatibility

- **Mức độ:** `LOW`
- **Loại:** `DEPENDENCY_SEMANTICS`
- **Vị trí/bề mặt:** `graph`

**Phân tích**

Consumes chỉ là artifact ID; không có required schema/version/range hoặc role của dependency.

**Hậu quả**

Artifact downstream có thể dựa trên version không tương thích về semantics.

**Hướng nâng cấp trực tiếp**

Contract dependency gồm type, slot, version constraint và content hash.

### FOS2-064 — Invalidation/supersession transitions chưa được formal hóa toàn cục

- **Mức độ:** `MEDIUM`
- **Loại:** `STATE_MACHINE`
- **Vị trí/bề mặt:** `artifact functions`

**Phân tích**

Mỗi helper có guard riêng, nhưng không có bảng transition/policy test đầy đủ cho mọi state/action/assurance.

**Hậu quả**

Edge case mới dễ mở đường transition bất hợp lệ.

**Hướng nâng cấp trực tiếp**

Dùng transition reducer duy nhất và property-based state-machine tests.

## F. Gate, semantic revision và assurance

Stale-gate là phần được sửa tốt nhất: gate có semantic revision và input digest. Tuy nhiên chất lượng gate vẫn phụ thuộc evidence tự khai và nhiều rule chấp nhận artifact draft.

### FOS2-065 — Hầu hết artifact gate chấp nhận cả `draft`

- **Mức độ:** `HIGH`
- **Loại:** `ASSURANCE`
- **Vị trí/bề mặt:** ``proof.ACTIVE_STATES`; `gates.mjs``

**Phân tích**

`activeArtifact` coi draft/review/verified đều active; product thesis, capability map, UX, architecture, threat model, execution plan và acceptance contract có thể mở gate khi còn draft.

**Hậu quả**

Stage tiến lên trước khi review/verify, trái kỳ vọng “evidence-gated” ở assurance cao.

**Hướng nâng cấp trực tiếp**

Rule chỉ rõ required state theo assurance và artifact type.

### FOS2-066 — Chỉ release dossier bắt buộc verified

- **Mức độ:** `HIGH`
- **Loại:** `ASSURANCE`
- **Vị trí/bề mặt:** ``GATE_RULES.release-readiness``

**Phân tích**

Các stage trước có thể tích lũy artifact chưa review, khiến release dossier cuối cùng dựa trên chuỗi đầu vào yếu.

**Hậu quả**

Verify cuối không bù được provenance từng bước.

**Hướng nâng cấp trực tiếp**

Áp progressive assurance: A1 review ở product/architecture; A2+ verified cho critical artifacts.

### FOS2-067 — A0 và A1 có profile runtime giống nhau

- **Mức độ:** `HIGH`
- **Loại:** `ASSURANCE`
- **Vị trí/bề mặt:** ``ASSURANCE_PROFILES``

**Phân tích**

Cả hai không yêu cầu evidence bổ sung, cho accepted critical và không block high.

**Hậu quả**

Tài liệu README mô tả A1 có unit/integration/E2E/security/rollback evidence, nhưng code không yêu cầu.

**Hướng nâng cấp trực tiếp**

Đồng bộ tài liệu và policy; A1 phải có danh sách evidence tối thiểu thực sự.

### FOS2-068 — README mô tả evidence level mạnh hơn code

- **Mức độ:** `HIGH`
- **Loại:** `DOCUMENTATION`
- **Vị trí/bề mặt:** `README assurance section vs `assurance.mjs``

**Phân tích**

A2 README nói property/mutation/fuzz/load/independent review, nhưng code A2 chỉ integration, E2E, tenant-isolation. A3/A4 cũng không khớp hoàn toàn mô tả.

**Hậu quả**

Người dùng chọn assurance dựa trên cam kết không được enforce.

**Hướng nâng cấp trực tiếp**

Sinh bảng README từ policy source hoặc test snapshot policy-doc parity.

### FOS2-069 — Assurance evidence chỉ là label

- **Mức độ:** `HIGH`
- **Loại:** `TRUST`
- **Vị trí/bề mặt:** ``assuranceRules()``

**Phân tích**

Mỗi requirement biến thành `evidenceRule(type)` và chỉ tìm evidence pass cùng type.

**Hậu quả**

Fake evidence primitive làm A4 có thể đạt mà không có formal proof/attestation thật.

**Hướng nâng cấp trực tiếp**

Policy object với issuer/method/signature/age/independence và verifier.

### FOS2-070 — Implementation gate yêu cầu evidence nhưng planner nhắm artifact `verified-build`

- **Mức độ:** `MEDIUM`
- **Loại:** `MODEL_MISMATCH`
- **Vị trí/bề mặt:** ``GATE_TO_ARTIFACT` vs `GATE_RULES``

**Phân tích**

Router có thể lên kế hoạch tạo artifact trong khi gate chỉ nhìn evidence type `build-output`/`feature-test`.

**Hậu quả**

Execution plan có thể “hoàn thành” output target nhưng gate vẫn fail.

**Hướng nâng cấp trực tiếp**

Chuẩn hóa gate target model gồm artifact + evidence obligations; planner tạo cả hai.

### FOS2-071 — `verification-report` vừa là artifact type vừa là evidence type

- **Mức độ:** `MEDIUM`
- **Loại:** `AMBIGUITY`
- **Vị trí/bề mặt:** `artifact registry/gate`

**Phân tích**

Hai namespace dùng cùng tên nhưng semantics khác; skill planner và gate remediation dễ nhầm.

**Hậu quả**

Tool có thể tạo đúng tên nhưng sai lớp object.

**Hướng nâng cấp trực tiếp**

Dùng namespace `artifact.verification-report` và `evidence.verification-run` hoặc typed target.

### FOS2-072 — Rerun gate thay thế kết quả cũ cùng stage

- **Mức độ:** `MEDIUM`
- **Loại:** `AUDIT`
- **Vị trí/bề mặt:** ``runCurrentGate(): filter(stage) + result``

**Phân tích**

Lịch sử project giữ event tóm tắt nhưng object gate đầy đủ cũ bị xóa.

**Hậu quả**

Mất snapshot rule/evidence/remediation trước đó, khó audit vì sao pass/fail thay đổi.

**Hướng nâng cấp trực tiếp**

Gate evaluations append-only; current gate là projection/reference.

### FOS2-073 — Gate score là tỷ lệ rule bằng trọng số

- **Mức độ:** `LOW`
- **Loại:** `SCORING`
- **Vị trí/bề mặt:** ``runGate()``

**Phân tích**

Blocker làm status fail nhưng score vẫn có thể cao; required rules có tầm quan trọng khác nhau nhưng cùng weight.

**Hậu quả**

Con số 90% dễ gây cảm giác gần sẵn sàng dù thiếu blocker quan trọng.

**Hướng nâng cấp trực tiếp**

Hiển thị blocker separately; score theo policy weight hoặc bỏ điểm tổng nếu không có semantics.

### FOS2-074 — `completelyMissing` dựa trên dữ liệu toàn project, không rule-specific

- **Mức độ:** `LOW`
- **Loại:** `STATUS`
- **Vị trí/bề mặt:** ``runGate()``

**Phân tích**

Chỉ cần một idea/evidence bất kỳ là status chuyển từ blocked sang fail dù stage thiếu toàn bộ input liên quan.

**Hậu quả**

Trạng thái blocked/fail không phản ánh khả năng hành động thật.

**Hướng nâng cấp trực tiếp**

Xác định blocked theo missing prerequisite graph và tool/resource availability.

### FOS2-075 — Approval bind semanticRevision nhưng không bind input digest

- **Mức độ:** `MEDIUM`
- **Loại:** `APPROVAL_FRESHNESS`
- **Vị trí/bề mặt:** `approval subsystem`

**Phân tích**

Có mutation semantic:false hoặc thay đổi external evidence không đổi revision mà ý nghĩa action đổi.

**Hậu quả**

Approval có thể được dùng cho snapshot khác.

**Hướng nâng cấp trực tiếp**

Bind canonical semantic input hash và exact args digest.

### FOS2-076 — Released project protection dựa vào API option nội bộ

- **Mức độ:** `MEDIUM`
- **Loại:** `SEALING`
- **Vị trí/bề mặt:** `ProjectStore update `allowReleased``

**Phân tích**

Public path có guard, nhưng library caller có thể sử dụng option nếu mở rộng sai.

**Hậu quả**

Seal là convention trong process, không cryptographic/DB policy.

**Hướng nâng cấp trực tiếp**

Tách immutable release aggregate; post-release changes tạo revision/branch mới, không unseal in-place.

## G. MCP tool surface và output contract

MCP lifecycle đã được cải thiện, nhưng ba tool quan trọng bị output schema tự chặn. Đây là ví dụ rõ rằng test gọi lớp nội bộ không đủ chứng minh public protocol.

### FOS2-077 — `forge_project_export` luôn lỗi qua MCP

- **Mức độ:** `HIGH`
- **Loại:** `PUBLIC_API`
- **Vị trí/bề mặt:** ``tool-registry.mjs:46,81`; `ProjectStore.exportBundle()``

**Phân tích**

Output schema yêu cầu `fileName` và `projectId`; implementation trả `filename`, revision, mimeType, sha256, content và thiếu projectId. MCP output validator trả `invalid_tool_output`.

**Hậu quả**

Export public được quảng bá nhưng client MCP không thể dùng.

**Hướng nâng cấp trực tiếp**

Sinh schema/type và implementation từ một source of truth; thêm golden contract test qua full MCP session.

### FOS2-078 — `forge_skills_route` luôn lỗi output

- **Mức độ:** `HIGH`
- **Loại:** `PUBLIC_API`
- **Vị trí/bề mặt:** ``tool-registry.mjs:57,92-95``

**Phân tích**

Schema khai báo `plan` là array; `nextAction()` trả plan object `{target,steps,...}`.

**Hậu quả**

Route skill qua MCP thất bại dù internal method chạy và đã ghi state.

**Hướng nâng cấp trực tiếp**

Sửa schema hoặc response; quan trọng hơn, validate trước side effect hoặc transaction rollback khi output invalid.

### FOS2-079 — `forge_next_action` luôn lỗi output

- **Mức độ:** `HIGH`
- **Loại:** `PUBLIC_API`
- **Vị trí/bề mặt:** ``tool-registry.mjs:67,109`; orchestrator `nextAction()``

**Phân tích**

Schema yêu cầu `plan` array và field `gate`; actual trả plan object cùng `latestGate`. `additionalProperties:false` làm response invalid.

**Hậu quả**

Nút chính Studio/MCP host nhận lỗi, trong khi route có thể đã được ghi hai lần.

**Hướng nâng cấp trực tiếp**

Dùng generated DTO và end-to-end test mọi tool.

### FOS2-080 — Tool có thể mutate rồi mới bị output validator từ chối

- **Mức độ:** `HIGH`
- **Loại:** `SIDE_EFFECT`
- **Vị trí/bề mặt:** ``mcp.mjs:121-126``

**Phân tích**

`callForgeTool` chạy trước; output validation sau. Với route/nextAction, project đã đổi revision/history dù client thấy lỗi.

**Hậu quả**

Retry của client có thể tạo thêm side effect và state divergence.

**Hướng nâng cấp trực tiếp**

Validate typed domain response trước commit hoặc dùng transaction command→serialize→commit; tối thiểu idempotency key.

### FOS2-081 — Public lifecycle test bypass một phần MCP output validation

- **Mức độ:** `MEDIUM`
- **Loại:** `TEST_GAP`
- **Vị trí/bề mặt:** `tests gọi `callForgeTool` trực tiếp`

**Phân tích**

Test internal chứng minh orchestrator, không chứng minh JSON-RPC/session/schema/wrapper cho từng tool.

**Hậu quả**

132 test vẫn bỏ lọt 3/25 tool công khai hỏng.

**Hướng nâng cấp trực tiếp**

Tạo table-driven conformance test initialize→ready→tools/call cho toàn bộ 25 tool với fixture prerequisites.

### FOS2-082 — Nhiều output dùng `freeObject`

- **Mức độ:** `MEDIUM`
- **Loại:** `SCHEMA_QUALITY`
- **Vị trí/bề mặt:** ``tool-registry.mjs``

**Phân tích**

Các field quan trọng được phép arbitrary object nên validator không bắt drift sâu.

**Hậu quả**

Tuyên bố runtime output schema mạnh hơn thực tế.

**Hướng nâng cấp trực tiếp**

Định nghĩa JSON Schema đầy đủ cho ProjectSummary, Gate, RoutePlan, Artifact, Evidence, Finding và reuse `$defs`.

### FOS2-083 — `forge_skills_route` route hai lần

- **Mức độ:** `MEDIUM`
- **Loại:** `DUPLICATION`
- **Vị trí/bề mặt:** `tool case gọi route rồi `nextAction`, trong khi nextAction lại route`

**Phân tích**

Một request tính route, sau đó `nextAction()` gọi `routeNextSkills()` lần nữa.

**Hậu quả**

Tăng revision/history, có thể cho kết quả khác khi utility/state đổi và tốn I/O.

**Hướng nâng cấp trực tiếp**

Tách `computeNextAction(project, routes)` pure function; chỉ persist route một lần.

### FOS2-084 — Một số read-only/idempotent semantics cần audit lại

- **Mức độ:** `LOW`
- **Loại:** `ANNOTATION`
- **Vị trí/bề mặt:** `tool annotations`

**Phân tích**

Export có thể không ghi server nhưng tạo payload lớn; route/next action ghi state nên không read-only. Metadata host phải đúng với side effect thật.

**Hậu quả**

Host có thể retry/cache/auto-run sai nếu annotation không chuẩn.

**Hướng nâng cấp trực tiếp**

Thêm automated annotation test đối chiếu command classification và mutation count.

### FOS2-085 — Client chỉ nhận lỗi output chung chung

- **Mức độ:** `MEDIUM`
- **Loại:** `ERROR_DIAGNOSTICS`
- **Vị trí/bề mặt:** ``invalid_tool_output``

**Phân tích**

Server log có errors nhưng client không biết field nào sai; request ID giúp tra log nhưng local user có thể không có sink.

**Hậu quả**

Khó sửa integration và dễ coi đây là lỗi host.

**Hướng nâng cấp trực tiếp**

Trong development trả safe schema error paths; production giữ stable code nhưng cung cấp diagnostics endpoint theo quyền.

### FOS2-086 — Tool schema được viết tay tách khỏi runtime schemas

- **Mức độ:** `MEDIUM`
- **Loại:** `CONTRACT_DRIFT`
- **Vị trí/bề mặt:** ``tool-registry.mjs` vs core schemas`

**Phân tích**

Tên field `fileName/filename`, `gate/latestGate` drift chính là hậu quả.

**Hậu quả**

Lỗi sẽ lặp khi model thay đổi.

**Hướng nâng cấp trực tiếp**

Sinh tool schemas, TypeScript/JSDoc types và serializers từ một canonical schema package.

### FOS2-087 — MCP cursors là offset base64 không ký

- **Mức độ:** `LOW`
- **Loại:** `PAGINATION`
- **Vị trí/bề mặt:** ``cursorPage()``

**Phân tích**

Cursor chỉ là số offset; list thay đổi giữa hai request gây skip/duplicate và client có thể sửa tùy ý.

**Hậu quả**

Pagination không ổn định ở catalog/resource động.

**Hướng nâng cấp trực tiếp**

Dùng opaque cursor chứa sort key+snapshot version và MAC.

### FOS2-088 — Initialize HTTP session được tạo trước khi params được chấp nhận

- **Mức độ:** `MEDIUM`
- **Loại:** `VALIDATION_ORDER`
- **Vị trí/bề mặt:** ``http-server.mjs:180-195``

**Phân tích**

Server lưu session rồi `handleMcpRpc` mới có thể trả unsupported/invalid initialize.

**Hậu quả**

Invalid request tạo orphan session và trả session header, gây memory DoS nhẹ.

**Hướng nâng cấp trực tiếp**

Validate initialize envelope/version trước khi allocate/persist session hoặc xóa session nếu result error.

## H. MCP HTTP transport, session, cấu hình và bảo mật mạng

Origin/version/session guard đã tiến bộ rõ. Các lỗi còn lại chủ yếu ở ownership DELETE, lifecycle memory, CORS/config drift và deployment boundary.

### FOS2-089 — Principal B có thể xóa MCP session của principal A

- **Mức độ:** `HIGH`
- **Loại:** `AUTHORIZATION`
- **Vị trí/bề mặt:** ``http-server.mjs:160-163``

**Phân tích**

POST kiểm tra `entry.principalId`, nhưng DELETE chỉ kiểm tra session tồn tại. Ca tái hiện: B gửi session ID của A và nhận 204; A sau đó nhận session_required.

**Hậu quả**

Denial-of-service giữa các principal và phá workflow đang chạy.

**Hướng nâng cấp trực tiếp**

Ở DELETE, authenticate owner, kiểm tra protocol version và dùng constant-time/opaque lookup policy.

### FOS2-090 — DELETE không yêu cầu `MCP-Protocol-Version`

- **Mức độ:** `MEDIUM`
- **Loại:** `PROTOCOL`
- **Vị trí/bề mặt:** `DELETE `/mcp` path`

**Phân tích**

POST non-initialize bắt header version; DELETE bỏ qua.

**Hậu quả**

Behavior transport không nhất quán và khó versioned session policy.

**Hướng nâng cấp trực tiếp**

Áp cùng validation cho mọi session-bound method.

### FOS2-091 — Session chỉ expire khi được truy cập

- **Mức độ:** `MEDIUM`
- **Loại:** `RESOURCE_LEAK`
- **Vị trí/bề mặt:** ``sessions` Map`

**Phân tích**

Không có periodic sweep, max sessions hoặc pressure eviction.

**Hậu quả**

Kẻ có key có thể tạo nhiều initialize hợp lệ rồi bỏ, tăng memory tới TTL nhưng không bị cleanup nếu không truy cập.

**Hướng nâng cấp trực tiếp**

Thêm timer sweep, max per principal/IP, global cap và metrics.

### FOS2-092 — Rate-limit bucket không được dọn

- **Mức độ:** `MEDIUM`
- **Loại:** `RESOURCE_LEAK`
- **Vị trí/bề mặt:** ``createRateLimiter()``

**Phân tích**

Map giữ key principal+IP vĩnh viễn; bucket cũ chỉ thay khi cùng key quay lại.

**Hậu quả**

Nhiều IP/principal làm memory tăng không giới hạn.

**Hướng nâng cấp trực tiếp**

Thêm expiry sweep hoặc LRU/TTL map.

### FOS2-093 — Không expose `Mcp-Session-Id` cho browser

- **Mức độ:** `MEDIUM`
- **Loại:** `CORS`
- **Vị trí/bề mặt:** ``cors()``

**Phân tích**

Header được trả nhưng thiếu `Access-Control-Expose-Headers`.

**Hậu quả**

Cross-origin browser client hợp lệ không đọc được session ID bằng JavaScript.

**Hướng nâng cấp trực tiếp**

Expose `mcp-session-id`, `mcp-protocol-version`, `x-request-id`, rate headers cho origin được phép.

### FOS2-094 — `.env.example` dùng sai tên biến origin

- **Mức độ:** `HIGH`
- **Loại:** `CONFIG`
- **Vị trí/bề mặt:** ``.env.example` vs runtime`

**Phân tích**

Example dùng `FORGEOS_ALLOW_ORIGIN`; CLI đọc `FORGEOS_ALLOWED_ORIGINS`.

**Hậu quả**

Người dùng tưởng đã khóa origin nhưng cấu hình bị bỏ qua.

**Hướng nâng cấp trực tiếp**

Dùng một tên duy nhất; startup cảnh báo biến legacy/unknown và test `.env.example` parity.

### FOS2-095 — Default allowed origin dùng full base URL thay vì origin

- **Mức độ:** `MEDIUM`
- **Loại:** `CONFIG`
- **Vị trí/bề mặt:** ``origins = [baseUrl]``

**Phân tích**

Nếu `publicBaseUrl` có path, allowed set chứa path trong khi HTTP Origin không có path.

**Hậu quả**

Client hợp lệ bị 403 hoặc người vận hành mở allowlist quá rộng để sửa.

**Hướng nâng cấp trực tiếp**

Dùng `new URL(baseUrl).origin` và normalize mọi origin.

### FOS2-096 — `publicBaseUrl` cho phép credentials/query/fragment/path

- **Mức độ:** `MEDIUM`
- **Loại:** `INPUT_VALIDATION`
- **Vị trí/bề mặt:** ``parsePublicUrl()``

**Phân tích**

Hàm chỉ kiểm protocol rồi bỏ slash cuối. URL như `https://user:pass@host/path?x#y` có thể đi vào Agent Card/link.

**Hậu quả**

Rò credentials hoặc tạo endpoint metadata sai.

**Hướng nâng cấp trực tiếp**

Cấm username/password/query/hash; xác định rõ có cho base path hay không và join URL bằng `new URL()`.

### FOS2-097 — Docker mặc định không khởi động

- **Mức độ:** `HIGH`
- **Loại:** `DEPLOYMENT`
- **Vị trí/bề mặt:** ``Dockerfile` và CLI network guard`

**Phân tích**

Docker đặt `HOST=0.0.0.0`, nhưng không đặt API key hay insecure override. Ca tái hiện process ném lỗi ngay.

**Hậu quả**

Image out-of-box unusable dù Dockerfile trông hoàn chỉnh.

**Hướng nâng cấp trực tiếp**

Chọn loopback trong container không hữu dụng; tốt hơn yêu cầu secret rõ qua health/error docs, hoặc entrypoint validate và thông báo; compose example phải cấu hình auth.

### FOS2-098 — Network guard chỉ ở CLI main

- **Mức độ:** `HIGH`
- **Loại:** `SECURITY_BOUNDARY`
- **Vị trí/bề mặt:** ``if(process.argv[1]===...)``

**Phân tích**

Library caller có thể `createHttpServer()` rồi listen `0.0.0.0` không key; factory tự cấp anonymous wildcard principal khi không có keys.

**Hậu quả**

Ứng dụng nhúng có thể vô tình expose toàn bộ API.

**Hướng nâng cấp trực tiếp**

Factory nhận listen policy/requireAuth hoặc middleware fail-closed; anonymous chỉ cho explicit local mode.

### FOS2-099 — CSP connect/image destinations rộng

- **Mức độ:** `MEDIUM`
- **Loại:** `CSP`
- **Vị trí/bề mặt:** ``html()` CSP`

**Phân tích**

`connect-src https: http:` và `img-src data: https:` cho phép mọi host theo scheme.

**Hậu quả**

Nếu UI có injection hoặc dependency tương lai, exfiltration dễ hơn.

**Hướng nâng cấp trực tiếp**

Sinh CSP từ exact public base/origins/resource domains và nonce; mặc định self.

### FOS2-100 — `requestTimeout` không hủy operation phía dưới

- **Mức độ:** `MEDIUM`
- **Loại:** `TIMEOUT`
- **Vị trí/bề mặt:** `Node server timeout config`

**Phân tích**

Timeout socket không truyền AbortSignal vào orchestrator, filesystem hoặc A2A action.

**Hậu quả**

Client bỏ đi nhưng công việc vẫn chạy/mutate.

**Hướng nâng cấp trực tiếp**

Tạo request context có AbortSignal/deadline; command kiểm tra cancellation trước commit.

### FOS2-101 — Session Map theo process cản horizontal scaling

- **Mức độ:** `MEDIUM`
- **Loại:** `SCALABILITY`
- **Vị trí/bề mặt:** `HTTP server`

**Phân tích**

MCP session nằm RAM instance; request qua node khác sẽ “session required”.

**Hậu quả**

Cần sticky session và mất session khi restart.

**Hướng nâng cấp trực tiếp**

Dùng shared session store hoặc stateless signed session token nếu phù hợp.

### FOS2-102 — Version negotiation initialize quá cứng

- **Mức độ:** `MEDIUM`
- **Loại:** `PROTOCOL`
- **Vị trí/bề mặt:** ``mcp.mjs:85-88``

**Phân tích**

Runtime chỉ chấp nhận đúng một string và trả lỗi nếu khác. Đặc tả MCP lifecycle cho phép server đáp lại phiên bản hỗ trợ khi client đề nghị phiên bản khác, thay vì nhất thiết fail ngay.

**Hậu quả**

Khả năng tương tác với client version gần kề kém hơn cần thiết.

**Hướng nâng cấp trực tiếp**

Implement negotiation theo official lifecycle và test version matrix.

### FOS2-103 — Duplicate `notifications/initialized` bị bỏ qua

- **Mức độ:** `LOW`
- **Loại:** `LIFECYCLE`
- **Vị trí/bề mặt:** ``mcp.mjs:98-103``

**Phân tích**

Notification lần hai không lỗi/cảnh báo.

**Hậu quả**

Client bug khó phát hiện và state machine kém nghiêm.

**Hướng nâng cấp trực tiếp**

Log protocol violation hoặc trả error cho request form; notification invalid nên ignore nhưng metric.

## I. A2A task store, lifecycle và Agent Card

A2A 1.0 wire shape tiến bộ đáng kể. Nhưng persistence/task lifecycle vẫn có race, memory bug, history bug và “defer” không có executor.

### FOS2-104 — A2A file store mất update giữa hai instance

- **Mức độ:** `CRITICAL`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** ``A2aTaskStore.update()``

**Phân tích**

Queue chỉ nằm trong instance; không có process lock/CAS. Ca tái hiện hai store cùng update một task: cả hai fulfilled, revision cuối 1 và chỉ một metadata field còn.

**Hậu quả**

Task history/status/artifact có thể mất trong deployment nhiều worker.

**Hướng nâng cấp trực tiếp**

Dùng cùng transactional DB với ProjectStore, revision CAS và row lock.

### FOS2-105 — Create task có TOCTOU duplicate race

- **Mức độ:** `HIGH`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** ``readFile` rồi `durableWrite``

**Phân tích**

Hai process cùng thấy ENOENT rồi cùng rename file.

**Hậu quả**

Task ID có thể bị overwrite dù API kỳ vọng duplicate error.

**Hướng nâng cấp trực tiếp**

Dùng exclusive create (`wx`) hoặc unique constraint DB.

### FOS2-106 — Temp filename có thể collision trong cùng ms

- **Mức độ:** `MEDIUM`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** ``pid + Date.now()``

**Phân tích**

Hai store cùng process ghi cùng task trong cùng millisecond có thể dùng cùng temp path.

**Hậu quả**

Write conflict/corrupt temp trong race hiếm.

**Hướng nâng cấp trực tiếp**

Thêm randomUUID hoặc open `wx`.

### FOS2-107 — Queue cleanup so sánh sai Promise

- **Mức độ:** `MEDIUM`
- **Loại:** `MEMORY`
- **Vị trí/bề mặt:** ``a2a-task-store.mjs:37-50``

**Phân tích**

Map lưu `previous.then(()=>tail)` nhưng finally so với `tail`, nên condition không bao giờ đúng.

**Hậu quả**

Mỗi task ID từng update lưu entry vĩnh viễn trong RAM.

**Hướng nâng cấp trực tiếp**

Lưu biến `queuedTail` và so sánh đúng; regression test Map size qua instrumentation.

### FOS2-108 — MemoryA2aTaskStore.list() ném lỗi

- **Mức độ:** `HIGH`
- **Loại:** `BUG`
- **Vị trí/bề mặt:** ``.map(structuredClone)``

**Phân tích**

`Array.map` truyền index làm đối số thứ hai của `structuredClone` (options), không phải callback một tham số an toàn.

**Hậu quả**

A2A `ListTasks` với default memory store trả internal error.

**Hướng nâng cấp trực tiếp**

Dùng `.map((value)=>structuredClone(value))` và test memory/file implementations chung contract suite.

### FOS2-109 — Memory store update không serialize

- **Mức độ:** `HIGH`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** ``MemoryA2aTaskStore.update()``

**Phân tích**

Hai async updater cùng đọc revision rồi overwrite nhau.

**Hậu quả**

Test/dev behavior khác production file store và có thể mất history.

**Hướng nâng cấp trực tiếp**

Dùng mutex/CAS hoặc dùng một in-memory transactional adapter đúng contract.

### FOS2-110 — `historyLength: 0` trả toàn bộ history

- **Mức độ:** `MEDIUM`
- **Loại:** `BUG`
- **Vị trí/bề mặt:** ``publicTask(): slice(-historyLength)``

**Phân tích**

Trong JS, `-0` là 0 và `slice(0)` trả toàn array. ListTasks gọi historyLength 0 nhưng vẫn trả history đầy đủ.

**Hậu quả**

Rò dữ liệu, payload lớn và vi phạm pagination expectation.

**Hướng nâng cấp trực tiếp**

Xử lý 0 riêng: `history=[]`; positive dùng `slice(-n)`.

### FOS2-111 — ListTasks đọc và parse toàn bộ task trước pagination

- **Mức độ:** `MEDIUM`
- **Loại:** `SCALABILITY`
- **Vị trí/bề mặt:** ``A2aTaskStore.list()` + A2A handler`

**Phân tích**

Mỗi request list scan toàn directory, parse JSON, filter, sort rồi slice.

**Hậu quả**

Độ trễ O(n), memory spike và không phù hợp task history dài.

**Hướng nâng cấp trực tiếp**

Dùng indexed DB query theo owner/status/context/createdAt.

### FOS2-112 — Page token offset không ổn định

- **Mức độ:** `MEDIUM`
- **Loại:** `PAGINATION`
- **Vị trí/bề mặt:** `A2A ListTasks`

**Phân tích**

Task mới chèn vào đầu giữa các page làm client skip/duplicate.

**Hậu quả**

Không có snapshot pagination.

**Hướng nâng cấp trực tiếp**

Dùng keyset cursor `(createdAt,id)` kèm filter hash/MAC.

### FOS2-113 — Task hỏng bị list bỏ qua âm thầm

- **Mức độ:** `MEDIUM`
- **Loại:** `OBSERVABILITY`
- **Vị trí/bề mặt:** ``A2aTaskStore.list()` catch rỗng`

**Phân tích**

Không diagnostic/log/metric trong list; direct get có thể thành not found generic.

**Hậu quả**

Mất task có thể bị che như chưa từng tồn tại.

**Hướng nâng cấp trực tiếp**

Quarantine + diagnostics như ProjectStore; phân biệt corrupt/not-found.

### FOS2-114 — Task file không được runtime schema validate

- **Mức độ:** `HIGH`
- **Loại:** `VALIDATION`
- **Vị trí/bề mặt:** `A2A task store`

**Phân tích**

JSON được parse rồi dùng trực tiếp; không safe-object check, size cap, hash hoặc state invariant.

**Hậu quả**

Tampering/corruption có thể chảy vào response hoặc lifecycle update.

**Hướng nâng cấp trực tiếp**

Tạo A2A Task schema, validate on read/write và content hash/event log.

### FOS2-115 — `task.defer` không có worker/queue thực

- **Mức độ:** `HIGH`
- **Loại:** `FEATURE_THEATER`
- **Vị trí/bề mặt:** ``executeAction()` và SendMessage defer path`

**Phân tích**

Action chỉ ghi metadata `deferred:true`, trả submitted và dừng. Không có poller, lease, resume, executor assignment hay completion path.

**Hậu quả**

Task có thể ở submitted mãi; “accepted for external execution” là lời hứa chưa được triển khai.

**Hướng nâng cấp trực tiếp**

Hoặc xóa action khỏi public card, hoặc xây durable job queue/outbox/worker API.

### FOS2-116 — Cancel không abort action đang chạy

- **Mức độ:** `HIGH`
- **Loại:** `CANCELLATION`
- **Vị trí/bề mặt:** `SendMessage synchronous action + `CancelTask``

**Phân tích**

Không có AbortController/lease check. Nếu cancel request song song, action cũ vẫn có thể ghi completed sau canceled.

**Hậu quả**

Terminal state bị overwrite và side effect vẫn xảy ra.

**Hướng nâng cấp trực tiếp**

Command worker giữ cancellation token/fencing revision; commit completed chỉ khi state vẫn WORKING và lease hợp lệ.

### FOS2-117 — Store không enforce legal task transitions

- **Mức độ:** `MEDIUM`
- **Loại:** `STATE_MACHINE`
- **Vị trí/bề mặt:** `task updater`

**Phân tích**

Bất kỳ internal updater có thể chuyển state tùy ý.

**Hậu quả**

Future code dễ chuyển terminal→working hoặc skip required history.

**Hướng nâng cấp trực tiếp**

Dùng reducer `transitionTask(expectedRevision, event)` với bảng transition và property tests.

### FOS2-118 — A2A chỉ expose sáu action nhỏ

- **Mức độ:** `MEDIUM`
- **Loại:** `SCOPE`
- **Vị trí/bề mặt:** ``executeAction()``

**Phân tích**

Card nói exchange typed artifacts/interoperability rộng, nhưng action thực tế chỉ project create/get/next, gate, route và defer.

**Hậu quả**

Agent khác không thể review/verify artifact, add evidence, manage findings qua A2A.

**Hướng nâng cấp trực tiếp**

Hoặc thu hẹp mô tả card, hoặc versioned action registry đầy đủ với schemas.

### FOS2-119 — `GetExtendedAgentCard` tồn tại khi capability false

- **Mức độ:** `LOW`
- **Loại:** `CAPABILITY_MISMATCH`
- **Vị trí/bề mặt:** `Agent Card `extendedAgentCard:false` và handler`

**Phân tích**

Method vẫn trả public card giống hệt.

**Hậu quả**

Capability semantics gây khó hiểu cho client.

**Hướng nâng cấp trực tiếp**

Không expose method khi false, hoặc implement authenticated extended card và set true.

### FOS2-120 — Agent Card quảng bá `/docs` nhưng endpoint trả 404

- **Mức độ:** `MEDIUM`
- **Loại:** `BROKEN_LINK`
- **Vị trí/bề mặt:** ``documentationUrl`; HTTP routes`

**Phân tích**

Ca HTTP thật xác nhận 404.

**Hậu quả**

Client discovery dẫn người dùng tới tài liệu không tồn tại.

**Hướng nâng cấp trực tiếp**

Phục vụ docs route hoặc dùng URL tài liệu công khai thật được kiểm tra trong smoke test.

### FOS2-121 — Tham số `tenant` được nhận nhưng bỏ qua

- **Mức độ:** `MEDIUM`
- **Loại:** `TENANCY`
- **Vị trí/bề mặt:** `A2A request schemas/handlers`

**Phân tích**

Client có thể nghĩ request được scope tenant, nhưng ownership chỉ theo principal ID.

**Hậu quả**

Nguy cơ nhầm isolation khi triển khai multi-tenant.

**Hướng nâng cấp trực tiếp**

Bỏ tenant khỏi schema cho tới khi có tenant context, hoặc enforce tenant+principal+project ACL.

### FOS2-122 — Task owner chỉ là principal ID string

- **Mức độ:** `MEDIUM`
- **Loại:** `IDENTITY`
- **Vị trí/bề mặt:** `task record`

**Phân tích**

Không lưu principal type, issuer hoặc tenant. Hai IdP cùng ID có thể collision nếu tích hợp sau này.

**Hậu quả**

Ownership không đủ mạnh cho federated auth.

**Hướng nâng cấp trực tiếp**

Dùng canonical subject `{issuer,tenant,type,id}`.

### FOS2-123 — Không có TTL/archive/dead-letter cho task

- **Mức độ:** `MEDIUM`
- **Loại:** `RETENTION`
- **Vị trí/bề mặt:** `A2A store`

**Phân tích**

Task và history tăng vĩnh viễn; deferred task không được thu gom.

**Hậu quả**

Disk/list latency tăng, dữ liệu nhạy cảm tồn tại lâu.

**Hướng nâng cấp trực tiếp**

Policy retention, archive, tombstone và dead-letter queue.

### FOS2-124 — GetTask biến mọi lỗi thành not found

- **Mức độ:** `MEDIUM`
- **Loại:** `ERROR_HANDLING`
- **Vị trí/bề mặt:** `catch chung`

**Phân tích**

Corrupt file, permission error và I/O failure đều trả Task not found.

**Hậu quả**

Che incident vận hành và làm client tạo task trùng.

**Hướng nâng cấp trực tiếp**

Chỉ map ENOENT/ownership sang not found; lỗi khác thành internal code có request ID.

## J. Skill graph, router và planner

v0.2 đã nối vocabulary tốt hơn v0.1, nhưng phần lớn contract được sinh theo heuristic pack/tên. 242 skill có độ đa dạng runtime thấp và nhiều metadata chưa được enforce.

### FOS2-125 — 242 skill chỉ tạo khoảng 45 flow signature khác nhau

- **Mức độ:** `HIGH`
- **Loại:** `OVERCLAIM`
- **Vị trí/bề mặt:** ``skills/catalog.json`; generated contracts`

**Phân tích**

Nhiều skill khác tên/prose nhưng dùng cùng consumes/produces/tools/stage template.

**Hậu quả**

Số lượng 242 phóng đại mức đa dạng hành vi mà router thực sự hiểu.

**Hướng nâng cấp trực tiếp**

Đo capability theo unique executable contract/method, không theo số file.

### FOS2-126 — 96 domain skill có cùng I/O `product-definition → domain-blueprint/domain-evidence`

- **Mức độ:** `HIGH`
- **Loại:** `MODEL`
- **Vị trí/bề mặt:** `domain contracts`

**Phân tích**

Khác biệt domain chủ yếu nằm ở văn bản method/reference; graph type không phân biệt module domain.

**Hậu quả**

Planner không biết output của analytics khác output billing/game/ecommerce.

**Hướng nâng cấp trực tiếp**

Dùng typed artifact subtypes/slots như `domain-blueprint:billing`, `:analytics`.

### FOS2-127 — Active artifact uniqueness làm domain skill không composable

- **Mức độ:** `HIGH`
- **Loại:** `COMPOSITION`
- **Vị trí/bề mặt:** `artifact policy + shared output type`

**Phân tích**

Chạy skill domain thứ hai tạo active output cùng type hoặc buộc supersede skill trước.

**Hậu quả**

Một sản phẩm cần nhiều domain concern không thể biểu diễn tự nhiên.

**Hướng nâng cấp trực tiếp**

Artifact cardinality/slot và aggregate domain map.

### FOS2-128 — Flow được harden bằng substring/pack heuristic

- **Mức độ:** `HIGH`
- **Loại:** `GENERATION`
- **Vị trí/bề mặt:** ``config/skill-flow.mjs`/generation scripts`

**Phân tích**

Contract topology không được tác giả từng skill xác nhận; tên/pack quyết định I/O.

**Hậu quả**

Skill đổi tên hoặc edge case dễ nhận flow sai nhưng vẫn schema-valid.

**Hướng nâng cấp trực tiếp**

Mỗi skill có source contract curated; generator chỉ validate/compile, không suy luận semantics từ tên.

### FOS2-129 — Toàn catalog không có conflict declarations

- **Mức độ:** `MEDIUM`
- **Loại:** `CONFLICTS`
- **Vị trí/bề mặt:** `catalog analysis`

**Phân tích**

Scorer có logic conflict nhưng dữ liệu luôn rỗng.

**Hậu quả**

Tính năng conflict-aware routing hiện gần như giả.

**Hướng nâng cấp trực tiếp**

Định nghĩa resource/conflict groups thực tế và enforce exclusive lease khi run.

### FOS2-130 — Ngay cả có conflict, router chỉ trừ điểm

- **Mức độ:** `MEDIUM`
- **Loại:** `CONFLICT_POLICY`
- **Vị trí/bề mặt:** `router scoring`

**Phân tích**

Conflict không loại skill hay chặn start.

**Hậu quả**

Hai skill xung đột vẫn có thể chạy đồng thời.

**Hướng nâng cấp trực tiếp**

Tách hard constraints khỏi ranking; conflict là feasibility predicate/lock.

### FOS2-131 — Tool requirements rất nghèo và generic

- **Mức độ:** `MEDIUM`
- **Loại:** `TOOLS`
- **Vị trí/bề mặt:** `catalog requiredTools distribution`

**Phân tích**

Chỉ vài nhãn như filesystem/shell/test-runner/web-search/security-scanner; phần lớn skill không khai tool thực.

**Hậu quả**

Router khó chứng minh executable trong host cụ thể.

**Hướng nâng cấp trực tiếp**

Tool capability schema versioned, permissions, input/output types và provider constraints.

### FOS2-132 — Domain `all` làm mọi domain skill eligible

- **Mức độ:** `MEDIUM`
- **Loại:** `DOMAIN`
- **Vị trí/bề mặt:** `router domain predicate`

**Phân tích**

Project mặc định all có thể nhận SaaS, game, ecommerce skill chỉ dựa score/text.

**Hậu quả**

Route nhiễu và tốn context.

**Hướng nâng cấp trực tiếp**

`all` nên nghĩa generic-only cho tới khi domain được chọn; domain expansion phải explicit.

### FOS2-133 — Planner `allowed()` bỏ qua nhiều ràng buộc runtime

- **Mức độ:** `HIGH`
- **Loại:** `PLANNER`
- **Vị trí/bề mặt:** `planner`

**Phân tích**

Không đầy đủ tools, stage, preconditions, conflicts, channel, active slot collision và risk state.

**Hậu quả**

Plan có đường type nhưng không thể thực thi.

**Hướng nâng cấp trực tiếp**

Dùng constraint solver với full state snapshot; mỗi step có proof of feasibility và missing requirements.

### FOS2-134 — Graph reachability test không phản ánh executable reachability

- **Mức độ:** `MEDIUM`
- **Loại:** `REACHABILITY`
- **Vị trí/bề mặt:** `skill graph tests`

**Phân tích**

Test có thể bỏ qua domain/assurance/tool/stage/precondition và chỉ nối type.

**Hậu quả**

“Path to release dossier” có thể tồn tại trên giấy nhưng không chạy trong project cụ thể.

**Hướng nâng cấp trực tiếp**

Test reachable theo nhiều scenario matrix và simulate start/complete artifact transitions.

### FOS2-135 — Producer được chọn theo stable/token/name hơn là chất lượng context

- **Mức độ:** `MEDIUM`
- **Loại:** `SELECTION`
- **Vị trí/bề mặt:** `planner producer ordering`

**Phân tích**

Không xét method fit, provider, historical utility confidence, evidence rigor hay current risks đầy đủ.

**Hậu quả**

Plan tối thiểu token có thể kém đúng.

**Hướng nâng cấp trực tiếp**

Cost function đa mục tiêu có calibrated utility và hard assurance constraints.

### FOS2-136 — `skillChannel` không xuyên suốt planner

- **Mức độ:** `MEDIUM`
- **Loại:** `CHANNEL`
- **Vị trí/bề mặt:** `router vs planToArtifact`

**Phân tích**

Route có thể lọc candidate/stable, nhưng prerequisite plan có thể chọn producer khác channel.

**Hậu quả**

Output plan mâu thuẫn policy release.

**Hướng nâng cấp trực tiếp**

Truyền channel vào mọi graph search và validate final plan.

### FOS2-137 — Route được tính từ snapshot rồi ghi mà không CAS semantic snapshot

- **Mức độ:** `HIGH`
- **Loại:** `RACE`
- **Vị trí/bề mặt:** ``routeNextSkills()``

**Phân tích**

Project có thể đổi giữa read/compute/update; route stale vẫn được persist nếu updater không kiểm expected semanticRevision/hash.

**Hậu quả**

Agent chạy kế hoạch dựa state cũ.

**Hướng nâng cấp trực tiếp**

Route command dùng expected semanticRevision/inputHash; retry compute khi conflict.

### FOS2-138 — Duplicate route vẫn có thể tăng revision

- **Mức độ:** `LOW`
- **Loại:** `NOISE`
- **Vị trí/bề mặt:** `route persistence`

**Phân tích**

Dù nội dung giống, update path vẫn ghi/snapshot/revision.

**Hậu quả**

History/revision noise và contention.

**Hướng nâng cấp trực tiếp**

Detect no-op trước transaction hoặc store route as cache keyed input hash.

### FOS2-139 — README đưa ví dụ contract không khớp file thật

- **Mức độ:** `MEDIUM`
- **Loại:** `DOC_DRIFT`
- **Vị trí/bề mặt:** `ví dụ `designing-api-contracts``

**Phân tích**

Tài liệu nói consumes/produces khác catalog hiện tại.

**Hậu quả**

Người tích hợp xây expectation sai.

**Hướng nâng cấp trực tiếp**

Sinh documentation examples trực tiếp từ catalog trong CI.

### FOS2-140 — `reviewerRole`/gate rules trong contract không được engine enforce

- **Mức độ:** `HIGH`
- **Loại:** `ENFORCEMENT`
- **Vị trí/bề mặt:** `skill contract metadata`

**Phân tích**

Các field giàu nghĩa chỉ được validate tồn tại; start/complete không thực thi chúng.

**Hậu quả**

Contract trông như policy nhưng chỉ là documentation.

**Hướng nâng cấp trực tiếp**

Compile contract thành executable pre/postcondition/policy checks.

### FOS2-141 — `requiredEvidence` và `requiredFields` không được completeSkillRun kiểm tra theo contract đầy đủ

- **Mức độ:** `HIGH`
- **Loại:** `ENFORCEMENT`
- **Vị trí/bề mặt:** `skill run completion`

**Phân tích**

Runtime chủ yếu kiểm output artifacts/metrics; method handoff requirements không trở thành invariant chi tiết.

**Hậu quả**

Skill có thể “completed” với output sơ sài.

**Hướng nâng cấp trực tiếp**

Artifact schema + evidence obligations + field predicates phải được validator dùng trước complete.

### FOS2-142 — `invalidates`/context limits/reference depth/verbosity chỉ là metadata

- **Mức độ:** `MEDIUM`
- **Loại:** `ENFORCEMENT`
- **Vị trí/bề mặt:** `skill contracts`

**Phân tích**

Runtime không đo token/context bundle hay tự invalidation theo field.

**Hậu quả**

Tuyên bố context-bounded/invalidation-aware bị phóng đại.

**Hướng nâng cấp trực tiếp**

Executor receipt ghi actual tokens/context IDs; engine enforce max và invalidation policy.

### FOS2-143 — Method/procedure/verification là prose, không executable

- **Mức độ:** `MEDIUM`
- **Loại:** `PROCEDURE`
- **Vị trí/bề mặt:** `SKILL.md/contracts`

**Phân tích**

Validator chỉ đếm số dòng/mục.

**Hậu quả**

Skill có thể qua lint dù phương pháp không được thực thi hoặc kiểm chứng.

**Hướng nâng cấp trực tiếp**

Tách machine checks khỏi guidance; procedure prose không được dùng làm proof.

### FOS2-144 — Nhiều core skill cùng produce generic type

- **Mức độ:** `HIGH`
- **Loại:** `OUTPUT_COLLISION`
- **Vị trí/bề mặt:** `catalog`

**Phân tích**

26/38 output type có nhiều producer; một số type có hàng chục producer.

**Hậu quả**

Planner khó phân biệt mục đích và artifact active collision.

**Hướng nâng cấp trực tiếp**

Namespace output theo capability/slot và define substitutability groups rõ.

### FOS2-145 — Gate failure → target mapping còn thô

- **Mức độ:** `MEDIUM`
- **Loại:** `TARGETING`
- **Vị trí/bề mặt:** ``GATE_TO_ARTIFACT``

**Phân tích**

Một string rule ánh xạ một artifact, không biểu diễn evidence, multiple obligations hoặc alternative paths đầy đủ.

**Hậu quả**

Remediation plan bỏ sót proof/role/tool.

**Hướng nâng cấp trực tiếp**

Dùng typed goal graph với AND/OR policy nodes.

### FOS2-146 — Catalog cache chưa có robust invalidation/version identity

- **Mức độ:** `MEDIUM`
- **Loại:** `CACHE`
- **Vị trí/bề mặt:** `skill catalog loading`

**Phân tích**

Metadata cache cải thiện I/O nhưng thay đổi contract/file có thể drift nếu không hash dependency đầy đủ.

**Hậu quả**

Router dùng catalog stale trong long-running process.

**Hướng nâng cấp trực tiếp**

Catalog build có content digest; hot reload atomic hoặc restart-required rõ ràng.

### FOS2-147 — Skill contract nói provider-neutral nhưng method có thể phụ thuộc ngầm vào tool

- **Mức độ:** `MEDIUM`
- **Loại:** `PORTABILITY`
- **Vị trí/bề mặt:** `references/procedures`

**Phân tích**

RequiredTools rỗng hoặc generic không bắt dependency thực.

**Hậu quả**

Host chọn skill nhưng không thể thực hiện.

**Hướng nâng cấp trực tiếp**

Thêm capability probes và contract test trên executor adapter.

## K. Skill run lifecycle, utility feedback và Eval Lab

v0.2 có run record, deterministic eval cases, confidence interval và catalog status update. Nhưng số liệu vẫn chủ yếu do executor/caller khai và chưa có persistent trusted eval pipeline.

### FOS2-148 — Skill completion chấp nhận metrics caller tự khai

- **Mức độ:** `HIGH`
- **Loại:** `TRUST`
- **Vị trí/bề mặt:** ``completeSkillRun()``

**Phân tích**

Caller gửi pass/qualityDelta/tokenDelta và evaluationRunSha256; runtime không bắt buộc tra một EvalRun persisted tương ứng.

**Hậu quả**

Agent có thể tự nâng utility bằng số bịa.

**Hướng nâng cấp trực tiếp**

Chỉ nhận evalRunId; server load signed EvalRun và derive metrics.

### FOS2-149 — Một success ít dữ liệu có thể tăng utility mạnh

- **Mức độ:** `HIGH`
- **Loại:** `UTILITY`
- **Vị trí/bề mặt:** `utility update`

**Phân tích**

Prior mặc định 0.5 và formula có thể lên khoảng 0.85 sau một run tốt/zero delta.

**Hậu quả**

Router overfit một sample, dễ bị gaming/noise.

**Hướng nâng cấp trực tiếp**

Dùng Bayesian posterior, minimum sample, shrinkage và confidence-aware exploration.

### FOS2-150 — Utility không phân đoạn theo context

- **Mức độ:** `MEDIUM`
- **Loại:** `UTILITY`
- **Vị trí/bề mặt:** ``project.skillUtility``

**Phân tích**

Một score chung cho skill trong project, không theo stage/domain/model/provider/tool version/assurance.

**Hậu quả**

Skill tốt ở research có thể được đánh giá giống implementation khác context.

**Hướng nâng cấp trực tiếp**

Utility key gồm skillVersion, context bucket, executor/model/toolchain và decay.

### FOS2-151 — Skill run không có lease/heartbeat/expiry

- **Mức độ:** `MEDIUM`
- **Loại:** `LIFECYCLE`
- **Vị trí/bề mặt:** `skillRuns`

**Phân tích**

Run running có thể tồn tại mãi khi executor chết.

**Hậu quả**

Planner thấy active skill hoặc lock giả, dashboard bị kẹt.

**Hướng nâng cấp trực tiếp**

Lease với owner token, heartbeat, timeout, retry/dead-letter/cancel.

### FOS2-152 — Không có max concurrent/resource lock thực

- **Mức độ:** `MEDIUM`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** `skill start`

**Phân tích**

Conflicts rỗng và không có resource semaphore.

**Hậu quả**

Hai run sửa cùng artifact/slot có thể cạnh tranh.

**Hướng nâng cấp trực tiếp**

Run scheduler dùng locks theo project/artifact slot/tool budget.

### FOS2-153 — `virtualInputs` không chứng minh input đã dùng

- **Mức độ:** `MEDIUM`
- **Loại:** `PROVENANCE`
- **Vị trí/bề mặt:** `skill run`

**Phân tích**

List chỉ là metadata; không có context bundle hash hoặc prompt/input receipt.

**Hậu quả**

Không thể audit model đã thấy version nào.

**Hướng nâng cấp trực tiếp**

Lưu immutable ContextPack với artifact hashes, prompt/template hash và token counts.

### FOS2-154 — Eval update sửa catalog nhưng không sửa contract source

- **Mức độ:** `MEDIUM`
- **Loại:** `CATALOG_DRIFT`
- **Vị trí/bề mặt:** ``applySkillEvaluation()``

**Phân tích**

Status/evaluation có thể khác giữa catalog.json và SKILL contract; regenerate có thể ghi đè.

**Hậu quả**

Nguồn sự thật không rõ.

**Hướng nâng cấp trực tiếp**

Tách authored contract khỏi generated eval registry; catalog build merge deterministic.

### FOS2-155 — Catalog mutation không lock/CAS

- **Mức độ:** `HIGH`
- **Loại:** `CONCURRENCY`
- **Vị trí/bề mặt:** `eval catalog writer`

**Phân tích**

Hai evaluation đồng thời có thể đọc cùng catalog và overwrite update nhau.

**Hậu quả**

Mất quarantine/promotion provenance.

**Hướng nâng cấp trực tiếp**

Đưa eval records vào DB append-only; catalog status là projection.

### FOS2-156 — Eval runner chưa là product surface hoàn chỉnh

- **Mức độ:** `MEDIUM`
- **Loại:** `FEATURE_GAP`
- **Vị trí/bề mặt:** `eval runtime`

**Phân tích**

Có library chạy executor, nhưng không có provider/model adapter built-in, public CLI/MCP workflow và persisted run store đầy đủ.

**Hậu quả**

“Forge Lab runner thật” chỉ đúng ở mức library harness.

**Hướng nâng cấp trực tiếp**

Xây `forge eval run/status/compare/apply` với provider plugins và artifact receipts.

### FOS2-157 — Evaluator tin `quality` và tokenCount do executor trả

- **Mức độ:** `HIGH`
- **Loại:** `TRUST`
- **Vị trí/bề mặt:** `eval runner`

**Phân tích**

Không tự chấm output bằng rubric/tool; executor vừa thi vừa tự cho điểm.

**Hậu quả**

Promotion decision có thể bị thao túng.

**Hướng nâng cấp trực tiếp**

Tách candidate executor khỏi evaluator; metrics kỹ thuật đo server-side, judge độc lập/blind.

### FOS2-158 — Required evidence check chỉ tìm phrase/list

- **Mức độ:** `MEDIUM`
- **Loại:** `HEURISTIC`
- **Vị trí/bề mặt:** `behavioral evaluator`

**Phân tích**

Output có thể nhắc đúng từ khóa mà không có bằng chứng thật.

**Hậu quả**

False pass dễ dàng.

**Hướng nâng cấp trực tiếp**

Đòi typed evidence receipts/IDs valid trong test harness.

### FOS2-159 — Forbidden pattern dùng substring

- **Mức độ:** `MEDIUM`
- **Loại:** `HEURISTIC`
- **Vị trí/bề mặt:** `eval checks`

**Phân tích**

Dễ né bằng paraphrase và dễ false-positive trong ngữ cảnh phủ định/trích dẫn.

**Hậu quả**

Security/quality eval quá nông.

**Hướng nâng cấp trực tiếp**

Dùng AST/structured output validators, policy classifier và adversarial cases.

### FOS2-160 — Confidence interval không điều khiển đầy đủ promotion

- **Mức độ:** `MEDIUM`
- **Loại:** `STATISTICS`
- **Vị trí/bề mặt:** `candidate comparison`

**Phân tích**

Wilson interval có cho pass rate nhưng decision có thể dựa quality delta nhỏ tự khai mà không significance test.

**Hậu quả**

Promotion trên noise.

**Hướng nâng cấp trực tiếp**

Dùng paired tests/bootstrap, minimum effect size và multiple-run variance.

### FOS2-161 — 24 case cho 242 skill quá mỏng

- **Mức độ:** `MEDIUM`
- **Loại:** `COVERAGE`
- **Vị trí/bề mặt:** ``evals/cases``

**Phân tích**

Khoảng hai case/domain không đánh trúng contract riêng từng skill.

**Hậu quả**

Catalog “candidate/stable” không được chứng minh sâu.

**Hướng nâng cấp trực tiếp**

Mỗi skill có contract-derived positive/negative/adversarial cases; shared suites chỉ bổ sung.

### FOS2-162 — Không có sandbox cho executor

- **Mức độ:** `MEDIUM`
- **Loại:** `SECURITY`
- **Vị trí/bề mặt:** `published residual risk`

**Phân tích**

Eval/skill execution có thể chạy code/tool bên ngoài trust boundary.

**Hậu quả**

Connected provider hoặc executor nguy hiểm có thể đọc secret/phá host.

**Hướng nâng cấp trực tiếp**

Worker sandbox, capability-based filesystem/network, seccomp/container và secret broker.

### FOS2-163 — Không có immutable EvalRun store/link bắt buộc

- **Mức độ:** `MEDIUM`
- **Loại:** `AUDIT`
- **Vị trí/bề mặt:** `eval apply path`

**Phân tích**

Chỉ hash string được ghi vào utility/catalog.

**Hậu quả**

Không thể mở lại case outputs, model version, code tree và judge decision.

**Hướng nâng cấp trực tiếp**

Persist EvalRun, CaseRun, Evaluation, Decision với content hashes/signatures.

### FOS2-164 — Seed deterministic chưa đủ phân loại flaky

- **Mức độ:** `LOW`
- **Loại:** `FLAKINESS`
- **Vị trí/bề mặt:** `eval system`

**Phân tích**

Nhiều seed có thể chạy nhưng chưa có policy isolate/retry/quarantine case unstable rõ.

**Hậu quả**

Failure ngẫu nhiên làm utility dao động.

**Hướng nâng cấp trực tiếp**

Theo dõi per-case variance và flaky budget; không promotion khi instability vượt ngưỡng.

### FOS2-165 — Catalog promotion/quarantine thiếu rollback history dễ dùng

- **Mức độ:** `MEDIUM`
- **Loại:** `ROLLBACK`
- **Vị trí/bề mặt:** `catalog update`

**Phân tích**

Không có command xem/khôi phục status theo eval event.

**Hậu quả**

Một eval sai ảnh hưởng routing lâu dài.

**Hướng nâng cấp trực tiếp**

Projection event-sourced và approval cho promotion production.

## L. Idea engine, novelty và scoring

README đã thận trọng hơn và gọi đây là deterministic local guard, nhưng Agent Card/UI vẫn dùng “semantic overlap”. Engine chủ yếu lexical/concept-family heuristic.

### FOS2-166 — “Semantic overlap” mạnh hơn implementation

- **Mức độ:** `MEDIUM`
- **Loại:** `OVERCLAIM`
- **Vị trí/bề mặt:** `Agent Card skill description; scoring engine`

**Phân tích**

Fingerprint dùng normalize, token/concept families và similarity heuristic; không có embedding/semantic model.

**Hậu quả**

Paraphrase sâu có thể lọt, từ giống nhau có thể bị gom sai.

**Hướng nâng cấp trực tiếp**

Dùng thuật ngữ lexical/concept heuristic hoặc bổ sung embedding/judge evidence.

### FOS2-167 — Stopword/stemming/concept dictionary hạn chế ngôn ngữ

- **Mức độ:** `MEDIUM`
- **Loại:** `LANGUAGE`
- **Vị trí/bề mặt:** `scoring`

**Phân tích**

Dự án có nhiều README dịch nhưng novelty logic chủ yếu Anh/Việt và dictionary nhỏ.

**Hậu quả**

Chất lượng khác mạnh theo ngôn ngữ/domain.

**Hướng nâng cấp trực tiếp**

Language detector + tokenizer/embedding multilingual; test corpus từng ngôn ngữ.

### FOS2-168 — Union-find tạo transitive chaining

- **Mức độ:** `MEDIUM`
- **Loại:** `CLUSTERING`
- **Vị trí/bề mặt:** `clusterIdeas()`

**Phân tích**

A gần B, B gần C có thể kéo A và C vào cùng cluster dù trực tiếp không giống.

**Hậu quả**

Số “mechanism-distinct” có thể thấp giả.

**Hướng nâng cấp trực tiếp**

Dùng complete-linkage/representative constraint hoặc hiển thị edge confidence.

### FOS2-169 — Representative/fingerprint cluster phụ thuộc thứ tự input

- **Mức độ:** `LOW`
- **Loại:** `DETERMINISM`
- **Vị trí/bề mặt:** `clustering`

**Phân tích**

Input reorder có thể đổi representative và downstream explanation.

**Hậu quả**

Audit/output không canonical hoàn toàn.

**Hướng nâng cấp trực tiếp**

Sort theo stable ID/hash trước cluster và chọn medoid deterministic.

### FOS2-170 — Concept family generic có thể gom ý tưởng khác nhau

- **Mức độ:** `MEDIUM`
- **Loại:** `FALSE_POSITIVE`
- **Vị trí/bề mặt:** `concept normalization`

**Phân tích**

Từ như automate/platform/AI/marketplace có sức phân biệt thấp.

**Hậu quả**

Giảm diversity giả và loại ý tưởng tốt.

**Hướng nâng cấp trực tiếp**

IDF/domain weighting và mechanism structured fields.

### FOS2-171 — Paraphrase ngoài dictionary vẫn tách cluster

- **Mức độ:** `MEDIUM`
- **Loại:** `FALSE_NEGATIVE`
- **Vị trí/bề mặt:** `fingerprint heuristic`

**Phân tích**

Hai câu cùng cơ chế nhưng từ vựng khác không match.

**Hậu quả**

Gate distinct-mechanisms có thể bị game bằng đổi câu chữ.

**Hướng nâng cấp trực tiếp**

Embedding similarity + adversarial paraphrase tests; reviewer evidence cho threshold boundary.

### FOS2-172 — README nói idea genome có trigger/incentive/ownership/timing nhưng schema không có

- **Mức độ:** `MEDIUM`
- **Loại:** `SCHEMA_DRIFT`
- **Vị trí/bề mặt:** `README vs idea schema`

**Phân tích**

Runtime idea fields tập trung target/problem/mechanism/interface/value/distribution.

**Hậu quả**

Tuyên bố phân tích genome rộng hơn dữ liệu lưu.

**Hướng nâng cấp trực tiếp**

Đồng bộ schema/doc hoặc thêm structured fields/version migration.

### FOS2-173 — Điểm idea vẫn do evaluator tự nhập

- **Mức độ:** `HIGH`
- **Loại:** `TRUST`
- **Vị trí/bề mặt:** `scoreIdeas()`

**Phân tích**

Authenticated principal chỉ xác định ai nhập, không chứng minh novelty/usefulness/feasibility đúng.

**Hậu quả**

Selection có vẻ định lượng nhưng có thể chủ quan/gamed.

**Hướng nâng cấp trực tiếp**

Lưu rationale/evidence per dimension, multi-rater và uncertainty.

### FOS2-174 — Cùng principal có thể tạo và chấm idea

- **Mức độ:** `MEDIUM`
- **Loại:** `SEPARATION`
- **Vị trí/bề mặt:** `idea workflow`

**Phân tích**

Không có independent evaluator policy.

**Hậu quả**

Bias tự chấm không bị chặn.

**Hướng nâng cấp trực tiếp**

A2+ yêu cầu distinct principal/role hoặc human approval với score provenance.

### FOS2-175 — Selection không bắt buộc chọn top score

- **Mức độ:** `MEDIUM`
- **Loại:** `SELECTION`
- **Vị trí/bề mặt:** `select flow`

**Phân tích**

Chỉ cần score current và human approval/rationale; có thể chọn thấp nhất.

**Hậu quả**

Không sai nếu chủ ý, nhưng UI/gate có thể khiến người đọc tưởng score quyết định.

**Hướng nâng cấp trực tiếp**

Ghi override reason và comparison snapshot; không tuyên bố “best” nếu không policy.

## M. JSON Schema, runtime validation và dữ liệu tham chiếu

Runtime validator là cải tiến thật, nhưng chỉ triển khai subset của JSON Schema 2020-12 và nhiều schema aggregate vẫn permissive.

### FOS2-176 — Validator không phải implementation đầy đủ draft 2020-12

- **Mức độ:** `MEDIUM`
- **Loại:** `OVERCLAIM`
- **Vị trí/bề mặt:** ``src/server/schema-validator.mjs``

**Phân tích**

Hỗ trợ nhiều keyword thông dụng nhưng không đầy đủ `$ref`, allOf/not/if-then/dependentRequired/contains và semantics chuẩn khác.

**Hậu quả**

Badge/claim JSON Schema 2020-12 có thể khiến người tích hợp đưa schema không được enforce.

**Hướng nâng cấp trực tiếp**

Adopt Ajv/official-grade validator hoặc công bố “supported subset” rõ.

### FOS2-177 — `date-time` dựa `Date.parse` lỏng

- **Mức độ:** `MEDIUM`
- **Loại:** `FORMAT`
- **Vị trí/bề mặt:** `schema validator`

**Phân tích**

JavaScript chấp nhận một số chuỗi ngoài RFC3339 strict hoặc normalize khác nhau.

**Hậu quả**

Cross-runtime validation không nhất quán.

**Hướng nâng cấp trực tiếp**

Dùng strict RFC3339 parser/test vectors.

### FOS2-178 — URI validation bằng `new URL` không đủ policy

- **Mức độ:** `LOW`
- **Loại:** `URI`
- **Vị trí/bề mặt:** `schema validator/contracts`

**Phân tích**

URI hợp cú pháp chưa chắc được phép/trusted; `file://` được phép ở evidence contract.

**Hậu quả**

SSRF/local file disclosure có thể xuất hiện khi sau này fetch URI.

**Hướng nâng cấp trực tiếp**

Tách syntax validation và scheme/host access policy; fetch qua broker.

### FOS2-179 — Project subrecords còn `additionalProperties:true`

- **Mức độ:** `MEDIUM`
- **Loại:** `PERMISSIVE`
- **Vị trí/bề mặt:** ``PROJECT_SCHEMA``

**Phân tích**

Findings, risks, routes, skillRuns, approvals, decisions và metadata chưa typed sâu.

**Hậu quả**

Drift/tampering trong vùng quan trọng không bị bắt.

**Hướng nâng cấp trực tiếp**

Tạo schema riêng versioned cho từng entity và `$defs`.

### FOS2-180 — Cross-record validation chưa bao phủ mọi reference

- **Mức độ:** `MEDIUM`
- **Loại:** `FOREIGN_KEYS`
- **Vị trí/bề mặt:** `project validator`

**Phân tích**

Một số link như decisions, risks, findings, run outputs, approvals/action target chưa được kiểm hết.

**Hậu quả**

Project có thể schema-valid nhưng lineage đứt.

**Hướng nâng cấp trực tiếp**

Database foreign keys hoặc validator graph toàn aggregate với error path cụ thể.

### FOS2-181 — Public schemas, runtime schemas và tool schemas có thể drift

- **Mức độ:** `HIGH`
- **Loại:** `DUPLICATION`
- **Vị trí/bề mặt:** ``schemas/`, runtime schemas, tool registry`

**Phân tích**

Ba MCP tool hỏng là bằng chứng drift đã xảy ra.

**Hậu quả**

Tăng chi phí bảo trì và phá client.

**Hướng nâng cấp trực tiếp**

Một canonical IDL/schema package sinh validators, docs, tool definitions và types.

### FOS2-182 — Không có compatibility suite với archive lịch sử thật

- **Mức độ:** `HIGH`
- **Loại:** `MIGRATION`
- **Vị trí/bề mặt:** `schema tests`

**Phân tích**

Migration regression lọt dù schema tests xanh.

**Hậu quả**

Backward compatibility không được chứng minh.

**Hướng nâng cấp trực tiếp**

Fixture archive mọi release; CI migrate và compare invariant/golden report.

### FOS2-183 — Project output tool schema cho revision minimum 0

- **Mức độ:** `LOW`
- **Loại:** `SCHEMA_DRIFT`
- **Vị trí/bề mặt:** ``tool-registry.mjs` vs project schema minimum 1`

**Phân tích**

Public contract cho phép trạng thái runtime không bao giờ hợp lệ.

**Hậu quả**

Client generated types/tests yếu đi.

**Hướng nâng cấp trực tiếp**

Reuse exact project summary schema.

### FOS2-184 — A2A task record không dùng runtime schema

- **Mức độ:** `MEDIUM`
- **Loại:** `A2A_SCHEMA`
- **Vị trí/bề mặt:** `A2A store`

**Phân tích**

Agent Card được validate nhưng task persisted không.

**Hậu quả**

Protocol surface có vùng dữ liệu không được bảo vệ tương xứng.

**Hướng nâng cấp trực tiếp**

Generate/adopt official A2A schemas và validate request/result/storage.

### FOS2-185 — Artifact content registry không đủ sâu để interoperability

- **Mức độ:** `MEDIUM`
- **Loại:** `ARTIFACT_SCHEMA`
- **Vị trí/bề mặt:** `artifact registry`

**Phân tích**

Top-level required key không định nghĩa nested semantics.

**Hậu quả**

Hai skill có thể cùng nói `architecture-decision` nhưng output không tương thích.

**Hướng nâng cấp trực tiếp**

Per-type versioned schema + compatibility/migration adapters.

## N. Forge Studio, adapter/TCK và điểm mù kiểm thử

Studio đẹp hơn và hiển thị nhiều truth hơn, nhưng standalone interaction/rerender còn giả một phần; TCK chỉ chứng minh local MCP lifecycle, không phải host integration.

### FOS2-186 — Standalone dashboard không có MCP Apps bridge

- **Mức độ:** `HIGH`
- **Loại:** `FEATURE_GAP`
- **Vị trí/bề mặt:** ``src/ui/forge-studio.mjs`; `/dashboard``

**Phân tích**

Buttons gọi `window.openai.callTool`; browser thông thường không có object này và báo host không expose bridge.

**Hậu quả**

URL dashboard được README hướng dẫn mở nhưng action không dùng được.

**Hướng nâng cấp trực tiếp**

Cho standalone HTTP client mode có auth/session, hoặc ghi rõ read-only và ẩn buttons.

### FOS2-187 — `applyProject` chỉ cập nhật header cơ bản

- **Mức độ:** `MEDIUM`
- **Loại:** `UI_STATE`
- **Vị trí/bề mặt:** `Studio script`

**Phân tích**

Project switch/update không dựng lại đầy đủ artifact/gate/route/idea/risk panels.

**Hậu quả**

UI hiển thị dữ liệu project cũ dưới tên project mới.

**Hướng nâng cấp trực tiếp**

Dùng state store + component render keyed project/revision.

### FOS2-188 — Refresh yêu cầu reload để redraw

- **Mức độ:** `MEDIUM`
- **Loại:** `UI_STATE`
- **Vị trí/bề mặt:** `Studio`

**Phân tích**

Thông báo nội bộ nói reload view; response tool không được map vào toàn DOM.

**Hậu quả**

Tương tác tạo cảm giác nửa hoạt động.

**Hướng nâng cấp trực tiếp**

Implement normalized client model và rerender all sections sau tool result.

### FOS2-189 — Primary next-action button gọi tool đang hỏng schema

- **Mức độ:** `HIGH`
- **Loại:** `DEPENDENCY`
- **Vị trí/bề mặt:** `Studio + MCP `forge_next_action``

**Phân tích**

Trong MCP host đúng, tool vẫn trả invalid_tool_output.

**Hậu quả**

Luồng chính UI fail.

**Hướng nâng cấp trực tiếp**

Sửa contract và thêm browser/MCP integration test.

### FOS2-190 — Start skill gửi `tools: []`/target rỗng

- **Mức độ:** `HIGH`
- **Loại:** `EXECUTION`
- **Vị trí/bề mặt:** `Studio run controls`

**Phân tích**

Skill cần filesystem/shell/test-runner/web-search không thể start hợp lệ hoặc plan không feasible.

**Hậu quả**

Run controls chủ yếu demo, chưa điều phối thật.

**Hướng nâng cấp trực tiếp**

UI hiển thị required tools, capability discovery và target outputs trước start.

### FOS2-191 — Không có UI lifecycle artifact/evidence/finding đầy đủ

- **Mức độ:** `MEDIUM`
- **Loại:** `FEATURE_GAP`
- **Vị trí/bề mặt:** `Studio panels`

**Phân tích**

Có inspect/list nhưng ít control create-review-verify-close/accept với policy context.

**Hậu quả**

“Control plane” chưa đủ vận hành end-to-end không dùng raw tools.

**Hướng nâng cấp trực tiếp**

Workflow forms theo state/policy với approval prompts và evidence viewer.

### FOS2-192 — `/dashboard` load/embed tất cả projects

- **Mức độ:** `MEDIUM`
- **Loại:** `SCALABILITY`
- **Vị trí/bề mặt:** `HTTP dashboard route`

**Phân tích**

List project aggregate có thể lớn và chứa dữ liệu nhạy cảm; server embed vào HTML.

**Hậu quả**

Latency/memory/data exposure tăng theo số project.

**Hướng nâng cấp trực tiếp**

Chỉ embed summaries; fetch project detail theo quyền và pagination.

### FOS2-193 — Dashboard không có project-level ACL

- **Mức độ:** `HIGH`
- **Loại:** `AUTHORIZATION`
- **Vị trí/bề mặt:** `HTTP auth model`

**Phân tích**

Mọi authenticated key có thể list và xem mọi project.

**Hậu quả**

Không phù hợp multi-user/tenant.

**Hướng nâng cấp trực tiếp**

ACL/RBAC project scope và filtered queries.

### FOS2-194 — 9 executable adapter config chạy cùng local stdio behavior

- **Mức độ:** `MEDIUM`
- **Loại:** `TCK`
- **Vị trí/bề mặt:** `adapter TCK`

**Phân tích**

TCK chứng minh config spawn MCP server và lifecycle, không chạy host vendor thật.

**Hậu quả**

“Adapter verified” dễ bị hiểu rộng nếu không đọc evidence level.

**Hướng nâng cấp trực tiếp**

Giữ wording protocol-tested; thêm host-specific integration suite nơi API/license cho phép.

### FOS2-195 — 6 documentation-only không có machine execution

- **Mức độ:** `MEDIUM`
- **Loại:** `TCK`
- **Vị trí/bề mặt:** `adapter packs`

**Phân tích**

Điều này được công bố trung thực, nhưng số tổng 15 vẫn dễ gây ấn tượng 15 integration chạy.

**Hậu quả**

Người dùng có thể kỳ vọng plug-and-play.

**Hướng nâng cấp trực tiếp**

UI/docs hiển thị badge rõ “protocol-tested” vs “guide only”.

### FOS2-196 — Manifest không được ký/ràng buộc archive

- **Mức độ:** `MEDIUM`
- **Loại:** `RELEASE`
- **Vị trí/bề mặt:** ``project-manifest.json``

**Phân tích**

Manifest tốt hơn v0.1 về status per file, nhưng cùng archive và không có external signature.

**Hậu quả**

Có thể bị sửa đồng thời với files.

**Hướng nâng cấp trực tiếp**

Signed manifest + archive digest + provenance.

### FOS2-197 — Coverage cao vẫn bỏ lọt public-tool/migration/release bugs

- **Mức độ:** `MEDIUM`
- **Loại:** `TEST_GAP`
- **Vị trí/bề mặt:** `132 tests, 95.09% line, 74.63% branch`

**Phân tích**

Line coverage đo execution, không đo contract matrix, historical fixtures hay packaging.

**Hậu quả**

Con số coverage có thể tạo tự tin sai.

**Hướng nâng cấp trực tiếp**

Đặt release gates theo invariant/conformance/scenario, không chỉ percentage.

## 7. Kiến trúc nâng cấp mạnh: ForgeOS Trust Kernel

Mục tiêu không phải thêm nhiều skill hay nhiều badge hơn, mà biến các invariant tin cậy thành thuộc tính hệ thống không thể bị caller “tự khai”. Kiến trúc dưới đây là thiết kế đích, không phải lịch thời gian.

### 7.1. Storage: event store + transactional projections

Thay một file JSON/project bằng:

```text
Command → Policy check → Transaction
        ├─ append domain events
        ├─ update aggregate projection
        ├─ insert outbox jobs
        └─ commit expected_revision atomically
```

Các bảng/collection chính:

- `projects(id, tenant_id, revision, semantic_revision, stage, sealed_at, ...)`
- `project_events(project_id, sequence, event_type, payload, prev_hash, event_hash, signer, created_at)`
- `artifacts(id, project_id, type, slot, version, content_hash, envelope_hash, state, ...)`
- `artifact_dependencies(artifact_id, dependency_id, dependency_hash, role)`
- `evidence_receipts(id, subject_type, subject_id, subject_hash, provider, result, payload_hash, ...)`
- `gate_evaluations(id, project_id, snapshot_hash, policy_version, status, ...)`
- `tasks`, `task_events`, `skill_runs`, `eval_runs`, `approvals`, `outbox`

Mọi command phải có `expectedRevision`; không có update “blind”. SQLite WAL đủ cho local single-node; PostgreSQL phù hợp multi-user/multi-worker.

### 7.2. Evidence: từ self-attestation thành trusted receipt

Caller không được gửi `status: pass`. Caller chỉ gửi yêu cầu:

```json
{
  "provider": "node-test",
  "subject": {"artifactId": "...", "artifactHash": "..."},
  "spec": {"command": ["npm", "test"]}
}
```

Evidence provider tin cậy chạy công việc và server tự tạo receipt:

```json
{
  "providerId": "executor:test-runner@2.1.0",
  "subjectHash": "...",
  "sourceTreeHash": "...",
  "startedAt": "...",
  "finishedAt": "...",
  "exitCode": 0,
  "stdoutBlobHash": "...",
  "stderrBlobHash": "...",
  "environmentHash": "...",
  "result": "PASS",
  "receiptHash": "...",
  "signature": "..."
}
```

Provider interface nên có command-test, scanner, human review, external attestation và formal tool; mỗi loại có schema/policy riêng. Evidence pass chỉ hợp lệ khi receipt signature/issuer/method/subject/freshness đáp ứng assurance policy.

### 7.3. Artifact identity và lifecycle đúng

Không dùng “một active artifact theo type”. Dùng:

```text
ArtifactKey = (projectId, type, slot, version)
Ví dụ:
  domain-blueprint / billing / v3
  domain-blueprint / analytics / v2
  architecture-decision / auth-boundary / v4
```

- `contentHash`: chỉ payload semantic canonical.
- `envelopeHash`: type/slot/version/contentHash/dependencies/provenance/policy identity.
- Review/verify/supersede/invalidate là append-only events, không sửa trực tiếp lịch sử.
- A1+ bắt buộc draft→review→verified theo policy.
- Replacement ghi quan hệ hai chiều và exact dependency hash.

### 7.4. Gate policy-as-code

Thay string label bằng policy có cấu trúc:

```yaml
rule: architecture-approved
requires:
  artifact:
    type: architecture-decision
    slot: system
    state: verified
  evidence:
    type: architecture-review
    allowedProviders: [human-review, architecture-linter]
    maxAge: P30D
  separation:
    verifierDifferentFromProducer: true
    independentTrustDomains: 2
```

Gate evaluation tham chiếu exact event sequence/snapshot hash và luôn append-only. Không thay thế kết quả cũ. Policy engine có thể là module tự viết typed, Cedar/OPA/Rego tùy deployment.

### 7.5. Skill contract executable

Mỗi skill cần authored contract riêng, không suy I/O từ tên:

```yaml
id: designing-api-contracts
version: 2.0.0
inputs:
  - {type: domain-model, slot: primary, state: verified}
  - {type: user-workflows, cardinality: many}
outputs:
  - {type: api-contract, slotFrom: capabilityId, cardinality: many}
locks: [artifact-slot:api-contract/*]
requiredCapabilities:
  - filesystem.write
  - test.contract.run
preconditions: executable predicates
postconditions: schema + evidence policy
```

Planner là constraint solver: hard constraints trước, ranking sau. Nó phải chứng minh mỗi step có inputs, tools, permissions, slots, assurance, no conflicts và executor availability. Route stale không được commit nếu snapshot revision đã đổi.

### 7.6. Skill run scheduler

- Durable lease + owner token + heartbeat.
- `expectedRunRevision` cho mọi transition.
- Cancel token/fencing để action cũ không overwrite canceled state.
- Retry policy, dead-letter, timeout và max concurrency.
- ContextPack immutable chứa artifact hashes, prompt/template hash, model/tool versions và token count thật.
- Completion chỉ xảy ra khi output schema, evidence obligation và postcondition đều pass.

### 7.7. Eval platform đáng tin

Tách ba vai trò: candidate executor, metric collector và judge. Persist:

- `EvalRun`: source tree, skill version, model/provider, environment, seeds.
- `CaseRun`: exact input/context/output/blob hashes, latency, tokens đo server-side.
- `Evaluation`: rubric result, judge identity, calibration version, confidence.
- `PromotionDecision`: paired statistics, thresholds, approver, signature.

Utility dùng posterior có prior/min samples/decay và context buckets. `completeSkillRun` không nhận quality score tùy ý; nó chỉ tham chiếu EvalRun/production outcome đã được hệ thống xác minh.

### 7.8. MCP nâng cấp

- Một schema/IDL làm nguồn sự thật sinh tool schemas, serializers, docs và tests.
- Contract test toàn bộ tool qua initialize→ready→call, không gọi internal shortcut.
- Output invalid phải được phát hiện trước commit hoặc transaction rollback.
- Session store có TTL sweep, ownership cho POST/DELETE, capacity và metrics.
- OAuth/scoped authorization cho remote; project ACL bắt buộc.
- Version negotiation theo đặc tả; cursor keyset + snapshot/MAC.
- Có thể dùng official SDK để giảm drift transport/lifecycle.

### 7.9. A2A nâng cấp

A2A task phải dùng cùng DB/event/outbox:

```text
SendMessage
  → create Task + TaskSubmitted event + OutboxJob (one transaction)
Worker claims job with lease/fencing token
  → TaskWorking
  → execute with AbortSignal
  → TaskCompleted/Failed only if lease and revision still valid
CancelTask
  → TaskCanceled + revoke lease; worker commit becomes conflict
```

List dùng keyset cursor; task schema validate khi read/write; deferred action chỉ được quảng bá khi có worker thật. Agent Card documentation URL phải được health-checked.

### 7.10. Studio thật sự tương tác

- Standalone mode dùng HTTP/MCP client thật hoặc được đánh dấu read-only.
- State store normalized theo projectId/revision; mọi tool result cập nhật toàn panel.
- Project summaries tách detail, pagination/search cho artifacts/evidence/tasks.
- Capability discovery hiển thị tool còn thiếu trước start skill.
- Run monitor theo event stream/polling; cancel/retry/inspect evidence receipt.
- Project ACL filter ở server, không chỉ UI.

### 7.11. Release và supply-chain

- Verifier chạy được từ archive không Git.
- Build source bundle immutable; output evidence ngoài source tree.
- Manifest toàn file + archive digest; SBOM.
- Reproducible environment/container và exact toolchain digest.
- Signed provenance (SLSA-style), cosign/Sigstore hoặc organizational PKI.
- CI test chính file archive cuối cùng, không chỉ repository checkout.

### 7.12. Migration an toàn

- Fixture từ từng release thật.
- Chuỗi migration từng version, deterministic/idempotent.
- Dry-run report với field additions/losses/hash changes.
- Backup immutable và rollback command.
- Legacy evidence luôn `unverified`, không tự mở gate.
- Lưu old/new hash và migration transformer identity.

## 8. Bộ invariant bắt buộc cho phiên bản mạnh

1. Không command nào mutate aggregate nếu thiếu expected revision.
2. Không writer nào commit nếu fencing token/lease đã mất.
3. Một event sequence chỉ được append một lần; hash chain không đứt.
4. Mọi evidence PASS phải do provider tin cậy phát hành, không do caller tự khai.
5. Digest evidence phải được server tính từ payload/blob thực.
6. Critical finding không thể được cùng trust domain mở, resolve và close.
7. Artifact producer không thể là verifier; assurance cao yêu cầu independent trust domain.
8. Artifact identity là type+slot+version; nhiều slot cùng type được hỗ trợ.
9. ContentHash và envelope/provenance integrity được phân biệt rõ.
10. Mọi dependency tham chiếu exact artifact hash/version và tồn tại.
11. Mọi lifecycle transition đi qua reducer/policy duy nhất.
12. Gate evaluation bind exact snapshot/event sequence và policy version.
13. Gate history append-only; rerun không xóa evaluation cũ.
14. Approval bind principal, exact args hash, snapshot hash, expiry và one-time nonce.
15. Mọi MCP tool vượt round-trip input/output schema qua transport thật.
16. Tool output invalid không được để lại side effect đã commit.
17. MCP session chỉ owner mới dùng/xóa; session/bucket có bounded retention.
18. A2A task terminal không thể quay lại nonterminal.
19. Cancel làm worker cũ không thể commit completed.
20. Deferred task chỉ được chấp nhận khi durable worker/queue khả dụng.
21. Mọi A2A task read/write được schema validate và revision-CAS.
22. Planner chỉ trả step executable theo tools, permissions, stage, slots và conflicts.
23. Skill contract metadata được enforce hoặc không được quảng bá như invariant.
24. Utility update chỉ từ persisted verified EvalRun/production outcome.
25. Promotion cần đủ sample/confidence và có rollback event.
26. Archive phát hành tự verify được không cần `.git`.
27. Report release bind SHA-256 archive cuối và source bundle digest.
28. Migration trên fixture release lịch sử phải thành công và giữ semantic data.
29. Legacy evidence không bao giờ tự trở thành pass.
30. Project ACL/tenant được enforce trong query, command, dashboard, MCP và A2A.

## 9. Các test phải tồn tại để ngăn tái phát

- Multi-process/process-kill/fault-injection store tests với barrier deterministic.
- Real v0.1 archive migration golden tests có artifact/evidence/findings.
- Evidence adversarial tests: fake hash, same producer/reviewer, forged source commit, wrong issuer.
- Full 25-tool MCP conformance matrix và side-effect rollback tests.
- MCP session cross-principal POST/DELETE, TTL sweep và capacity tests.
- A2A file/memory/database adapter contract suite; cancel-vs-complete race.
- Planner scenario matrix theo domain/assurance/tools/conflict/slot cardinality.
- Per-skill generated schema tests + curated behavioral/adversarial evals.
- Browser test Studio ở MCP host mock và standalone mode.
- Build final ZIP/TGZ, extract sạch, run install/smoke/release verify và compare manifest.
- Property tests cho project/artifact/task state machines và event hash chain.

## 10. Ưu tiên theo dependency kỹ thuật, không theo thời gian

Đây không phải lịch trình. Thứ tự dưới đây chỉ thể hiện cái nào là nền móng cho cái nào:

1. **Trust kernel:** transactional storage, event/CAS/fencing và project ACL.
2. **Trusted evidence receipts + separation-of-duty policy.**
3. **Artifact slot/envelope integrity + gate policy-as-code.**
4. **Generated schemas và sửa toàn bộ MCP/A2A contract drift.**
5. **Durable scheduler cho skill/A2A, cancellation và outbox.**
6. **Executable skill contracts/planner constraints.**
7. **Persisted eval platform và confidence-aware utility.**
8. **Studio client thật, archive-first release và signed provenance.**

Nếu đảo thứ tự—ví dụ thêm hàng trăm skill/UI trước trust kernel—dự án sẽ tăng bề mặt nhưng không tăng độ tin cậy.

## 11. Phán quyết cuối

ForgeOS v0.2.0 **không phải bản làm lại giả**: nhiều lỗi v0.1 đã được sửa bằng code thật. Nhưng nó vẫn là một prototype control-plane có lớp assurance mô phỏng tốt hơn là một hệ thống trust production. Điểm yếu cốt lõi là hệ thống biết một record “nói rằng đã pass”, chứ chưa tự chứng minh sự kiện tạo ra record đó thật sự xảy ra trong một execution boundary đáng tin.

Nâng cấp mạnh nhất không phải tăng số skill, model hay adapter. Đó là chuyển từ:

```text
caller-provided state + metadata checks
```

sang:

```text
transactional events + trusted executors + signed receipts + policy-enforced separation of duty
```

Khi bốn nền tảng này có thật, gate, assurance, skill utility, release dossier và Agent interoperability mới trở thành thuộc tính đáng tin thay vì chỉ là cấu trúc dữ liệu đẹp.

## 12. Nguồn đặc tả dùng để đối chiếu

- Model Context Protocol specification, lifecycle và Streamable HTTP, bản mục tiêu 2025-11-25.
- A2A Protocol v1.0 specification và migration notes.
- JSON Schema Draft 2020-12 được dự án khai báo; báo cáo phân biệt rõ implementation subset với full compliance.

## 13. Phụ lục — kết quả tái hiện rút gọn

### Release verify từ archive

```text
./scripts/capture-dashboard.sh: Permission denied
sau chmod: git diff --check → exit 129 (không có .git)
```

### MCP session ownership

```json
{
  "initializeByAlice": 200,
  "deleteByBob": 204,
  "alicePingAfterDelete": 400
}
```

### Docker default

```text
ForgeOS refuses non-loopback binding without authentication
Dockerfile mặc định HOST=0.0.0.0 và không đặt authentication
```

### Public MCP output drift

```text
forge_project_export → invalid_tool_output
forge_skills_route   → invalid_tool_output
forge_next_action    → invalid_tool_output
```

### Migration

```text
v0.1 artifact/evidence → thiếu version/title/principal fields; revision 0 không hợp schema v3
```

### Evidence trust

```text
agent tạo critical finding → tự tạo PASS evidence với digest hình thức → tự close finding thành công
```

---

**Giới hạn của báo cáo:** kiểm toán tĩnh và dynamic local không chứng minh không còn lỗi. Nó chứng minh các lỗi/giới hạn được nêu bằng source path, invariant analysis và các ca tái hiện đã thực hiện; deployment, provider và host vendor bên ngoài chưa được chứng nhận.
