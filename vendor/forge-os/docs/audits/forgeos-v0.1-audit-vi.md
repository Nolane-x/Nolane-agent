# BÁO CÁO KIỂM TOÁN LỖI TOÀN DIỆN — FORGEOS v0.1.0

> **Loại tài liệu:** Báo cáo lỗi, khoảng trống triển khai, rủi ro kiến trúc và tính năng được mô tả mạnh hơn thực tế  
> **Đối tượng kiểm tra:** `forge-os-v0.1.0(1).zip`  
> **Ngày kiểm tra:** 24-07-2026 (Asia/Bangkok)  
> **Phạm vi:** Mã nguồn runtime, project store, gate/evidence, artifact graph, idea engine, skill catalog/router, MCP, A2A, HTTP server, bảo mật, eval, schema, UI, adapter, TCK, CI và release evidence  
> **Lưu ý:** Tài liệu này **không phải lộ trình theo ngày/tuần/tháng**. Nội dung tập trung vào lỗi, nguyên nhân gốc, điều kiện kích hoạt, hậu quả, bằng chứng và hành vi đúng đáng lẽ hệ thống phải bảo đảm.

---

## 1. Kết luận kiểm toán

ForgeOS v0.1.0 là một prototype có cấu trúc mã tương đối tốt, tài liệu phong phú và nhiều ý tưởng kiến trúc đúng hướng. Dự án chạy được, smoke test chạy được và toàn bộ test hiện có đều vượt qua. Tuy nhiên, những bất biến quan trọng nhất của một “operating system for AI agents” — tính nhất quán trạng thái, freshness của gate, tính xác thực evidence, tính khả dụng của artifact lifecycle, kết nối thật của skill graph, tuân thủ giao thức và ranh giới phê duyệt con người — **chưa được runtime bảo đảm đầy đủ**.

Kết quả chạy kiểm thử chính thức:

```text
60 tests
60 passed
0 failed
Line coverage:     98.06%
Branch coverage:   72.94%
Function coverage: 90.00%
Smoke test:        passed
```

Kết quả trên **không chứng minh hệ thống an toàn hoặc đúng về mặt ngữ nghĩa**. Nhiều lỗi Critical/High dưới đây đã được tái hiện độc lập trong khi 60/60 test vẫn xanh. Đây là một ví dụ điển hình của “high line coverage, low invariant coverage”: mã đã được chạy qua, nhưng các thuộc tính quan trọng chưa được kiểm chứng.

### Phán quyết tổng thể

| Nhóm | Nhận định |
|---|---|
| Chạy được ở mức prototype | Có |
| Có cấu trúc module rõ | Có |
| Có đủ primitive để tiếp tục phát triển | Có |
| Bảo toàn dữ liệu khi có cập nhật đồng thời | Không |
| Gate phản ánh chắc chắn trạng thái hiện tại | Không |
| Evidence chứng minh công việc đã thực sự được thực hiện | Không |
| Public API có thể hoàn thành lifecycle tới release | Không |
| 242 skill tạo thành graph có thể đi từ intent tới release | Không |
| Router thực sự risk-aware và artifact-gap-aware | Không đầy đủ |
| MCP 2025-11-25 compliant | Không |
| A2A 1.0 compliant | Không |
| Human approval có xác thực | Không |
| Assurance A0–A4 có tác động runtime thật | Không |
| Eval Lab tự chạy và quản lý quarantine | Không |
| Production-ready | Chưa |

---

## 2. Cách phân loại phát hiện

### 2.1. Mức độ nghiêm trọng

- **Critical:** Có thể làm mất dữ liệu, vượt gate, phát hành trạng thái không hợp lệ, phá ranh giới tin cậy hoặc khiến tuyên bố cốt lõi của hệ thống sai.
- **High:** Làm sai luồng quan trọng, khiến protocol không tương thích, khiến tính năng chính không hoạt động hoặc tạo rủi ro bảo mật đáng kể.
- **Medium:** Làm giảm độ tin cậy, khả năng mở rộng, tính quan sát, khả năng bảo trì hoặc gây lỗi trong trường hợp biên.
- **Low:** Thiếu hoàn thiện, mô tả chưa chính xác, UX kém, hoặc hardening chưa đủ nhưng chưa trực tiếp phá invariant cốt lõi.

### 2.2. Loại bằng chứng

- **REPRODUCED:** Đã chạy ca tái hiện và quan sát kết quả sai.
- **STATIC-CONFIRMED:** Có thể kết luận trực tiếp từ luồng mã nguồn.
- **ARCHITECTURAL-GAP:** Primitive có thể tồn tại nhưng không được nối vào luồng runtime/public API.
- **OVERCLAIM:** Tài liệu hoặc metadata mô tả mạnh hơn hành vi thực tế.
- **HARDENING:** Chưa chắc tạo lỗi ngay trong prototype, nhưng là rủi ro thực tế khi triển khai.

---

# PHẦN A — PROJECT STORE, TRANSACTION VÀ TÍNH TOÀN VẸN TRẠNG THÁI

## FOS-001 — Race condition làm mất update trong cùng một process

- **Mức độ:** Critical
- **Trạng thái:** REPRODUCED
- **Vị trí:** `src/core/project-store.mjs`, hàm `update()`, khoảng dòng 67–84

### Mô tả

ProjectStore cố gắng serialize các update theo `projectId` bằng một `Map` chứa Promise. Tuy nhiên, `finally` của update đang chạy luôn gọi:

```js
release();
this.#locks.delete(id);
```

Lệnh `delete(id)` không kiểm tra entry hiện tại trong map còn thuộc update đó hay đã được thay bằng “đuôi khóa” của update kế tiếp.

### Chuỗi lỗi

Giả sử có ba update A, B và C:

1. A lấy khóa đầu tiên.
2. B đến khi A chưa xong, đặt một Promise tail mới vào `#locks` và chờ A.
3. A hoàn thành, gọi `this.#locks.delete(id)`.
4. Entry đại diện cho B đang chờ/đang chuẩn bị chạy bị xóa khỏi map.
5. C đến, thấy map không có khóa và chạy song song với B.
6. B và C có thể cùng đọc cùng một snapshot.
7. Update ghi sau đè update ghi trước.

### Bằng chứng tái hiện

Ba mutation A/B/C được điều khiển thứ tự bằng Promise. Kết quả history cuối cùng:

```text
['project-created', 'A', 'B']
```

Sự kiện C bị mất hoàn toàn mặc dù lời gọi update C đã hoàn thành.

### Hậu quả

Có thể mất không báo lỗi:

- Artifact vừa tạo.
- Evidence vừa ghi.
- Finding hoặc resolution.
- Gate result.
- Route history.
- Human decision.
- Selected idea.
- Bất kỳ mutation nào trên project.

Đây là lỗi “silent data loss”: caller có thể nhận Promise resolved nhưng dữ liệu không còn trong trạng thái cuối.

### Vì sao test không bắt được

Test hiện không tạo ít nhất ba update chồng nhau có kiểm soát. Các test concurrent đơn giản với hai update có thể vẫn vô tình qua vì entry chưa bị xóa ở đúng thời điểm gây lỗi.

### Hành vi đúng cần bảo đảm

- Không update nào đã trả thành công được phép biến mất.
- Khóa chỉ được xóa nếu entry hiện tại trong map đúng là tail do update đó tạo.
- Tốt hơn nữa, persistence phải có `revision` và compare-and-swap để phát hiện write conflict thay vì chỉ dựa vào mutex trong bộ nhớ.

---

## FOS-002 — Khóa chỉ có hiệu lực trong một instance Node.js

- **Mức độ:** Critical khi scale nhiều process; High ở prototype
- **Trạng thái:** STATIC-CONFIRMED
- **Vị trí:** `src/core/project-store.mjs`, field `#locks`

`#locks` là state trong RAM của một object. Hai server process, hai worker thread có store riêng, hai container dùng chung volume, hoặc một CLI và một server cùng mở data directory sẽ không nhìn thấy khóa của nhau. Cả hai có thể cùng đọc một file JSON và ghi đè lẫn nhau.

Atomic rename chỉ giúp file không bị ghi nửa chừng; nó **không tạo transaction giữa nhiều writer** và không ngăn lost update.

---

## FOS-003 — Không có revision, ETag hoặc compare-and-swap

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Project không có trường `revision`. Update không ghi “tôi đang sửa revision 41”; vì vậy store không thể biết snapshot vừa đọc đã lỗi thời trước lúc ghi. Điều này làm mất khả năng:

- Phát hiện write conflict.
- Gắn gate vào đúng phiên bản project.
- Gắn evidence vào đúng artifact version.
- Thực hiện optimistic concurrency.
- Phân biệt dữ liệu mới và stale data.
- Xây audit log chính xác theo version.

`updatedAt` không thay thế được revision: timestamp có thể trùng, có độ phân giải hạn chế và không tham gia điều kiện ghi.

---

## FOS-004 — `read()` tin tưởng tuyệt đối nội dung file

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED
- **Vị trí:** `src/core/project-store.mjs:65`

```js
async read(id) {
  return JSON.parse(await readFile(this.#file(id), 'utf8'));
}
```

Khi đọc, hệ thống không:

- Validate project schema.
- Kiểm tra `id` trong file khớp tên file.
- Kiểm tra `stage` hợp lệ.
- Kiểm tra assurance/domain hợp lệ.
- Kiểm tra duplicate ID.
- Kiểm tra artifact hash.
- Kiểm tra graph cycle.
- Kiểm tra secret đã bị chèn trực tiếp.
- Kiểm tra schema version có được hỗ trợ.

Một file bị sửa thủ công, lỗi disk, tool ngoài ghi sai hoặc attacker có quyền filesystem có thể tạo trạng thái bất kỳ. Runtime sau đó tiếp tục xử lý như project hợp lệ.

---

## FOS-005 — `update()` không validate trạng thái project sau mutation

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Điều kiện duy nhất đáng kể sau updater là:

```js
if (!next || typeof next !== 'object' || next.id !== id) ...
```

Không có aggregate validator. Một updater nội bộ có thể trả:

- `stage: 'released'` dù chưa có gate.
- `artifacts: 'not-an-array'`.
- Domain không hợp lệ.
- Duplicate IDs.
- Hash giả.
- Artifact cycle.
- Gate tham chiếu evidence không tồn tại.

`assertSafeValue()` và `assertNoSecrets()` trong `#atomicWrite()` chỉ bảo vệ kiểu dữ liệu nguy hiểm/secret, không bảo vệ semantics.

---

## FOS-006 — Một file project hỏng làm hỏng toàn bộ `list()`

- **Mức độ:** High
- **Trạng thái:** REPRODUCED
- **Vị trí:** `src/core/project-store.mjs:87–91`

`list()` dùng `Promise.all()` và `JSON.parse()` trực tiếp cho mọi file. Chỉ một file malformed khiến toàn bộ lời gọi reject. Dashboard/project listing vì thế có thể sập dù tất cả project còn lại hoàn toàn hợp lệ.

### Bằng chứng

Thêm một file `forge_corrupt.json` chứa JSON không hợp lệ làm `store.list()` ném lỗi parse thay vì trả các project lành mạnh và cảnh báo project lỗi.

### Hành vi đúng

Project lỗi cần được cô lập, quarantine hoặc trả trong danh sách diagnostics; không nên làm mất khả năng truy cập toàn bộ workspace.

---

## FOS-007 — Không có migration cho `schemaVersion`

- **Mức độ:** High về khả năng nâng cấp
- **Trạng thái:** ARCHITECTURAL-GAP

Project được tạo với `schemaVersion: 2`, nhưng không có:

- Registry migration.
- `migrate(v1 -> v2)`.
- Reject version tương lai.
- Backup trước migration.
- Test migration.

Khi schema thay đổi, runtime có thể đọc dữ liệu cũ và giả định field mới đã tồn tại, gây lỗi ngầm hoặc corruption.

---

## FOS-008 — Atomic rename chưa bảo đảm durability sau mất điện

- **Mức độ:** Medium/High tùy môi trường
- **Trạng thái:** HARDENING

Cơ chế temp file + rename tốt hơn ghi trực tiếp, nhưng chưa có:

- `fsync()` temp file trước rename.
- `fsync()` directory sau rename.
- Recovery/cleanup temp files.
- Journal.
- Checksum xác minh file hoàn chỉnh.

Trên một số filesystem, mất điện đúng thời điểm có thể làm mất update gần nhất hoặc để metadata chưa được flush.

---

## FOS-009 — Không có backup, snapshot, rollback hoặc corruption recovery

- **Mức độ:** High khi chứa dữ liệu thật
- **Trạng thái:** ARCHITECTURAL-GAP

Mỗi update ghi đè file state hiện tại. History nằm cùng file và cũng có thể bị mất/corrupt cùng lúc. Không có bản trước đó để phục hồi khi:

- Updater có bug.
- File bị sửa sai.
- Một update logic xóa mảng.
- Disk corruption.
- Operator thao tác nhầm.

---

## FOS-010 — Toàn bộ project bị đọc/clone/stringify/ghi lại cho mỗi mutation

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Chi phí mỗi mutation tăng tuyến tính theo kích thước toàn project. Các mảng `history`, `routes`, `artifacts`, `evidence`, `findings`, `gates` đều tăng không giới hạn. Khi project lớn:

- Latency tăng.
- Memory spike do parse + structuredClone + stringify.
- Write amplification.
- Cửa sổ race lớn hơn.
- Khả năng event loop bị chặn bởi JSON stringify tăng.

---

## FOS-011 — `routes` và `history` tăng vô hạn

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Mỗi lần hỏi route, kể cả cùng trạng thái, hệ thống append cả route snapshot và history event. Không có deduplication, retention, compaction hoặc pagination. Một agent polling `next_action` có thể làm project file phình rất nhanh mà không tạo giá trị mới.

---

## FOS-012 — Export trả đường dẫn filesystem cục bộ thay vì artifact tải được

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED
- **Vị trí:** `ProjectStore.exportBundle()`

`exportBundle()` copy file và trả `destination` là đường dẫn trên server. Với client từ xa:

- Đường dẫn đó không truy cập được.
- Có thể lộ cấu trúc filesystem.
- Không có download endpoint, content disposition, checksum hoặc lifecycle cleanup.
- Tên “bundle” gây hiểu lầm vì thực tế chỉ là bản copy một JSON file.

---

## FOS-013 — Không có tenant isolation hoặc authorization theo project

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Một bearer API key dùng chung cho toàn server. Ai có key có thể đọc/sửa mọi project. Không có:

- Owner/project ACL.
- User identity.
- Service account scope.
- Read-only token.
- Per-project authorization.
- Audit principal.

Điều này đặc biệt nghiêm trọng vì metadata sau đó vẫn ghi các quyết định là “human”.

---

# PHẦN B — STAGE, GATE, EVIDENCE VÀ HUMAN APPROVAL

## FOS-014 — Gate cũ có thể mở khóa stage mới sau khi dữ liệu đã thay đổi

- **Mức độ:** Critical
- **Trạng thái:** REPRODUCED
- **Vị trí:** `src/core/orchestrator.mjs`, `runCurrentGate()` và `advance()`

### Nguyên nhân gốc

Gate không gắn với:

- Project revision.
- Hash của input dùng để đánh giá.
- Artifact versions.
- Evidence versions.
- Thời điểm mutation cuối của stage.

`advance()` chỉ tìm gate `pass` phù hợp stage, không chứng minh gate đó phản ánh trạng thái hiện tại.

### Bằng chứng tái hiện

1. Stage `divergence` có đủ 5 ý tưởng.
2. Chạy gate và nhận `pass`.
3. Thay ideas thành mảng rỗng.
4. Gọi `advance()`.
5. Project vẫn chuyển sang `synthesis`.

Kết quả quan sát:

```text
gateStatus: pass
currentIdeas: 0
advancedStage: synthesis
```

### Hậu quả

Bất kỳ requirement, artifact, evidence hoặc decision nào thay đổi sau gate đều có thể không làm gate mất hiệu lực. Hệ thống có thể tiến stage hoặc release trên cơ sở proof đã lỗi thời.

---

## FOS-015 — `runCurrentGate()` có race giữa read và write

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Luồng hiện tại:

1. `getProject()` đọc snapshot.
2. `runGate(snapshot)` tính kết quả ngoài transaction.
3. `store.update()` append gate vào project mới nhất.

Một mutation có thể chen vào giữa bước 1 và 3. Gate được tính từ snapshot A nhưng ghi vào state B mà không có marker cho biết mismatch.

---

## FOS-016 — Mọi mutation liên quan không tự làm stale gate

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Các hành động như:

- Thay ideas.
- Thay score.
- Chọn lại idea.
- Thêm/đổi artifact.
- Invalidate artifact.
- Đóng/mở finding.
- Thay intent/domain.
- Thêm evidence.

không tự đánh dấu gate cũ là stale. Gate history chỉ tiếp tục tích lũy.

---

## FOS-017 — Gate chấp nhận artifact `invalidated` hoặc `superseded`

- **Mức độ:** Critical
- **Trạng thái:** REPRODUCED
- **Vị trí:** `src/core/gates.mjs`, helper kiểm tra artifact

Phần lớn rule chỉ kiểm tra tồn tại artifact theo `type`, không yêu cầu state active/verified. Ca tái hiện:

```json
[
  {"type":"product-thesis","state":"invalidated"},
  {"type":"capability-map","state":"superseded"}
]
```

Gate `product-definition` vẫn pass.

Điều này phá ý nghĩa của invalidation và supersession: artifact đã bị tuyên bố không còn hợp lệ vẫn mở gate.

---

## FOS-018 — Evidence rỗng vẫn đủ để vượt verification gate

- **Mức độ:** Critical
- **Trạng thái:** REPRODUCED

`validateEvidence()` cho phép evidence không có URI, không hash và summary rỗng. Chỉ cần tạo các record có `type` đúng như `verification-report`, `security-review`, `ux-evidence`, gate có thể đạt 100%.

Một record kiểu:

```json
{
  "type": "security-review",
  "title": "Security review"
}
```

không chứng minh review đã xảy ra, không có kết quả, công cụ, commit, environment, subject hoặc người xác minh.

---

## FOS-019 — Gate chỉ kiểm tra sự hiện diện, không kiểm tra chất lượng proof

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Evidence gate không xác thực:

- `status: pass/fail`.
- Exit code.
- Command đã chạy.
- Test count.
- Commit SHA.
- Artifact/content hash mà evidence áp dụng.
- Producer identity.
- Tool/version.
- Timestamp freshness.
- Signature/provenance.
- Environment.
- Reviewer independence.

Do đó “machine-readable proof” hiện gần với “machine-readable label” hơn là proof.

---

## FOS-020 — Evidence không gắn với artifact hoặc project revision cụ thể

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Một security review cũ vẫn có thể tồn tại sau khi architecture/code thay đổi và tiếp tục được gate tính. Không có `subjectArtifactId`, `subjectHash`, `projectRevision`, `sourceCommit` bắt buộc.

---

## FOS-021 — Gate attach toàn bộ evidence ID thay vì evidence theo rule

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Gate result có thể tham chiếu tất cả evidence hiện có, kể cả evidence không liên quan. Điều này tạo proof ledger nhiễu và khiến auditor khó xác định rule nào được chứng minh bởi record nào.

---

## FOS-022 — Assurance A0 và A4 không khác nhau về hành vi gate

- **Mức độ:** Critical đối với tuyên bố assurance
- **Trạng thái:** REPRODUCED + OVERCLAIM

README mô tả A0–A4 với mức kiểm tra khác nhau, bao gồm red team, signed provenance, fault injection, migration rehearsal và external assurance. Runtime gate không đọc `project.assurance` để thay đổi rule.

Cùng một project được gán A0 hoặc A4 cho kết quả gate giống nhau. Vì vậy A4 hiện chỉ là metadata, không phải control profile.

---

## FOS-023 — `critical` finding chặn nhưng `high` finding có thể không chặn

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Policy blocker tập trung vào critical findings ở một số gate. Một số lượng lớn high findings có thể không làm fail release tùy stage. Không có risk aggregation hoặc threshold theo assurance/domain.

---

## FOS-024 — Đóng finding không xác thực evidence resolution

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

`closeFinding()` nhận mảng string evidence và resolution text. Không kiểm tra:

- Evidence ID có tồn tại.
- Evidence có liên quan finding.
- Evidence có pass.
- Ai được phép đóng.
- Finding critical có cần reviewer độc lập không.
- Resolution có làm artifact upstream thay đổi không.

Một agent có thể tự tạo chuỗi tùy ý và đóng finding.

---

## FOS-025 — “Human confirmation” chỉ là chuỗi đoán được

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Confirmation dựa trên mẫu text như:

```text
CONFIRM accept:<finding-id>
```

Đây là xác nhận cú pháp, không phải xác nhận danh tính. Bất kỳ model, script hoặc client nào biết format đều có thể tự tạo.

Không có:

- Authenticated human principal.
- Session binding.
- One-time nonce.
- Expiration.
- State hash được phê duyệt.
- Signature.
- Role/permission.

---

## FOS-026 — `acceptedBy` là dữ liệu caller tự khai báo

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Caller có thể truyền tên bất kỳ. Runtime không gắn giá trị này với token identity. Audit record vì vậy không thể chứng minh ai đã chấp nhận rủi ro.

---

## FOS-027 — `selectIdea()` luôn ghi `decidedBy: 'human'`

- **Mức độ:** High
- **Trạng thái:** REPRODUCED
- **Vị trí:** `src/core/orchestrator.mjs:74–79`

Ngay cả khi selection được gọi trực tiếp qua MCP/HTTP bởi agent, decision vẫn ghi “human”. Đây là provenance sai có hệ thống.

---

## FOS-028 — Stage transition không khóa các command không phù hợp stage

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Orchestrator không ngăn:

- Chọn idea ở stage intent.
- Thêm release evidence ở stage discovery.
- Thay toàn bộ ideas sau architecture/release.
- Tạo artifact bất kỳ ở bất kỳ stage.
- Sửa dữ liệu đã dùng làm nền cho downstream work.

Stage hiện chủ yếu kiểm soát `advance()`, không kiểm soát command surface.

---

## FOS-029 — Released project vẫn có thể bị mutation tự do

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Không có chế độ immutable/sealed cho release. Sau release, caller vẫn có thể thêm evidence, đổi idea, thêm artifact hoặc finding mà không tạo release revision mới. Điều này làm “released state” không phải snapshot bất biến.

---

## FOS-030 — Gate ID dựa trên thời gian có nguy cơ collision

- **Mức độ:** Low/Medium
- **Trạng thái:** STATIC-CONFIRMED

Nếu ID gate dựa trên `Date.now()` hoặc timestamp với độ phân giải mili-giây, hai gate đủ gần có thể trùng. Với concurrency đã có vấn đề, collision càng khó audit. ID nên dùng UUID và giữ separate `evaluatedAt`.

---

## FOS-031 — Catch-all trong rule evaluation có thể che bug code thành “rule fail”

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Nếu evaluator catch mọi exception và chuyển thành failed rule, lỗi lập trình, TypeError hoặc corrupted project có thể bị trình bày như business rule không đạt. Điều này làm chẩn đoán sai nguyên nhân và che defect runtime.

---

## FOS-032 — Equal weighting tạo điểm số có vẻ chính xác nhưng thiếu semantics

- **Mức độ:** Medium
- **Trạng thái:** ARCHITECTURAL-GAP

Các rule có trọng số gần như đồng đều trong khi impact rất khác nhau. Ví dụ thiếu một artifact phụ và tồn tại critical security finding không nên chỉ khác nhau qua vài phần trăm. Score phần trăm có thể tạo cảm giác định lượng chính xác hơn policy thực tế.

---

# PHẦN C — ARTIFACT LIFECYCLE, HASH VÀ LINEAGE

## FOS-033 — Public API không có đường đi hợp lệ tới release

- **Mức độ:** Critical
- **Trạng thái:** REPRODUCED/ARCHITECTURAL-GAP

Release gate yêu cầu `release-dossier` ở state `verified`. Nhưng public tool chỉ tạo artifact `draft`. Các helper nội bộ như `verifyArtifact()`, `supersedeArtifact()` và `invalidateDownstream()` không được expose qua orchestrator/tool registry.

Vì vậy một client chỉ dùng API được công bố không thể hoàn tất lifecycle tới release hợp lệ. Muốn đạt release phải:

- Sửa JSON trực tiếp.
- Import module nội bộ.
- Hoặc thêm code ngoài repository.

Đây là “dead-end workflow”: tài liệu mô tả end-to-end delivery nhưng public command surface bị thiếu bước cốt lõi.

---

## FOS-034 — Artifact lifecycle helpers tồn tại nhưng không được nối runtime

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Các hàm review/verify/supersede/invalidate chủ yếu được test riêng. Chúng không phải invariant bắt buộc của quá trình lưu hoặc chuyển stage. Việc “có hàm” không tương đương “hệ thống thực thi lifecycle”.

---

## FOS-035 — Artifact ID trùng được chấp nhận

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

`saveArtifact()` append artifact mà không kiểm tra ID unique. Hai artifact cùng ID làm mọi reference, graph traversal, supersession và audit trở nên mơ hồ.

---

## FOS-036 — Evidence ID và finding ID trùng cũng được chấp nhận

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

Không có uniqueness constraint toàn aggregate. Reference bằng string có thể trỏ tới nhiều record hoặc record sai.

---

## FOS-037 — Hash artifact không canonical

- **Mức độ:** High đối với provenance/caching
- **Trạng thái:** REPRODUCED
- **Vị trí:** `src/core/artifacts.mjs`

Hash dùng `JSON.stringify`. Hai object semantically giống nhau nhưng thứ tự key khác nhau cho hash khác nhau.

Ví dụ:

```js
{ a: 1, b: 2 }
{ b: 2, a: 1 }
```

Kết quả SHA-256 khác nhau. Điều này phá tính ổn định giữa ngôn ngữ/runtime và làm cache/invalidation/signature không đáng tin cậy.

---

## FOS-038 — Hash không được tái xác minh khi đọc hoặc verify

- **Mức độ:** Critical đối với “immutable content hashes”
- **Trạng thái:** STATIC-CONFIRMED + OVERCLAIM

Artifact lưu field hash, nhưng runtime không định kỳ recompute và so sánh content. Nếu file JSON bị sửa trực tiếp mà hash giữ nguyên, hệ thống không phát hiện. “Immutable” hiện chỉ là giá trị được tạo lúc đầu, không phải thuộc tính được enforce.

---

## FOS-039 — Artifact content không thực sự immutable

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Toàn project là JSON mutable. Không có content-addressed store, append-only version record hoặc write protection. Một updater có thể thay content của artifact cũ tại chỗ mà không tạo version mới.

---

## FOS-040 — Missing dependency bị graph bỏ qua âm thầm

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED
- **Vị trí:** `src/core/graph.mjs`

Khi artifact tham chiếu dependency ID không tồn tại, graph utility dùng `continue` thay vì fail. Hệ thống vì vậy có thể báo graph hợp lệ dù lineage bị đứt.

---

## FOS-041 — Cycle chỉ được phát hiện khi chủ động gọi graph utility

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

`saveArtifact()` không build/validate graph. Cycle có thể được lưu vào state và tồn tại lâu dài. Detection không phải write invariant.

---

## FOS-042 — Duplicate graph node chỉ được phát hiện muộn

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Graph builder có thể phát hiện duplicate IDs, nhưng save path không gọi nó. Dữ liệu invalid được chấp nhận trước rồi mới có thể nổ ở một utility khác.

---

## FOS-043 — Supersession không được validate chặt

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Cần kiểm tra nhưng hiện chưa được enforce đầy đủ:

- Target artifact tồn tại.
- Không supersede chính mình.
- Không tạo cycle supersession.
- State transition hiện tại cho phép.
- New artifact thuộc cùng project/type contract phù hợp.
- Reviewer/principal có quyền.
- Downstream invalidation đã xảy ra.

---

## FOS-044 — Invalidation không tự chạy khi upstream thay đổi

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Dù có helper `invalidateDownstream()`, các mutation quan trọng không gọi nó. Thay product thesis hoặc architecture không tự invalidate implementation plan, verified build hoặc release dossier downstream.

---

## FOS-045 — Gate không phân biệt artifact active và historical

- **Mức độ:** Critical
- **Trạng thái:** REPRODUCED

Ngay cả khi supersession/invalidation được ghi, gate vẫn có thể dùng artifact historical theo type. Điều này làm lineage state trở nên trang trí thay vì điều khiển.

---

## FOS-046 — Không có registry schema theo artifact type

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

`product-thesis`, `capability-map`, `architecture-decision`, `release-dossier` đều có thể chứa object tùy ý. Không có validator bắt buộc theo `type + schemaVersion`. Artifact tên đúng nhưng content rỗng vẫn có thể tồn tại và mở gate.

---

## FOS-047 — `schemaVersion` artifact là chuỗi tự khai báo

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Không có registry version được hỗ trợ, migration hoặc compatibility check. Caller có thể ghi version tùy ý.

---

## FOS-048 — Hai artifact contract không tương thích cùng tồn tại

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Một contract validator kỳ vọng artifact dạng `content: string`, `version`, `title`; runtime createArtifact dùng cấu trúc khác với `schemaVersion`, `content: any`, `producedBy`, state/lifecycle fields. Việc có hai định nghĩa “artifact” làm tăng nguy cơ:

- Schema/test xác thực một shape nhưng runtime dùng shape khác.
- Adapter tạo payload theo contract sai.
- Refactor một bên mà không cập nhật bên kia.

---

## FOS-049 — Reviewer independence chỉ là string comparison

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

“Worker và gatekeeper tách biệt” không có authenticated role model. Nếu producer/reviewer chỉ là text caller tự điền, một agent có thể dùng hai tên khác nhau để vượt kiểm tra mà vẫn là cùng principal.

---

## FOS-050 — Review evidence/gate reference không được kiểm tra tồn tại và pass

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Artifact có thể ghi reference tới evidence ID hoặc gate ID giả. Không có foreign-key constraint.

---

## FOS-051 — Residual risk và decision references không được xác thực

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

String reference không được đối chiếu aggregate. Release dossier có thể tuyên bố đã xử lý risk/decision không tồn tại.

---

## FOS-052 — Không có active-version uniqueness theo artifact type

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Có thể có nhiều `verified product-thesis` cùng lúc mà không biết cái nào canonical. Gate chỉ cần thấy một record type phù hợp.

---

## FOS-053 — Artifact provenance không có chữ ký hoặc principal xác thực

- **Mức độ:** High; Critical với A3/A4
- **Trạng thái:** ARCHITECTURAL-GAP + OVERCLAIM

`producedBy`/`reviewedBy` là metadata, không phải provenance cryptographic. README nhắc signed provenance ở assurance cao nhưng runtime không có signing, key management, verification hoặc trust root.

---

# PHẦN D — IDEA ENGINE, SCORING VÀ SELECTION

## FOS-054 — “Semantic fingerprint” thực chất là hash của chuỗi normalize

- **Mức độ:** High đối với tuyên bố novelty
- **Trạng thái:** STATIC-CONFIRMED + OVERCLAIM

Fingerprint được tạo từ các field text đã normalize rồi SHA. Nó chỉ tốt trong việc phát hiện nội dung gần như giống hệt. Hai paraphrase cùng cơ chế có thể cho fingerprint khác hoàn toàn.

Ví dụ:

- “AI tự động chia video dài thành clip ngắn.”
- “Công cụ tìm khoảnh khắc nổi bật rồi tạo Shorts.”

Ý tưởng có thể cùng mechanism nhưng text khác, do đó bị coi là mới.

---

## FOS-055 — Tuyên bố “compared at mechanism level” chưa được runtime chứng minh

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

Các field như mechanism có tồn tại, nhưng không có ontology, embedding, semantic classifier, pairwise judge hoặc feature graph. Hash text không phải semantic comparison.

---

## FOS-056 — Fingerprint bị truncate còn 64 bit

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

16 ký tự hex tương đương 64 bit. Với catalog/idea volume lớn, rủi ro collision tuy chưa cao ở prototype nhưng không phù hợp làm định danh provenance lâu dài nếu không có collision handling.

---

## FOS-057 — Logic fingerprint bị lặp ở nhiều module

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Duplicate implementation giữa contracts/scoring tạo nguy cơ drift: cùng một idea có thể được validate với fingerprint A nhưng score/cluster với fingerprint B sau refactor.

---

## FOS-058 — Duplicate score cho cùng idea vẫn vượt gate

- **Mức độ:** Critical
- **Trạng thái:** REPRODUCED

Hai ideas `i1`, `i2`; vectors chứa hai record đều cho `i1`. `scoreIdeas()` chấp nhận vì mỗi `ideaId` tồn tại. Gate chỉ kiểm tra `scores.length >= ideas.length`, nên pass dù `i2` chưa từng được chấm.

---

## FOS-059 — Không bắt buộc đúng một score cho mỗi idea

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Không có uniqueness và exact coverage. Có thể:

- Chấm một idea nhiều lần.
- Bỏ sót idea khác.
- Truyền nhiều vector hơn số idea.
- Dùng duplicate để thay đổi ranking.

---

## FOS-060 — Điểm số hoàn toàn do caller tự khai báo

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Novelty, feasibility, leverage… không gắn với evidence, evaluator identity hoặc rubric execution. Caller có thể truyền mọi điểm số để chọn kết quả mong muốn.

---

## FOS-061 — Không kiểm tra provenance và freshness của score

- **Mức độ:** Medium/High
- **Trạng thái:** ARCHITECTURAL-GAP

Score không gắn với idea content hash. Nếu idea content thay đổi nhưng ID giữ nguyên, score cũ có thể vẫn được xem là áp dụng được tùy mutation path.

---

## FOS-062 — Selection có thể xảy ra trước scoring hoặc sai stage

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

`selectIdea()` chỉ kiểm tra ID tồn tại và reason không rỗng. Không bắt buộc:

- Stage selection.
- Idea đã được score.
- Gate trước đó pass.
- Human identity thật.
- Candidate chưa invalidated.

---

## FOS-063 — `saveIdeas()` thay toàn bộ ideas nhưng không invalidate downstream

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Hàm reset scores/selected idea, nhưng không invalidate:

- Gate đã pass.
- Product thesis.
- Capability map.
- UX contract.
- Architecture.
- Implementation/release evidence.

Đây là một nguồn trực tiếp của stale downstream state.

---

## FOS-064 — Selected idea không được liên kết bắt buộc với artifact downstream

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Một product thesis không cần reference selected idea hoặc its hash. Hệ thống không chứng minh architecture/release được xây từ direction mà user đã chọn.

---

## FOS-065 — Clustering novelty chỉ là exact fingerprint grouping

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

Không có semantic clustering thực, approximate nearest neighbor, similarity threshold hoặc explanation. “Reject fake novelty” chưa được enforce với paraphrase.

---

# PHẦN E — SKILL CATALOG VÀ ROUTER

## 3. Kết quả phân tích catalog

| Chỉ số | Kết quả |
|---|---:|
| Tổng skill | 242 |
| Core skill | 146 |
| Domain skill | 96 |
| `stable` | 1 |
| `candidate` | 241 |
| Skill khai báo tool | 0 |
| Skill khai báo conflict | 0 |
| Số output type khác nhau | 255 |
| Số input type khác nhau | 23 |
| Giao giữa output và input | **0** |

Kết quả `produced ∩ consumed = 0` có nghĩa: không một output type của skill nào được một skill khác khai báo consume. Catalog có nhiều node nhưng không có edge dữ liệu đúng nghĩa giữa chúng.

---

## FOS-066 — 242 skill không tạo thành graph nối được

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Mọi output type được sinh theo naming riêng như `<skill-name>-artifact`, còn input type dùng các pack name khác. Không có output nào khớp input nào. Đây không phải “typed skill graph” có thể truyền artifact từ node này sang node khác; nó là catalog node gần như độc lập.

---

## FOS-067 — Toàn bộ 255 output type không có consumer

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Mỗi skill có thể “produce” artifact, nhưng artifact đó không mở precondition/consume cho skill tiếp theo. Typed handoff vì vậy không hoạt động như pipeline.

---

## FOS-068 — Có 23 input type không có producer

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Các input orphan gồm nhiều loại cốt lõi:

```text
acceptance-contracts
candidate-change
confirmed-brief
creative-brief
deployment-context
domain-context
failing-test
gate-state
implementation-task
implemented-increment
product-definition
product-evidence
project-state
quality-attributes
research-questions
research-synthesis
selected-concept
system-boundaries
threat-context
user-workflows
verified-build
verified-specification
behavioral-baseline
```

Một vài loại bootstrap được runtime tự thêm như project-state/gate-state; nhiều loại khác không có đường sản xuất.

---

## FOS-069 — Không có producer cho nhiều artifact mà gate yêu cầu

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Phân tích catalog không tìm thấy producer trực tiếp cho nhiều loại như:

```text
problem-discovery
research-synthesis
product-thesis
capability-map
threat-model
acceptance-contracts
release-dossier
```

Do đó router không thể tự chọn skill dựa trên typed output để lấp các gate gap quan trọng nhất.

---

## FOS-070 — Test tên “every skill is connected” là false positive

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Validator chỉ đếm tập produced và consumed, không tính intersection, không kiểm tra producer cho input, consumer cho output hoặc reachability. Test có tên mạnh nhưng assertion không chứng minh claim đó.

---

## FOS-071 — Không có reachability test từ intent tới release

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Không có test trả lời câu hỏi quan trọng nhất:

> Với catalog hiện tại, có tồn tại một đường typed hợp lệ từ `confirmed-intent` đến `release-dossier` hay không?

Phân tích hiện tại cho thấy không.

---

## FOS-072 — `handoff.next = "router-selected"` không trỏ tới skill thật

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Nhiều skill generated dùng placeholder `router-selected`. Đây không phải node catalog. Typed handoff không thể resolve trực tiếp.

---

## FOS-073 — Router không thật sự dùng gate failures để remediate

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED + OVERCLAIM

Context truyền vào router không chứa:

- Failed rule IDs.
- Missing gate artifacts.
- Open findings.
- Risks.
- Evidence gaps.
- Stale artifact graph.

Router vì vậy không thể suy luận “gate fail vì thiếu threat-model, hãy tìm skill produce threat-model và prerequisite của nó”.

---

## FOS-074 — Tuyên bố “scores missing artifacts” chưa đúng với runtime

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

Router dùng danh sách artifact hiện có cho eligibility, nhưng không xây target output set từ gate policy, không tính distance tới gate và không truy ngược prerequisite closure.

---

## FOS-075 — Tuyên bố “risk-aware router” chưa đúng

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

Project có `risks` và `findings`, nhưng router không đưa chúng vào scoring/context. High/critical security finding không tự ưu tiên security-remediation skill.

---

## FOS-076 — Candidate skills không bị quarantine trong runtime

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

241/242 skill có status candidate. Router không loại candidate theo eval result/quarantine state thực. “Candidate skills that reduce pass rate… are quarantined” chưa được nối vào catalog mutation/routing.

---

## FOS-077 — Utility mặc định 0.5 và không được học tự động

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

`project.skillUtility` được đọc khi route, nhưng không có runtime flow ghi kết quả utility sau skill execution. `recordSkillUtility()` tồn tại rời rạc hoặc chỉ dùng test. Vì vậy historical utility gần như luôn default.

---

## FOS-078 — Router không biết skill đã thực sự được thực thi hay chưa

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Không có skill-run lifecycle:

```text
selected → leased → running → produced artifact → verified → failed/retried
```

Route chỉ là recommendation list. Không có execution ID, input binding, output binding, retry, timeout hoặc completion evidence.

---

## FOS-079 — Tool availability feature là giả về dữ liệu catalog

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Router có logic liên quan tools, nhưng cả 242 skill đều khai báo `tools: []`. Vì vậy tool compatibility không tạo khác biệt thực tế.

---

## FOS-080 — Conflict handling feature là giả về dữ liệu catalog

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Cả catalog không khai báo conflict. Router có code conflict nhưng không có dữ liệu để dùng. Tuyên bố conflict-aware chưa có tác dụng trên catalog hiện tại.

---

## FOS-081 — `forge_next_action` bỏ qua tham số `tools`

- **Mức độ:** High
- **Trạng thái:** REPRODUCED
- **Vị trí:** `src/server/tool-registry.mjs`

Schema nhận `tools`, nhưng dispatcher gọi `nextAction(projectId)` mà không truyền tools. Khi catalog bắt đầu có tool requirement thật, kết quả `next_action` sẽ sai.

---

## FOS-082 — `project.domain = all` làm domain packs khó được chọn

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Domain matching không coi `all` là “mọi domain skill đều eligible” theo một chiến lược khám phá rõ ràng. Trong bootstrap, route chủ yếu lặp lại core kernel skills.

---

## FOS-083 — Domain tùy ý có thể phá routing

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

`recordIntent()` có thể đổi domain từ `all` sang string không nằm trong whitelist, ví dụ `not-a-real-domain`. Router sau đó không có domain pack tương ứng.

---

## FOS-084 — Invalidated artifact vẫn được đưa vào router context

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

`routeNextSkills()` thêm `artifact.type` cho mọi artifact, không lọc state. Một artifact invalidated có thể làm skill precondition được coi là đã thỏa.

---

## FOS-085 — Router load toàn bộ nội dung 242 skill mỗi lần

- **Mức độ:** High về hiệu năng và OVERCLAIM
- **Trạng thái:** STATIC-CONFIRMED

README nói metadata được index global và full instruction chỉ load khi selected. Nhưng `loadSkillCatalog()` đọc cả `SKILL.md`/body và contract cho toàn catalog mỗi lần route.

Đây là ngược với “242 skills without loading 242 skills” và progressive disclosure thực sự.

---

## FOS-086 — Không có cache/index catalog

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Catalog gần như bất biến trong runtime nhưng được đọc/parse lại. Không có cache theo mtime/hash, index theo stage/domain/output hoặc hot reload có kiểm soát.

---

## FOS-087 — Estimated token chỉ là metadata tự khai báo

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Các giá trị token tập trung ở vài số như 700/760/900, trong khi skill body dài khác nhau. Không có tokenizer đo thực. Scoring cost có thể thiên lệch hoặc giả chính xác.

---

## FOS-088 — Skill generated có tính template cao nhưng được mô tả “method-specific” mạnh

- **Mức độ:** Medium
- **Trạng thái:** OVERCLAIM

Nhiều skill được sinh từ một bộ playbook/template chung. Chúng có tên khác, nhưng protocol và handoff structure lặp lại. Số lượng 242 không đồng nghĩa 242 capability độc lập đã được kiểm chứng.

---

## FOS-089 — Router chỉ trả tên/score/reason, không trả skill instruction

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

MCP surface không có `forge_skill_get` hoặc resource URI per skill để host lấy body đã selected. Host nhận tên skill nhưng repository không cung cấp đường protocol hoàn chỉnh để fetch instruction qua MCP.

---

## FOS-090 — Route không phải minimal execution plan

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

Top-N scoring không topologically sort prerequisite, không tìm minimal set để sửa gate và không bind output của skill A vào input skill B. Nó chỉ là ranked recommendation list.

---

## FOS-091 — Không có downstream invalidation ảnh hưởng router

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Tài liệu generator nói root skill đọc invalidation impact, nhưng router context không chứa graph invalidation state chi tiết.

---

# PHẦN F — MCP

## 4. Chuẩn tham chiếu

Dự án quảng bá MCP `2025-11-25`. Báo cáo đối chiếu với tài liệu chính thức:

- Lifecycle: <https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle>
- Streamable HTTP transport: <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>

---

## FOS-092 — Cho gọi tool trước `initialize`

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

Gửi `tools/list` trực tiếp trước initialize vẫn trả 17 tools. Không có per-client lifecycle/session state để chặn operation trước negotiation.

---

## FOS-093 — Không negotiate protocol version

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

Client gửi requested version giả `1900-01-01`; server vẫn trả `2025-11-25`. Server không xác định compatible version hoặc reject mismatch.

---

## FOS-094 — Header `MCP-Protocol-Version` không được validate

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

POST với `MCP-Protocol-Version: 1900-01-01` vẫn HTTP 200. Transport spec yêu cầu xử lý version header hợp lệ và reject version unsupported.

---

## FOS-095 — `GET /mcp` trả 404 thay vì transport behavior phù hợp

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

Streamable HTTP endpoint cần hỗ trợ GET cho SSE hoặc trả Method Not Allowed khi không hỗ trợ. Route hiện rơi vào 404 như endpoint không tồn tại.

---

## FOS-096 — Không validate Origin

- **Mức độ:** Critical/High
- **Trạng thái:** REPRODUCED

Request với:

```text
Origin: http://evil.example
```

vẫn được xử lý HTTP 200. MCP transport yêu cầu kiểm tra Origin để giảm DNS rebinding và request từ origin không tin cậy.

---

## FOS-097 — Không kiểm tra `Accept` theo Streamable HTTP

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Server không xác thực client chấp nhận media types cần thiết. Điều này làm behavior khác spec và có thể gây interoperability failure với client strict.

---

## FOS-098 — Không có `Mcp-Session-Id` hoặc session lifecycle

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Không có session initialization, session state, termination hoặc routing theo session. Mọi request là stateless nhưng vẫn quảng bá lifecycle/capability theo phiên bản mới.

---

## FOS-099 — Notification có thể nhận response lỗi

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

JSON-RPC notification không có `id` đáng lẽ không nhận response. Unknown notification hiện có thể nhận error object `id: null`, vi phạm semantics notification và có thể làm client strict lỗi.

---

## FOS-100 — `initialized` không thiết lập state thật

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Server có thể chấp nhận notification nhưng không lưu client đã initialized. Vì vậy lifecycle chỉ là branch method, không phải state machine.

---

## FOS-101 — Tool input schema chỉ để quảng bá, không dùng runtime validation

- **Mức độ:** Critical/High
- **Trạng thái:** REPRODUCED

`TOOL_DEFINITIONS` có JSON Schema và `additionalProperties: false`, nhưng dispatcher không validate args bằng schema. Payload có field thừa hoặc type sai có thể lọt tới implementation và được xử lý không nhất quán.

---

## FOS-102 — Required prompt/tool arguments không được enforcement thống nhất

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Một số method dựa vào lỗi JavaScript thủ công thay vì schema error chuẩn. Client nhận lỗi khác nhau tùy nhánh, khó tương thích.

---

## FOS-103 — Output schemas quá rộng

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Nhiều output schema cho `additionalProperties: true` hoặc object generic. Việc quảng bá typed protocol không đem lại validation/contract mạnh cho consumer.

---

## FOS-104 — Không có pagination cho tools/resources/prompts

- **Mức độ:** Low/Medium hiện tại
- **Trạng thái:** ARCHITECTURAL-GAP

Catalog có thể tăng. Response list không có cursor semantics đầy đủ, dễ vượt payload limit hoặc không tương thích expectation của client khi scale.

---

## FOS-105 — Error nội bộ có thể bị trả trực tiếp

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

`cause.message`/exception message có thể chứa path, parse detail, project ID hoặc dữ liệu nhạy cảm. Public error cần code ổn định và request ID; detail đầy đủ chỉ nên vào log server.

---

## FOS-106 — Không có request timeout/rate limit/concurrency guard

- **Mức độ:** High khi expose mạng
- **Trạng thái:** HARDENING

Một client có thể gửi nhiều operation, route catalog lặp lại hoặc body gần giới hạn để tiêu tốn CPU/I/O. Không có per-key quota, timeout hoặc queue limit.

---

## FOS-107 — Tool annotation `readOnlyHint` sai

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

`forge_skills_route` và `forge_next_action` được mô tả read-only/idempotent nhưng thực tế append `routes` và `history`. Host có thể retry/call parallel vì tin annotation, làm state phình hoặc tạo side effect không mong muốn.

---

## FOS-108 — Export annotation cũng không phản ánh side effect

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

`forge_project_export` tạo/ghi file export. Nó không thuần read-only và có filesystem side effect.

---

## FOS-109 — MCP resource UI là static snapshot, không gắn project/tool result

- **Mức độ:** High đối với MCP App
- **Trạng thái:** ARCHITECTURAL-GAP

Resource trả Forge Studio HTML standalone. Tool output không được inject/re-render vào widget. Vì vậy host có thể hiển thị UI đẹp nhưng state không phản ánh project vừa thao tác.

---

## FOS-110 — `.mcp.json`/adapter command khởi chạy HTTP server nhưng không có stdio loop

- **Mức độ:** High tùy host
- **Trạng thái:** STATIC-CONFIRMED/INTEGRATION-GAP

Nhiều manifest dùng command `node src/server/http-server.mjs`. Process này mở HTTP endpoint, không đọc JSON-RPC từ stdin. Nếu host hiểu command là stdio MCP server và manifest không chỉ URL/transport riêng, kết nối sẽ không thành công. Repository thiếu lớp bridge rõ ràng giữa local command launch và HTTP port.

---

# PHẦN G — A2A

## 5. Chuẩn tham chiếu

Dự án quảng bá A2A 1.0. Đối chiếu:

- A2A v1 changes: <https://a2a-protocol.org/latest/whats-new-v1/>
- A2A specification: <https://a2a-protocol.org/dev/specification/>

---

## FOS-111 — Khai báo A2A 1.0 nhưng wire format là kiểu cũ

- **Mức độ:** Critical đối với interoperability
- **Trạng thái:** STATIC-CONFIRMED + OVERCLAIM

Agent Card ghi `protocolVersion: "1.0"`, nhưng implementation sử dụng nhiều cấu trúc pre-v1:

- Method `message/send`, `tasks/get` thay vì PascalCase operations của v1.
- `kind: "text"`/`kind: "data"`.
- Role lowercase `agent`.
- State lowercase `completed`.
- Top-level `url` và `preferredTransport` thay vì `supportedInterfaces`.

Client A2A 1.0 strict có thể không nhận diện hoặc parse response.

---

## FOS-112 — Agent Card tự mâu thuẫn với implementation

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

Card quảng bá `application/json` input, nhưng data-only part bị reject. Error còn nói “text or data part is required” trong khi parser chỉ lấy text part.

---

## FOS-113 — `stateTransitionHistory: true` nhưng không có persisted task history

- **Mức độ:** High
- **Trạng thái:** REPRODUCED + OVERCLAIM

`tasks/get` trả thông báo task persistence không enabled. Task được tạo completed tức thời và không có lifecycle history lưu trữ. Capability công bố không đúng hành vi.

---

## FOS-114 — A2A “Create project” không tạo project thật

- **Mức độ:** Critical đối với bridge
- **Trạng thái:** REPRODUCED

A2A bridge trả artifact generic/static; proxy instrumentation cho thấy object Forge/orchestrator không được gọi. Message có ý định tạo project không tạo state trong ForgeOS.

---

## FOS-115 — `context.forge` không được sử dụng

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Bridge nhận context có thể chứa Forge instance nhưng không bind message/action vào kernel. A2A hiện giống demo responder hơn là provider-neutral bridge tới ForgeOS.

---

## FOS-116 — `tasks/get` không hỗ trợ task retrieval thật

- **Mức độ:** High
- **Trạng thái:** REPRODUCED

Không có task store, lookup, ownership, expiry hoặc replay. Method tồn tại nhưng chức năng cốt lõi không có.

---

## FOS-117 — Không có task cancellation

- **Mức độ:** Medium/High
- **Trạng thái:** ARCHITECTURAL-GAP

Không thể cancel công việc, dù một agent operating system thường cần cancellation/interrupt semantics.

---

## FOS-118 — Không có streaming/push notification implementation

- **Mức độ:** Medium
- **Trạng thái:** ARCHITECTURAL-GAP

Không có streaming message/task update hoặc webhook/push config. Capability surface rất nhỏ so với cách mô tả bridge.

---

## FOS-119 — Không có A2A authentication/authorization identity mapping

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

A2A caller không được map tới principal có role. Task/artifact/decision không có ownership đáng tin cậy.

---

## FOS-120 — Không validate A2A payload bằng schema v1

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Parser thủ công chấp nhận/reject theo nhánh riêng, không có generated model/schema validation. Field enum, interface, part union và required constraints không được enforce theo spec.

---

## FOS-121 — Agent Card endpoint có thể bị Host header poisoning

- **Mức độ:** Critical/High
- **Trạng thái:** REPRODUCED

Server xây URL từ `req.headers.host`. Gửi:

```text
Host: attacker.example
```

làm card trả endpoint:

```json
{"url":"http://attacker.example/a2a"}
```

Client discovery có thể bị hướng sang host attacker nếu response được cache/trust.

---

# PHẦN H — HTTP SERVER, AUTH VÀ BẢO MẬT

## FOS-122 — Docker bind `0.0.0.0` trong khi API key là tùy chọn

- **Mức độ:** Critical khi publish port
- **Trạng thái:** STATIC-CONFIRMED/HARDENING

Default container network exposure có thể mở API ra ngoài mà không auth nếu operator quên cấu hình key. Runtime nên fail startup khi bind non-loopback mà không có auth, trừ khi có explicit insecure flag.

---

## FOS-123 — Không có TLS ở runtime

- **Mức độ:** High nếu không đặt sau reverse proxy
- **Trạng thái:** HARDENING

Bearer key và project data đi plaintext qua HTTP. Tài liệu cần ràng buộc deployment sau TLS proxy hoặc runtime hỗ trợ HTTPS.

---

## FOS-124 — Một API key có toàn quyền

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Không có scope như read/write/release/admin; không có rotation metadata, expiration hoặc key ID.

---

## FOS-125 — Không có rate limiting và brute-force protection

- **Mức độ:** High khi expose internet
- **Trạng thái:** HARDENING

Token guess, request flood hoặc expensive route calls không bị hạn chế.

---

## FOS-126 — Không có structured audit log theo authenticated principal

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

History nằm trong project và caller identity không đáng tin. Không có append-only security log, source IP, token ID, request ID hoặc tamper evidence.

---

## FOS-127 — Secret detector bỏ sót nhiều loại credential

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Regex hiện có thể bỏ qua:

- JWT.
- npm tokens.
- Slack tokens.
- GitLab tokens.
- Hugging Face tokens.
- Database URL có password.
- Session cookies.
- OAuth refresh token.
- Secret nội bộ/custom prefix.

Tên “secret screening” cần được hiểu là best-effort, không phải guarantee.

---

## FOS-128 — Secret detector có thể lỗi trên giá trị JSON không stringify được

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Nếu flow cho phép BigInt hoặc object đặc biệt trước assert, `JSON.stringify` có thể ném lỗi. Error handling cần phân biệt unsafe value và detector failure.

---

## FOS-129 — Evidence URI không được kiểm tra scheme/trust

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Caller có thể đưa URI tùy ý, bao gồm scheme không mong muốn hoặc internal URL. Nếu UI/client sau này tự fetch, có thể dẫn tới SSRF hoặc unsafe link. Cần allowlist scheme và không auto-fetch untrusted URI.

---

## FOS-130 — Public base URL phụ thuộc untrusted Host header

- **Mức độ:** Critical/High
- **Trạng thái:** REPRODUCED

Ngoài Agent Card, mọi absolute URL xây từ Host đều có thể bị poison. Public URL phải là config cố định hoặc Host allowlist sau trusted proxy policy.

---

## FOS-131 — Không có timeout/header timeout/connection limit rõ ràng

- **Mức độ:** Medium/High
- **Trạng thái:** HARDENING

Slow clients có thể giữ connection; long operations có thể chiếm resource. Node defaults không thay thế policy production.

---

## FOS-132 — Error responses chưa có stable public error model

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Client phải parse message text. Không có error code taxonomy, request ID và retryability marker.

---

## FOS-133 — Không có sandbox cho tool/skill execution

- **Mức độ:** Medium hiện tại, High nếu thêm executor
- **Trạng thái:** ARCHITECTURAL-GAP

Dự án hiện không tự chạy model/tool nguy hiểm, nên đây chưa phải exploit trực tiếp. Nhưng tên “OS for agents” dễ làm người dùng kỳ vọng isolation. Khi executor được thêm, cần sandbox, filesystem/network policy và capability isolation; hiện chưa có.

---

# PHẦN I — EVAL LAB, RELEASE VERIFICATION VÀ “QUARANTINE”

## FOS-134 — Eval Lab không tự chạy behavioral cases

- **Mức độ:** Critical đối với tuyên bố Forge Lab
- **Trạng thái:** ARCHITECTURAL-GAP + OVERCLAIM

24 case/rubric tồn tại dưới dạng file, nhưng không có runner thực thi model/skill trên chúng và thu output. `evaluateCandidate()` chỉ nhận metrics caller cung cấp.

---

## FOS-135 — Forbidden patterns không được kiểm tra tự động

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Case có thể khai báo forbiddenPatterns, requiredEvidence hoặc rubric, nhưng evaluator không load và áp dụng lên output thật.

---

## FOS-136 — Candidate metrics có thể được caller bịa

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Caller truyền passRate, quality, tokenCount, criticalFailures. Không có signed raw runs hoặc recomputation. Quyết định promote/quarantine không có provenance.

---

## FOS-137 — Không có bounds validation đầy đủ cho eval metrics

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Có thể truyền passRate > 1, quality ngoài miền dự kiến hoặc criticalFailures số âm/phân số nếu validator không chặn. Điều này làm decision invalid.

---

## FOS-138 — `compareRuns()` không đảm bảo cùng tập case

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Baseline và candidate có thể chạy trên case khác nhau hoặc số lượng khác nhau. Tổng token/pass rate khi đó không so sánh apples-to-apples.

---

## FOS-139 — Không có variance, seed, confidence interval hoặc flaky detection

- **Mức độ:** Medium/High
- **Trạng thái:** ARCHITECTURAL-GAP

Một run ngẫu nhiên có thể quyết định skill. Không có repeated runs, bootstrap CI, judge agreement hoặc threshold uncertainty.

---

## FOS-140 — Không có judge calibration hoặc blind evaluation

- **Mức độ:** Medium
- **Trạng thái:** ARCHITECTURAL-GAP

Nếu sau này dùng LLM judge, hiện không có chống position bias, label leakage hoặc reference calibration.

---

## FOS-141 — Eval decision không cập nhật catalog status

- **Mức độ:** Critical đối với quarantine claim
- **Trạng thái:** ARCHITECTURAL-GAP

Không có flow:

```text
run eval → decision → update skill status → router excludes quarantined skill
```

Vì vậy “quarantine” hiện là khái niệm/tài liệu, không phải control runtime.

---

## FOS-142 — Eval không cập nhật `skillUtility`

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Historical utility được router đọc nhưng không được tạo từ eval/skill runs.

---

## FOS-143 — `release:verify` không tạo/kiểm tra freshness của release evidence report

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

`release:verify` chạy validate + smoke nhưng không gọi `release:evidence`. CI có thể xanh trong khi verification report cũ, sai count hoặc không phản ánh commit hiện tại.

---

## FOS-144 — Verification report hardcode nhiều số/chuỗi

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Nếu script hardcode test counts, protocol version hoặc file inventory thay vì derive từ command outputs, report có thể trông chính xác nhưng stale.

---

## FOS-145 — Existing residual-risk report đánh giá thấp lỗi protocol/integrity

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Evidence phát hành hiện không phát hiện stale gate, lock race, A2A v1 mismatch, empty evidence bypass hoặc public release dead-end. Điều này cho thấy release evidence chưa đủ adversarial.

---

## FOS-146 — Không có end-to-end public release test

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Không có test dùng **chỉ public tools** để:

```text
create project → record intent → pass all stages → create/review/verify artifacts → release
```

Nếu test này tồn tại, thiếu artifact verify API sẽ lộ ngay.

---

# PHẦN J — JSON SCHEMAS VÀ CONTRACTS

## FOS-147 — JSON Schemas không được dùng để validate runtime payload

- **Mức độ:** Critical/High
- **Trạng thái:** STATIC-CONFIRMED

Repository có schema files nhưng không có validator runtime như Ajv hoặc generated validators. Tests chủ yếu kiểm tra schema file parse được và có metadata, không validate real instances.

---

## FOS-148 — Project schema quá permissive

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Nhiều array item không có shape chặt, stage/domain không enum đầy đủ, revision không tồn tại, cross-reference không thể hiện. Schema không bảo vệ aggregate invariant.

---

## FOS-149 — Evidence schema thiếu format constraints

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

- SHA không bắt pattern/length chặt.
- URI có thể không có format/scheme policy.
- Timestamp không bắt `date-time` chặt ở mọi nơi.
- Subject/provenance không bắt buộc.

---

## FOS-150 — Skill schema không bắt buộc các field router phụ thuộc

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Assurance/tools/conflicts/invalidates có thể optional hoặc quá lỏng. Router sau đó phải default âm thầm, khiến catalog có vẻ hợp lệ nhưng feature không có dữ liệu.

---

## FOS-151 — A2A schema phản ánh shape cũ trong khi metadata nói v1

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Schema không bảo vệ conformance v1; ngược lại nó có thể khiến test xác nhận chính wire format cũ.

---

## FOS-152 — MCP result schema generic không bảo đảm output contract

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Client không thể generate type an toàn hoặc phát hiện server regression từ schema quá rộng.

---

## FOS-153 — Không có cross-field/cross-record validation

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

JSON Schema đơn lẻ cũng không đủ cho:

- Unique ID toàn aggregate.
- Foreign key existence.
- DAG acyclic.
- Gate revision match.
- Exactly one active artifact version.
- Exactly one score per idea.

Repository chưa có aggregate validator bù phần này.

---

## FOS-154 — “Schema validator” trong sơ đồ kiến trúc không có runtime tương ứng đầy đủ

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

Có contract helper thủ công, nhưng không có một validation boundary thống nhất cho mọi HTTP/MCP/A2A/store mutation.

---

# PHẦN K — FORGE STUDIO / DASHBOARD

## FOS-155 — Dashboard chỉ hiển thị project đầu tiên

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Không có project selector đầy đủ. Với nhiều project, user có thể xem nhầm project hoặc không truy cập được project khác qua UI.

---

## FOS-156 — Nút gọi tool nhưng bỏ kết quả và không rerender

- **Mức độ:** High đối với UX chức năng
- **Trạng thái:** STATIC-CONFIRMED

Sau `forge_next_action` hoặc `forge_gate_run`, UI không cập nhật state, không fetch lại project, không show success/error. Backend có thể đã thay đổi nhưng màn hình vẫn cũ.

---

## FOS-157 — Không có loading, disable hoặc error state

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Double click có thể tạo nhiều routes/gates; user không biết request đang chạy hay thất bại.

---

## FOS-158 — Route cards là nội dung tĩnh, không điều khiển execution

- **Mức độ:** High đối với “Studio”
- **Trạng thái:** ARCHITECTURAL-GAP

Không có start skill, assign worker, inspect contract, view instruction hoặc mark completion.

---

## FOS-159 — Artifact lineage chỉ là danh sách phẳng

- **Mức độ:** High đối với claim
- **Trạng thái:** OVERCLAIM

UI không hiển thị DAG, edges, active/superseded/invalidation propagation hoặc missing dependency. Gọi nó “lineage” dễ tạo kỳ vọng cao hơn.

---

## FOS-160 — Risk console hiển thị findings, không dùng `risks`

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Project có field `risks` nhưng runtime/UI gần như không sử dụng. Risk console thực chất là finding list.

---

## FOS-161 — Proof ledger chỉ hiển thị nhãn, không hiển thị proof

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

Không có command, result, subject hash, producer, signature hoặc evidence linkage theo rule. UI làm evidence trông đáng tin hơn dữ liệu thực.

---

## FOS-162 — Novelty engine UI không có semantic cluster

- **Mức độ:** Medium/High
- **Trạng thái:** OVERCLAIM

Chỉ hiển thị cards/scores; không có cluster relation, similarity explanation hoặc duplicate rationale.

---

## FOS-163 — Stage rail đánh dấu stage trước là pass theo index

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

UI suy ra pass từ vị trí stage, không từ gate evidence. Nếu state bị sửa trực tiếp hoặc stale gate bypass xảy ra, rail vẫn trình bày lịch sử như đã verified.

---

## FOS-164 — UI không hiển thị hash, invalidation và residual risks đầy đủ

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Các yếu tố cốt lõi trong claim “evidence-gated graph” không thể audit trực quan.

---

## FOS-165 — Standalone fullscreen/action có chức năng giả hoặc no-op

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Một số control chỉ thay đổi title hoặc không có action thật. UI demo đẹp nhưng chưa phải console điều hành đầy đủ.

---

## FOS-166 — `openai:set_globals` không cập nhật project content

- **Mức độ:** High đối với ChatGPT widget
- **Trạng thái:** STATIC-CONFIRMED

Handler chỉ xử lý phần nhỏ như document title; tool result/global state không được map vào view model của Forge Studio.

---

## FOS-167 — CSP dùng `unsafe-inline`

- **Mức độ:** Low/Medium
- **Trạng thái:** HARDENING

Với embedded app, inline script/style làm CSP yếu hơn. Hiện code escape tương đối tốt, nhưng nếu sau này render user content hoặc external resource, blast radius lớn hơn.

---

# PHẦN L — ADAPTER, TCK VÀ MANIFEST

## FOS-168 — Adapter validator chủ yếu kiểm tra file tồn tại

- **Mức độ:** High đối với compatibility claim
- **Trạng thái:** STATIC-CONFIRMED

Không khởi chạy host thật, không handshake MCP/A2A, không gọi tool, không kiểm tra payload shape hoặc UI render. “Implemented” có thể chỉ có README/config file.

---

## FOS-169 — Một assertion adapter JSON gần như vô nghĩa

- **Mức độ:** Medium
- **Trạng thái:** STATIC-CONFIRMED

Một test kiểu `JSON.parse('null')` chỉ chứng minh JavaScript parse được literal `null`, không chứng minh adapter manifest hợp lệ.

---

## FOS-170 — ChatGPT adapter “implemented” nhưng evidence không chứng minh integration thật

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

Có README/widget/server assets nhưng không có automated host conformance, tool invocation trace hoặc screenshot/state assertion được tạo từ ChatGPT host thật.

---

## FOS-171 — TCK capability là dữ liệu tự khai báo

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Không có runner đối chiếu capability record với runtime/host behavior. TCK hiện giống compatibility matrix documentation hơn test kit thực sự.

---

## FOS-172 — Không có contract test trên từng host adapter

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Mỗi host có transport/config convention khác nhau. File tồn tại không chứng minh command, cwd, env, URL, stdio/HTTP mode và lifecycle hoạt động.

---

## FOS-173 — Project manifest đánh dấu tất cả file `verified` chỉ vì đọc/hash được

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED + OVERCLAIM

Generator dùng “verified” theo nghĩa file tồn tại/hash được, nhưng người đọc có thể hiểu là behavior đã được kiểm chứng. Đây là semantic overloading nguy hiểm trong dự án nhấn mạnh evidence.

---

## FOS-174 — Manifest version/source metadata có thể hardcode và stale

- **Mức độ:** Medium/High
- **Trạng thái:** STATIC-CONFIRMED

Nếu version/commit không derive từ package/git/current build, manifest có thể mô tả nhầm artifact.

---

## FOS-175 — “15 adapters” là số lượng pack, không phải 15 integration đã verified

- **Mức độ:** High
- **Trạng thái:** OVERCLAIM

README có caveat không phải upstream certification, đó là điểm tốt. Tuy nhiên nhãn badge/implemented vẫn dễ được hiểu là hoạt động end-to-end. Evidence hiện chưa đủ cho kết luận đó.

---

# PHẦN M — CÁC ĐIỂM MÙ CỦA TEST SUITE

## FOS-176 — Coverage cao nhưng không kiểm tra invariant

- **Mức độ:** Critical về assurance
- **Trạng thái:** REPRODUCED

Các lỗi FOS-001, FOS-014, FOS-017, FOS-018, FOS-058, MCP/A2A mismatch đều tồn tại trong khi 60/60 test pass.

---

## FOS-177 — Không có deterministic concurrency regression test

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Cần barrier-controlled 3-writer test; hiện không có.

---

## FOS-178 — Không có stale-gate regression test

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Không test mutation sau pass rồi advance.

---

## FOS-179 — Không test artifact state trong gate

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Không có cases invalidated/superseded artifact phải fail.

---

## FOS-180 — Không test evidence quality

- **Mức độ:** Critical
- **Trạng thái:** ARCHITECTURAL-GAP

Tests chỉ cần đúng type; không assert evidence phải có subject hash, status, provenance hoặc payload.

---

## FOS-181 — Không test exact score coverage

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Duplicate score bypass không được bao phủ.

---

## FOS-182 — Skill connectivity test không dựng graph

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Không kiểm tra produced/consumed edges hoặc path to release.

---

## FOS-183 — MCP tests xác nhận behavior nội bộ thay vì conformance

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Nếu test expected chính wire shape sai, test xanh chỉ chứng minh implementation nhất quán với chính nó. Không có conformance vectors từ spec.

---

## FOS-184 — A2A tests xác nhận shape cũ trong khi claim v1

- **Mức độ:** Critical
- **Trạng thái:** STATIC-CONFIRMED

Test cần dùng official v1 models/examples, không dùng response shape do implementation tự định nghĩa.

---

## FOS-185 — Adapter tests không chạy adapter

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

File/config check không phải integration test.

---

## FOS-186 — Schema tests không validate real positive/negative instances

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Schema file parse được không chứng minh schema đủ chặt hoặc runtime dùng schema.

---

## FOS-187 — Smoke test quá nông

- **Mức độ:** High
- **Trạng thái:** STATIC-CONFIRMED

Smoke không chạy full lifecycle, không kiểm tra concurrency, stale gate, A2A v1, Origin/version headers hoặc public release path.

---

## FOS-188 — Không kiểm tra release evidence khớp commit/test hiện tại

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

CI có thể xanh với report cũ.

---

## FOS-189 — Không có fuzz/property tests cho state machine

- **Mức độ:** Medium/High
- **Trạng thái:** ARCHITECTURAL-GAP

Các sequence bất thường như saveIdeas sau release, duplicate IDs, random mutation order, interrupted writes và malformed references chưa được khám phá tự động.

---

## FOS-190 — Không có negative security tests đủ sâu

- **Mức độ:** High
- **Trạng thái:** ARCHITECTURAL-GAP

Thiếu tests cho Host poisoning, Origin rejection, invalid protocol version, raw error leak, auth boundary, rate limit và malicious evidence URI.

---

# PHẦN N — MA TRẬN “TÍNH NĂNG THẬT / MỘT PHẦN / GIẢ HOẶC CHƯA NỐI”

Trong bảng này, “giả/chưa nối” không có nghĩa toàn bộ code là giả. Nó có nghĩa **tính năng được nêu như một năng lực hệ thống hoàn chỉnh nhưng runtime hiện chỉ có metadata, helper, UI mock hoặc tài liệu; đường end-to-end chưa tồn tại**.

| Tuyên bố/tính năng | Thành phần đang có | Phần còn thiếu hoặc sai | Phán quyết |
|---|---|---|---|
| Atomic project state | Temp write + rename | Lost update race, không CAS, không multi-process lock, không fsync | **Một phần, không an toàn concurrency** |
| Typed evidence-gated graph | Types, gates, artifact arrays | Evidence rỗng pass; graph không enforce; gate stale | **Một phần nghiêm trọng** |
| Risk-aware router | Có scoring/filter | Không truyền risks/findings/failed rules | **Chưa thực sự risk-aware** |
| Missing-artifact routing | Có artifact eligibility | Không derive target từ gate; không prerequisite closure | **Chưa có end-to-end** |
| 242 connected skills | 242 folders/contracts | `produced ∩ consumed = 0` | **Không đúng ở mức graph** |
| Progressive disclosure | Metadata/body trong skill | Mỗi route đọc full 242 skill | **Tuyên bố không khớp implementation** |
| Tool-aware routing | Router có field tools | 242/242 skill tools rỗng; next_action bỏ tools | **Dormant/không hoạt động thực tế** |
| Conflict-aware routing | Có code conflict | 242/242 conflicts rỗng | **Dormant** |
| Historical utility | `skillUtility` field | Không có feedback loop ghi utility | **Placeholder** |
| Candidate quarantine | Eval decision primitive | Không cập nhật catalog/router | **Chưa có** |
| Downstream invalidation | Helper graph | Không gọi khi mutation; gate vẫn dùng invalidated artifact | **Helper rời rạc** |
| Immutable artifact hashes | Có SHA field | Hash không canonical, không revalidate, content mutable | **Không immutable thật** |
| Artifact versioning | Có state/schemaVersion | Không active-version constraint/migration/lifecycle public | **Một phần** |
| Separate worker/gatekeeper | Metadata producer/reviewer | Không authenticated roles; string có thể giả | **Không enforce identity** |
| Machine-readable proof | Evidence records | Không command/result/hash/freshness/provenance bắt buộc | **Nhãn dữ liệu, chưa phải proof mạnh** |
| Human confirmation | Confirmation phrase | Agent tự sinh được; không identity/nonce | **Không phải human auth** |
| No fake novelty | Normalized text hash | Không semantic similarity/clustering | **Không đạt claim** |
| Mechanism-level comparison | Có mechanism field | Không semantic model/ontology/judge | **Rất hạn chế** |
| Assurance A0–A4 | Metadata + README | Gate runtime không đổi theo level | **Gần như giả** |
| Forge Lab 24 cases | Case files/rubrics | Không runner/judge/quarantine integration | **Bộ dữ liệu, chưa phải lab tự động** |
| MCP 2025-11-25 | JSON-RPC endpoint/tools | Lifecycle/Origin/version/GET/schema thiếu | **Không compliant** |
| A2A 1.0 | Agent Card + endpoint | Wire shape cũ, task bridge giả, no persistence | **Không compliant** |
| Provider-neutral A2A bridge | Responder | Không gọi Forge kernel | **Demo stub** |
| ChatGPT MCP App | Static HTML resource | Tool result/state không nối UI | **Demo UI, chưa fully functional** |
| Forge Studio lineage | Artifact list | Không graph/edge/invalidation view | **UI label mạnh hơn thực tế** |
| Risk console | Findings display | `risks` field gần như chết | **Một phần** |
| Proof ledger | Evidence list | Không proof details/linkage | **Một phần rất nông** |
| 15 implemented adapters | Files/readmes/manifests | Không host-level conformance | **Documented packs, chưa verified integration** |
| Compatibility TCK | Capability JSON/evidence | Không runner thực | **Matrix, chưa phải TCK đầy đủ** |
| Verified project manifest | Hash/file inventory | “verified” chỉ nghĩa tồn tại/hash | **Tên trạng thái gây hiểu lầm** |
| End-to-end release | Gate/stages | Public API thiếu verify lifecycle | **Không thể hoàn thành chuẩn** |
| Multi-agent operating system | Router/tools/state primitives | Không executor, leasing, task queue, identity, isolation | **Nền móng prototype** |

---

# PHẦN O — CÁC FIELD/MODULE CÓ DẤU HIỆU “DEAD” HOẶC CHƯA ĐƯỢC TÍCH HỢP

Các mục dưới đây không nhất thiết là bug độc lập, nhưng chứng minh khoảng cách giữa kiến trúc mô tả và runtime:

1. `project.risks` được khởi tạo nhưng không có lifecycle đầy đủ và router/UI không dùng đúng nghĩa.
2. `project.brief` được khởi tạo nhưng không có flow rõ ràng.
3. `skillUtility` được đọc nhưng không có feedback loop tự động.
4. `verifyArtifact()` không có public tool/orchestrator path.
5. `supersedeArtifact()` không có public lifecycle path.
6. `invalidateDownstream()` không được gọi khi upstream mutation.
7. `validateArtifact()` dùng contract khác runtime artifact.
8. `evaluateCandidate()` không load/run eval cases.
9. `compareRuns()` không gắn vào skill status.
10. `tools` trong skill contract đều rỗng.
11. `conflicts` trong skill contract đều rỗng.
12. `activeSkills` có trong routing context nhưng không có execution manager đáng tin cậy cung cấp state đó.
13. A2A `context.forge` không được bridge dùng để tạo/chỉnh project.
14. A2A task history capability được công bố nhưng task store không tồn tại.
15. UI fullscreen/route/action controls có phần no-op hoặc không cập nhật state.
16. TCK evidence không được runner xác minh.
17. JSON schemas không được runtime validator sử dụng.
18. Release evidence generation không nằm trong `release:verify`.
19. Manifest “verified” không phản ánh behavior verification.
20. Domain packs tồn tại nhiều nhưng graph output/input không nối.

---

# PHẦN P — CÁC BẤT BIẾN HỆ THỐNG HIỆN CHƯA ĐƯỢC BẢO ĐẢM

Đây là cách ngắn nhất để thấy mức độ vấn đề. Một ForgeOS đáng tin cậy phải bảo đảm các mệnh đề sau, nhưng phiên bản hiện tại chưa làm được:

1. **Mọi update trả thành công đều xuất hiện trong state cuối.** — Không, FOS-001.
2. **Mọi gate pass phản ánh đúng revision hiện tại.** — Không, FOS-014/015.
3. **Artifact invalidated không thể mở gate.** — Không, FOS-017.
4. **Evidence pass chứng minh một hành động đã chạy và pass.** — Không, FOS-018/019.
5. **A4 mạnh hơn A0.** — Không, FOS-022.
6. **Mọi artifact ID là duy nhất.** — Không, FOS-035/036.
7. **Hash giống nhau cho nội dung JSON tương đương.** — Không, FOS-037.
8. **Content sửa trái phép được phát hiện.** — Không, FOS-038/039.
9. **Mọi dependency tồn tại và graph không cycle trước khi lưu.** — Không, FOS-040/041.
10. **Mỗi idea được chấm đúng một lần.** — Không, FOS-058/059.
11. **Human decision thật sự đến từ human đã xác thực.** — Không, FOS-025/027.
12. **Mỗi skill output có thể trở thành input của skill tiếp theo.** — Không, FOS-066/067.
13. **Có đường skill graph từ intent đến release.** — Không được chứng minh và catalog hiện cho thấy không.
14. **Router chọn skill để khắc phục rule vừa fail.** — Không, FOS-073.
15. **Skill tốn token mà không tăng chất lượng bị quarantine.** — Không, FOS-141.
16. **MCP operation chỉ chạy sau initialize/version negotiation.** — Không, FOS-092/093.
17. **A2A 1.0 client có thể tương tác theo wire format v1.** — Không, FOS-111.
18. **A2A tạo project sẽ tạo project thật.** — Không, FOS-114.
19. **Agent Card không thể bị attacker điều khiển bằng Host header.** — Không, FOS-121.
20. **Public API có thể hoàn tất release lifecycle.** — Không, FOS-033.

---

# PHẦN Q — CÁC CA TÁI HIỆN QUAN TRỌNG

## Q.1. Mất update

Kỳ vọng:

```text
A, B và C đều tồn tại sau khi ba Promise hoàn thành.
```

Quan sát:

```text
['project-created', 'A', 'B']
```

Kết luận: update C trả xong nhưng biến mất.

## Q.2. Gate stale

Kỳ vọng:

```text
Sau khi ideas bị xóa, divergence gate phải stale/fail và advance bị chặn.
```

Quan sát:

```text
gateStatus = pass
currentIdeas = 0
advance => synthesis
```

## Q.3. Duplicate score

Kỳ vọng:

```text
Hai ideas phải có hai ideaId khác nhau trong score vectors.
```

Quan sát:

```text
score(i1), score(i1), no score(i2) => gate pass
```

## Q.4. Invalid artifact gate

Kỳ vọng:

```text
invalidated/superseded artifact không được tính.
```

Quan sát:

```text
product-thesis invalidated + capability-map superseded => gate pass
```

## Q.5. Empty evidence

Kỳ vọng:

```text
Evidence thiếu payload/result/provenance không đủ mở gate.
```

Quan sát:

```text
Chỉ title + type => verification gate pass
```

## Q.6. MCP lifecycle/version

Quan sát:

```text
tools/list before initialize => success
initialize requested 1900-01-01 => server returns 2025-11-25
MCP-Protocol-Version: 1900-01-01 => HTTP 200
Origin: http://evil.example => HTTP 200
GET /mcp => 404
```

## Q.7. A2A bridge

Quan sát:

```text
data-only part => rejected
"Create project" => no project created
context.forge => not invoked
tasks/get => persistence disabled
```

## Q.8. Host poisoning

Request:

```text
Host: attacker.example
```

Agent Card chứa:

```json
{"url":"http://attacker.example/a2a"}
```

---

# PHẦN R — NHỮNG ĐIỂM TỐT CẦN GHI NHẬN ĐỂ TRÁNH KẾT LUẬN PHIẾN DIỆN

Báo cáo này tập trung vào lỗi, nhưng một số nền móng tốt là có thật:

- Phân tách `core`, `router`, `server`, `ui`, `evals` tương đối rõ.
- Project ID/path validation giảm traversal.
- Ghi file qua temp + rename tốt hơn ghi trực tiếp.
- File project mode `0600`.
- Container chạy non-root.
- Có body-size/content-type checks.
- API key compare dùng timing-safe comparison.
- Có kiểm tra dangerous object keys/cycle/secret ở write boundary.
- Có stage model, gate rule result và remediation structure.
- Có graph/artifact helper tốt làm nền.
- Có ý tưởng tách producer/reviewer.
- Có deterministic tie-breaking trong scoring/router.
- Tài liệu và cấu trúc repository đầy đủ hơn nhiều prototype thông thường.
- Test chạy nhanh và ổn định.

Những điểm tốt này cho thấy dự án có thể sửa và nâng cấp; chúng không xóa các lỗi Critical ở trên.

---

# PHẦN S — KẾT LUẬN CUỐI CÙNG

ForgeOS v0.1.0 hiện nên được mô tả chính xác là:

> **Một prototype/kernel nghiên cứu có nhiều primitive tốt cho product-engineering agents, kèm catalog skill, HTTP/MCP/A2A demo surface và UI trình diễn; chưa phải một operating system evidence-gated, protocol-compliant và production-safe hoàn chỉnh.**

Các tuyên bố gây hiểu lầm nhất ở trạng thái hiện tại là:

1. 242 skill là một graph connected.
2. Router risk-aware, missing-artifact-aware và utility-learned.
3. Evidence là proof đủ mạnh để bảo đảm stage transition.
4. Assurance A0–A4 được enforce.
5. Artifact hash/lineage là immutable và tự invalidating.
6. Candidate skill thực sự được eval/quarantine tự động.
7. MCP 2025-11-25 compliant.
8. A2A 1.0 compliant.
9. A2A bridge thực sự điều khiển Forge kernel.
10. Public API có thể hoàn thành end-to-end release.
11. Human confirmation chứng minh người thật phê duyệt.
12. Adapter “implemented” đã được host-level verified.

Lỗi nguy hiểm nhất về dữ liệu là **lost update race**. Lỗi nguy hiểm nhất về logic là **stale gate bypass**. Khoảng trống lớn nhất về kiến trúc là **skill catalog không có typed edges thực tế**. Khoảng trống lớn nhất về niềm tin là **evidence/approval chỉ là metadata do caller tự khai báo**. Khoảng trống interoperability lớn nhất là **MCP/A2A quảng bá phiên bản mà implementation chưa tuân thủ**.

---

## Phụ lục 1 — Danh sách file trọng tâm đã kiểm tra

```text
src/core/project-store.mjs
src/core/orchestrator.mjs
src/core/gates.mjs
src/core/artifacts.mjs
src/core/graph.mjs
src/core/contracts.mjs
src/core/scoring.mjs
src/core/security.mjs
src/core/stages.mjs
src/router/router.mjs
src/router/utility.mjs
src/skills/catalog.mjs
src/server/mcp.mjs
src/server/a2a.mjs
src/server/http-server.mjs
src/server/tool-registry.mjs
src/evals/evaluator.mjs
src/ui/forge-studio.mjs
scripts/generate-skills.mjs
scripts/validate-skills.mjs
scripts/validate-adapters.mjs
scripts/generate-verification-report.mjs
scripts/generate-manifest.mjs
scripts/smoke.mjs
schemas/*
tests/*
adapters/*
tck/*
evals/*
README.md
package.json
Dockerfile
```

## Phụ lục 2 — Ý nghĩa của “không có” trong báo cáo

Khi báo cáo nói một tính năng “không có”, ý nghĩa cụ thể là một trong các trường hợp:

- Không tìm thấy implementation runtime.
- Có helper nhưng không được gọi trong production flow.
- Có metadata nhưng không có enforcement.
- Có UI nhưng không có backend/state integration.
- Có test fixture nhưng không có runner.
- Có schema nhưng runtime không validate bằng schema.
- Có adapter file nhưng không có host-level proof.

Báo cáo không coi một ý tưởng trong README hoặc một hàm không được nối là tính năng hoàn chỉnh.
