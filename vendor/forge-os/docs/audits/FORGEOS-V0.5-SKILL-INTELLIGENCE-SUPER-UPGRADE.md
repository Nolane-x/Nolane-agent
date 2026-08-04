# ForgeOS Skill Intelligence, Deterministic Harness & Continuous-Learning Super-Upgrade

> **Bản đặc tả nâng cấp tổng lực từ ForgeOS v0.4.0 lên thế hệ Skill Intelligence OS.**  
> Mục tiêu của tài liệu này là biến ForgeOS từ một control plane có 1.024 capability contract nhưng mới 242 procedural skill thành một hệ thống có **1.024 kỹ thuật sâu, định tuyến chính xác, context toàn cục được biên dịch theo ngân sách, bằng chứng không thể tự khai và khả năng vận hành production hoàn chỉnh**.

**Phiên bản nguồn đã rà soát:** `forge-os-v0.4.0(1).zip`  
**Ngày rà soát:** 2026-07-25  
**Trạng thái tài liệu:** Implementation blueprint / release specification — Revision 2  
**Mục tiêu phát hành đề xuất:** `v0.5.0 Skill Intelligence` cho nền móng và `v0.6.0 Deterministic Skill Fabric` cho pipeline chuyên dụng; chỉ gắn nhãn `v1.0` sau khi toàn bộ Definition of Done gốc và Definition of Done tăng cường ở cuối tài liệu đạt.

---

## 1. Tuyên bố mục tiêu

ForgeOS không nên cố thắng các dự án lớn bằng số thư mục skill. ForgeOS phải thắng bằng một tổ hợp mà các hệ thống khác hiếm khi có đầy đủ cùng lúc:

1. **Độ sâu kỹ thuật:** 1.024 procedural skill thật, không phải 1.024 prompt sinh từ một template chung.
2. **Định tuyến chính xác:** chọn đúng kỹ thuật, đúng phần của kỹ thuật, đúng thời điểm và giải thích được vì sao chọn hoặc loại.
3. **Context tối thiểu:** không gửi cả kho skill, codebase, lịch sử, artifact và log vào model.
4. **Bằng chứng đáng tin:** model hoặc worker không thể tự tuyên bố test đạt, chất lượng cao hay hoàn thành.
5. **Khả năng kết hợp:** nhiều kỹ thuật nhỏ ghép thành workflow liên ngành mà không làm mất nguồn gốc và trạng thái.
6. **Production thật:** nhiều node, cơ sở dữ liệu hoàn chỉnh, sandbox, secret isolation, audit, backup và disaster recovery.
7. **Dễ dùng:** cài một lệnh, dùng trong vài phút, không bắt người dùng hiểu trust kernel trước khi nhận được giá trị.
8. **Đánh giá định lượng:** chỉ tuyên bố vượt hệ thống lớn khi benchmark công khai chứng minh tốt hơn trên các trục cụ thể.

### 1.1 Định nghĩa “mạnh hơn hệ thống 100.000 sao”

Không sử dụng câu “mạnh hơn toàn diện” theo cảm tính. ForgeOS chỉ được tuyên bố mạnh hơn trên từng trục khi có số liệu:

| Trục | Điều kiện tối thiểu để được tuyên bố vượt |
|---|---|
| Chất lượng skill | Tăng tỷ lệ hoàn thành có ý nghĩa thống kê trên bộ nhiệm vụ giữ kín |
| Độ rộng | Có procedural coverage thật ở nhiều lĩnh vực, không tính knowledge link là skill |
| Token | Giảm tổng input token của workflow, không chỉ giảm phần skill |
| Trust | Ngăn self-attestation, stale proof, provider substitution và approval replay bằng runtime invariant |
| Router | Precision@3, Recall@6 và unsafe-route rate tốt hơn baseline |
| Production | Có lifecycle store đầy đủ, sandbox và HA được kiểm thử công khai |
| Dễ dùng | Tỷ lệ cài thành công và thời gian hoàn thành workflow đầu tiên tốt hơn baseline |
| Liên vận hành | Giữ tương thích Agent Skills, MCP, A2A và nhiều host phổ biến |

Các dự án có độ phổ biến rất lớn như Superpowers chứng minh giá trị của skill có tính kỷ luật, kiểm thử hành vi và trải nghiệm cài đặt đơn giản. Agent Skills chứng minh progressive disclosure và định dạng portable. LangChain/LangGraph và các agent framework lớn chứng minh nhu cầu về stateful orchestration, checkpointing, observability và hệ sinh thái. ForgeOS nên **học các điểm mạnh này rồi bổ sung trust kernel, skill graph sâu và context compiler toàn cục**, thay vì chỉ tăng số lượng file.

---

## 2. Baseline đã xác minh trên v0.4.0

Các lệnh đã chạy trực tiếp trên source archive:

```bash
npm run validate
npm run federation:eval
npm run federation:audit
npm run release:verify
```

Kết quả chính:

| Chỉ số | Trạng thái v0.4.0 |
|---|---:|
| Automated tests | 275/275 đạt |
| Module qua syntax check | 112 |
| JSON parse thành công | 347 |
| Markdown link validation | 346 file |
| Adapter validation | 15 adapter |
| Capability contract | 1.024 |
| Built-in provider mapping | 1.266 |
| Procedural skill/provider | 242 |
| Stable procedural skill | 33 |
| Candidate procedural skill | 209 |
| Capability thiếu procedural provider | 782 |
| Capability thiếu stable procedural provider | 991 |
| Knowledge provider mapping | 1.024 |
| Federation adversarial cases | 18/18 đạt |
| Release verification độc lập | 275/275 đạt |

### 2.1 Những điểm v0.4 đã làm tốt

- Capability và provider được tách thành hai khái niệm.
- Provider bên ngoài bị quarantine, scan, evaluate và human-approve trước khi stable.
- Bundle đóng băng capability hash, provider digest, source coordinate và nghĩa vụ bằng chứng.
- Materializer kiểm tra path traversal, symlink escape, digest mismatch và byte/token budget.
- Knowledge pack mặc định chỉ materialize reference, không tự sao chép toàn bộ nội dung từ xa.
- Trust Kernel đã có CAS/revision, fenced lease, artifact content/envelope hash, trusted receipts, ACL và release evidence.
- SQLite WAL có lifecycle production single-node tương đối hoàn chỉnh.
- Release archive có thể tự kiểm tra sau khi giải nén mà không cần `.git`.

Đây là nền móng mạnh. Bản nâng cấp mới không được phá vỡ các invariant này.

---

## 3. Các vấn đề quan trọng phải sửa

## 3.1 1.024 capability hiện là ma trận khung, chưa phải 1.024 kỹ thuật sâu

`capabilities/catalog.json` được tạo từ:

```text
32 domain × 32 lifecycle operation = 1.024 capability
```

Mọi domain lặp lại cùng các operation như `map-landscape`, `frame-problem`, `design-architecture`, `test-security`, `certify-release`. Sau khi chuẩn hóa cấu trúc, catalog chỉ có **32 structural signature**, mỗi signature xuất hiện đúng 32 lần.

Điều này hữu ích cho lifecycle coverage, nhưng không thể thay thế kỹ thuật chuyên sâu. Ví dụ:

```text
frontend-engineering.test-performance
```

không tương đương với các kỹ thuật cụ thể:

```text
profiling-main-thread-long-tasks
reducing-react-render-thrashing
optimizing-webgl-draw-calls
preventing-layout-instability
profiling-browser-compositor-layers
virtualizing-large-data-grids
```

### Yêu cầu sửa

- Capability graph phải biểu diễn **outcome domain-specific**.
- Technique registry phải biểu diễn **phương pháp domain-specific**.
- Lifecycle operation chỉ là một chiều phân loại, không phải nội dung của capability.
- Không sinh semantics bằng phép nhân ma trận nếu chưa có manifest chuyên môn cho từng node.

---

## 3.2 Nội dung 242 skill vẫn quá giống template

Phân tích trực tiếp toàn bộ `SKILL.md`:

- Tổng ngân sách ước tính: **460.751 token**.
- Trung vị mỗi skill: **1.910 token**, khoảng 957 từ.
- Khoảng **60,8% dòng của một skill trung bình** là dòng xuất hiện ở ít nhất 80% toàn bộ skill.
- Cả 242 skill đang mang version `0.2.0`.
- 33 stable, 209 candidate.

Các quy tắc lặp lại như provenance, independent review, artifact envelope và stale evidence là tốt, nhưng chúng nên được đặt trong **kernel policy hoặc inherited contract**, không nên lặp nguyên văn trong 242 skill. Việc lặp gây ba tác hại:

1. Tăng token.
2. Che khuất kỹ thuật riêng của skill.
3. Khó cập nhật một policy chung mà không tái tạo hàng trăm file.

### Yêu cầu sửa

- Di chuyển policy chung sang `Skill Policy Profile` có hash và version.
- `SKILL.md` chỉ giữ trigger, kỹ thuật, decision rules, failure modes và verification riêng.
- Mọi skill phải có phần nội dung riêng đủ lớn; không chấp nhận skill có tỷ lệ boilerplate cao hơn 35% sau khi bỏ frontmatter.
- Main skill body mục tiêu dưới 500 từ; tài liệu sâu được tách thành section/reference tải theo nhu cầu.

---

## 3.3 Mô tả skill chưa tối ưu cho discovery

Mô tả hiện tại gần như cùng một mẫu:

```text
Use when <skill name> is required during <pack> work...
```

Nó không chỉ ra triệu chứng, lỗi, bối cảnh hoặc anti-trigger cụ thể. Router hoặc model khó phân biệt các skill gần nhau.

### Yêu cầu sửa

Mỗi description phải:

- Bắt đầu bằng `Use when...` để giữ tương thích Agent Skills.
- Chỉ mô tả **khi nào cần dùng**, không tóm tắt toàn bộ workflow.
- Chứa triệu chứng và từ khóa người dùng/model thực sự tìm kiếm.
- Có `antiTriggers` trong contract để tránh route nhầm.

Ví dụ:

```yaml
description: >-
  Use when a React interface rerenders excessively, input latency increases,
  component updates are difficult to explain, or profiling shows wasted renders.
antiTriggers:
  - static HTML without client state
  - network latency with no render bottleneck
```

---

## 3.4 Mapping skill → capability đang bị ép một-một và có nhiều mismatch

`src/federation/local-provider-seed.mjs` dùng một thuật toán xếp hạng từ khóa rồi lấy capability chưa được gán. Vì `assigned` bắt buộc mỗi skill chiếm một capability khác nhau, skill có thể bị đẩy sang một operation không đúng chỉ để tránh trùng.

Các ví dụ rõ ràng trong catalog hiện tại:

| Skill | Capability đang được gán | Vấn đề |
|---|---|---|
| `designing-api-contracts` | `software-architecture.instrument-observability` | API contract không phải observability |
| `packaging-release-evidence` | `devops-sre.test-security` | Release evidence không phải security test |
| `selecting-winning-concept` | `product-management.document-system` | Concept selection không phải documentation |
| `routing-skill-graph` | `ai-agent-engineering.map-landscape` | Router kernel không phải landscape research |
| `resolving-user-intent` | `ai-agent-engineering.research-users` | Intent resolution khác user research |
| `reviewing-critical-code-line-by-line` | `backend-engineering.model-threats` | Code review không đồng nghĩa threat modeling |

### Yêu cầu sửa

- Bỏ ràng buộc unique one-to-one trong `assignSkillCapabilities`.
- Cho phép một provider phục vụ nhiều capability.
- Cho phép một capability cần nhiều technique provider theo composition graph.
- Mapping built-in phải được khai báo rõ trong manifest và review, không suy ra bằng từ khóa ở release time.
- Mỗi mapping phải có `mappingEvidence`, `fitScore`, `reviewer`, `reviewedAt`, `capabilityContractHash`.
- Release block nếu stable skill bị map sai phase/domain theo semantic mapping tests.

---

## 3.5 Hai hệ thống router đang tách rời

Hiện có ít nhất hai đường định tuyến:

1. `src/router/router.mjs` định tuyến skill theo stage, artifacts, assurance, utility và context cost.
2. `src/federation/resolver.mjs` định tuyến provider theo capability, trust, local-first và estimated token.

Điều này tạo nguy cơ split-brain:

- Project router chọn một skill.
- Federation resolver chọn provider khác hoặc capability khác.
- Utility có trong router cũ nhưng **không thực sự tham gia rank provider trong resolver**, dù tài liệu nói measured utility tham gia selection.

### Yêu cầu sửa

Hợp nhất thành một pipeline duy nhất:

```text
Intent/failed gate
  → Capability retrieval
  → Technique retrieval
  → Hard policy filter
  → Composition planner
  → Provider resolver
  → Context compiler
  → Frozen RoutePlan
```

`RoutePlan` phải là artifact có hash, chứa cả capability, techniques, provider, sections, tools, budgets, reasons, exclusions và stop conditions.

---

## 3.6 Lỗi hiệu chỉnh token: 25/33 stable bundle không materialize được

Tôi đã thử resolve và materialize toàn bộ 33 stable procedural provider cùng knowledge provider của capability tương ứng.

Kết quả:

```text
Thành công: 8/33
Thất bại vì token budget: 25/33
```

Nguyên nhân chính:

```js
contextBudget = 1200 + ordinal * 40
```

Ngân sách phụ thuộc vị trí lifecycle, không phụ thuộc kích thước thực của skill. Resolver cộng `provider.estimatedTokens`, nhưng materializer tính token từ toàn bộ object đã materialize gồm body, metadata và knowledge reference. Hai phép đo không cùng biên.

Ví dụ:

```text
routing-skill-graph
Capability budget: 1.200
Resolver estimate: 1.850
Materialized estimate: 2.060
Kết quả: bị từ chối
```

```text
using-forge-os
Capability budget: 1.520
Resolver estimate: 2.183
Materialized estimate: 2.396
Kết quả: bị từ chối
```

### Yêu cầu sửa bắt buộc

- Không tạo budget từ ordinal.
- Không dùng `ceil(bytes / 4)` làm bộ đo chính.
- Resolver và materializer phải dùng cùng một `TokenAccountingProvider`.
- Tính cả wrapper, knowledge references, tool schema, system policy và safety reserve.
- Release test phải materialize **mọi stable provider** trên mọi tokenizer được hỗ trợ.
- Không cho stable provider tồn tại nếu bundle chuẩn không vừa ngân sách.

---

## 3.7 Context policy vẫn còn nhiều metadata chưa được enforcement

Các trường sau xuất hiện trong contract nhưng chưa được cưỡng chế đầy đủ trên toàn request:

```text
maxArtifacts
maxReferenceDepth
verbosity
invalidates
```

Materializer chỉ kiểm soát provider material; nó không kiểm soát:

- codebase được đưa vào model;
- conversation history;
- artifact history;
- terminal/test logs;
- browser DOM;
- output reserve;
- memory và project summaries.

### Kết luận

v0.4 giảm token tốt ở **skill federation**, nhưng chưa giảm toàn bộ token của agent.

---

## 3.8 Materializer tải nguyên cả SKILL.md

`src/federation/materializer.mjs` đọc toàn bộ local `SKILL.md`. Không có section-level selection.

### Yêu cầu sửa

Mỗi skill phải được chia thành material có thể truy xuất riêng:

```text
manifest.json
SKILL.md                 # overview + trigger + core rule ngắn
sections/procedure.md
sections/decision-tables.md
sections/verification.md
sections/failure-modes.md
sections/examples.md
references/*
scripts/*
```

Bundle chỉ materialize section được planner yêu cầu.

---

## 3.9 Evaluation corpus quá mỏng cho 242 skill, càng không đủ cho 1.024 skill

Hiện có 24 behavioral case theo 12 product domain. Đây là coverage hữu ích ở cấp domain nhưng không thể chứng minh từng skill hoạt động.

Các giới hạn khác:

- Metric quality trong evaluator vẫn được lấy từ output/executor, sau đó chỉ kiểm tra bounds.
- Chưa có independent judge ensemble đầy đủ.
- Chưa có hidden holdout cho từng skill.
- Chưa có transfer test xuyên domain.
- Chưa có kiểm tra route precision trên 1.024 kỹ thuật sâu.
- Chưa có model matrix đủ rộng.

### Yêu cầu sửa

Skill phải được phát triển bằng Skill-TDD: baseline không có skill phải thất bại trước, sau đó candidate phải sửa đúng failure đó.

---

## 3.10 Capability generator đang tạo semantics bằng quy tắc quá đơn giản

Các biểu hiện:

- `knowledgeTopics` xoay vòng theo ordinal.
- `requiredTools` lấy tool đầu hoặc hai tool đầu theo tên operation.
- `audit-accessibility` luôn chọn `browser`, kể cả domain mà browser không phải công cụ chính.
- Mọi domain đi theo một chuỗi tuyến tính 32 bước.
- Real workflow không thể hiện branch, parallel work, optional prerequisites hoặc cross-domain dependency đủ sâu.

### Yêu cầu sửa

Generator chỉ được **validate và compile** manifest chuyên môn. Nó không được tự sáng tạo semantics bằng modulo hoặc keyword.

---

## 3.11 Production vẫn mới là single-node control plane

Các khoảng trống chính:

- PostgreSQL chưa là full lifecycle store.
- Chưa có sandbox tổng quát cho third-party executable.
- Chưa có distributed queue và scheduler production hoàn chỉnh.
- Chưa có SCIM, delegated administration, managed key rotation và transparency log.
- A2A streaming/push chưa hoàn chỉnh.
- Studio chưa là capability graph editor và operations console đầy đủ.

---

## 4. Kiến trúc đích: Skill Intelligence OS

```text
┌───────────────────────────────────────────────────────────────────────┐
│                         Host Agents / Models                          │
│ Codex · Claude · Gemini · Qwen · local models · custom A2A agents    │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ task / tool request
┌───────────────────────────────▼───────────────────────────────────────┐
│                         Intent & Policy Gate                          │
│ confirmed intent · tenant policy · risk · assurance · cost ceiling   │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────────┐
│                     Unified Skill Intelligence Router                │
│ capability retrieval · technique retrieval · graph planning         │
│ hard exclusions · utility · conflicts · tool fit · evidence fit      │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ frozen RoutePlan
┌───────────────────────────────▼───────────────────────────────────────┐
│                         Global Context Kernel                         │
│ token accounting · section loader · Semantic ABI · artifact delta    │
│ memory tiers · tool distillation · caching · omission manifest       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ minimal ContextPack
┌───────────────────────────────▼───────────────────────────────────────┐
│                     Sandbox / Brokered Execution Plane               │
│ filesystem · shell · browser · MCP · model · database · GPU          │
│ resource limits · network policy · credentials by reference          │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ outputs + raw evidence
┌───────────────────────────────▼───────────────────────────────────────┐
│                           Trust Kernel                                │
│ CAS · leases · receipts · lineage · gates · review separation        │
│ transparency log · signing · invalidation · release assurance        │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────────┐
│                    Registry, Eval Lab & Production                    │
│ signed providers · skill TDD · hidden evals · multi-node storage      │
│ observability · Studio · CLI · SDK · release evidence                 │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.1 Nguyên tắc phân lớp

- **Kernel nhỏ:** invariant và policy chung không được lặp trong từng skill.
- **Registry lớn:** có thể chứa hàng nghìn kỹ thuật nhưng metadata đủ nhỏ để discovery.
- **Context nhỏ:** mỗi model call chỉ nhận vài section cần thiết.
- **Evidence đầy đủ:** raw output lưu ngoài context, model nhận distilled view có provenance.
- **Many-to-many:** capability, technique, provider, tool và evaluator không bị ép một-một.
- **Fail closed:** thiếu trust, budget, tool, evidence hoặc mapping thì route bị block, không tự suy đoán.

---

## 5. Mục tiêu 1.024 procedural skill sâu

## 5.1 Phân bổ chính thức

Tổng procedural skill mục tiêu: **1.024**.

| Nhóm | Số lượng | Vai trò |
|---|---:|---|
| L0 Kernel core | 32 | routing, context, trust, state, approval, recovery |
| L1 Cross-domain engineering core | 64 | architecture, implementation, debugging, testing |
| L1 Trust/evaluation/context core | 64 | security, evidence, evaluation, token, provenance |
| L1 Product/creative/operations core | 32 | research, product, UX, creativity, release, incidents |
| Domain techniques | 832 | 26 kỹ thuật sâu × 32 domain |
| **Tổng** | **1.024** | 192 core + 832 domain |

Như vậy core tăng từ 146 lên **192**, domain skill tăng từ 96 lên **832**.

## 5.2 32 domain giữ nguyên nhưng technique phải riêng biệt

Mỗi domain phải có đúng 26 deep technique trong release target đầu tiên:

1. Software Architecture
2. Backend Engineering
3. Frontend Engineering
4. Mobile Development
5. Desktop Development
6. Cloud Platforms
7. DevOps and SRE
8. Cybersecurity
9. Software Testing
10. Data Engineering
11. Data Science
12. Machine Learning
13. AI Agent Engineering
14. Database Engineering
15. API and Integration
16. Automation and Robotics
17. Product Management
18. UX Research
19. UI Design
20. Graphic Design
21. Brand Design
22. Motion Design
23. Industrial Design
24. Game Development
25. Media Production
26. Technical Writing
27. Education and Learning
28. Finance and Commerce
29. Legal and Compliance
30. Hardware and Embedded
31. Scientific Research
32. Operations and Leadership

## 5.3 Ví dụ về độ sâu bắt buộc

### Frontend Engineering

Không dùng skill chung `frontend-engineering.test-performance`. Pack phải chứa các kỹ thuật riêng như:

- `profiling-main-thread-long-tasks`
- `reducing-react-render-thrashing`
- `preventing-layout-instability`
- `virtualizing-large-data-grids`
- `optimizing-browser-compositor-layers`
- `designing-container-query-layouts`
- `managing-complex-keyboard-focus`
- `testing-screen-reader-announcements`
- `debugging-hydration-mismatches`
- `hardening-content-security-policy`
- `optimizing-image-delivery`
- `designing-offline-web-state`

### Database Engineering

- `analyzing-postgresql-query-plans`
- `designing-covering-indexes`
- `detecting-lock-contention`
- `preventing-write-skew`
- `planning-zero-downtime-schema-migrations`
- `tuning-autovacuum-behavior`
- `debugging-replication-lag`
- `designing-partition-pruning`
- `testing-backup-restoration`
- `measuring-write-amplification`
- `hardening-row-level-security`
- `modeling-transaction-isolation`

### Graphic and Motion Design

- `constructing-visual-hierarchy`
- `building-modular-typography-scales`
- `managing-color-gamut-and-contrast`
- `designing-grid-and-alignment-systems`
- `preparing-print-production-files`
- `maintaining-brand-asset-consistency`
- `designing-motion-easing-curves`
- `choreographing-camera-and-parallax`
- `reducing-motion-for-accessibility`
- `building-kinetic-typography`
- `planning-render-and-codec-pipelines`
- `evaluating-composition-at-multiple-crops`

### AI Agent Engineering

- `designing-tool-selection-policies`
- `preventing-prompt-injection-propagation`
- `building-memory-consolidation`
- `compiling-minimal-agent-context`
- `routing-models-by-risk-and-cost`
- `testing-agent-state-recovery`
- `detecting-self-attestation`
- `evaluating-multi-agent-coordination`
- `designing-human-approval-boundaries`
- `recording-causal-agent-traces`
- `preventing-stale-plan-execution`
- `measuring-agent-token-efficiency`

### Robotics and Embedded

- `designing-real-time-control-loops`
- `fusing-noisy-sensor-streams`
- `testing-actuator-saturation`
- `planning-safe-motion-trajectories`
- `designing-watchdog-recovery`
- `measuring-timing-jitter`
- `hardening-firmware-update-paths`
- `simulating-hardware-faults`
- `managing-power-state-transitions`
- `validating-emergency-stop-latency`
- `testing-communication-bus-errors`
- `designing-human-override-controls`

Mỗi domain manifest phải liệt kê đủ 26 kỹ thuật có failure mode và evaluator riêng. Không được dùng tên lifecycle chung để lấp quota.

---

## 6. Phân loại skill mới

Mỗi skill phải có một `skillType` rõ ràng:

| Loại | Ý nghĩa | Ví dụ |
|---|---|---|
| `discipline` | Ép quy tắc khó bị bỏ qua dưới áp lực | TDD, fresh verification |
| `technique` | Phương pháp thao tác cụ thể | covering index, shader profiling |
| `pattern` | Mental model áp dụng nhiều nơi | invariants, bounded contexts |
| `reference` | Tài liệu tra cứu có cấu trúc | API/tool syntax |
| `tool` | Cách dùng công cụ cụ thể | Chrome DevTools, GDB |
| `evaluator` | Cách đánh giá sản phẩm hoặc kỹ thuật | accessibility audit, mutation score |
| `recipe` | Composition đã kiểm thử của nhiều skill | secure SaaS auth workflow |

Không trộn evaluator và producer trong cùng một skill nếu việc tách giúp separation of duties.

---

## 7. Skill Contract v2

Tạo schema mới:

```text
schemas/skill-contract-v2.schema.json
```

Contract đề xuất:

```yaml
schemaVersion: 2
id: reducing-react-render-thrashing
version: 1.0.0
skillType: technique
maturity: validated

identity:
  title: Reducing React Render Thrashing
  description: >-
    Use when React components rerender excessively, input latency rises,
    or profiler traces show repeated updates with unchanged visible output.
  domains: [frontend-engineering]
  subdomains: [react, performance, rendering]
  keywords: [rerender, profiler, memoization, context churn, input latency]
  antiTriggers: [network-only latency, static server-rendered pages]

relations:
  requires: [profiling-react-rendering]
  specializes: [optimizing-ui-runtime-performance]
  composedWith: [measuring-interaction-latency]
  conflictsWith: []
  alternativesTo: []
  supersedes: []

contract:
  consumes:
    - type: profiler-trace
      schema: artifact://frontend/profiler-trace/v1
  produces:
    - type: render-optimization-plan
      schema: artifact://frontend/render-optimization-plan/v1
  invariants:
    - visual output remains behaviorally equivalent
    - optimization is supported by before/after measurement
  requiredTools: [browser-profiler]
  optionalTools: [repository, test-runner]

procedure:
  entryConditions:
    - profiler trace exists
    - reproduction path is stable
  steps:
    - id: establish-baseline
      action: capture p50 and p95 interaction latency
      evidence: benchmark-receipt
    - id: classify-renders
      action: separate necessary renders from wasted renders
      evidence: render-causality-map
    - id: apply-smallest-fix
      action: change ownership, selectors, memoization, or state boundaries
      evidence: code-diff
    - id: prove-no-regression
      action: rerun behavior and latency tests
      evidence: benchmark-receipt
  fallbackPaths:
    - condition: profiler unavailable
      action: stop with missing-tool blocker
  stopConditions:
    - target latency reached with behavior preserved
    - blocker recorded

verification:
  executableChecks:
    - test command exits zero
    - p95 latency does not regress
    - render count decreases on target path
  reviewerRole: frontend-performance-reviewer
  independentReview: true
  evidenceTypes:
    - benchmark-receipt
    - behavior-test-receipt
    - profiler-trace

context:
  defaultSections: [overview, procedure, verification]
  optionalSections: [examples, deep-reference]
  maxDirectArtifacts: 5
  maxReferenceDepth: 2
  targetTokens: 900
  hardTokens: 1400
  outputReserveTokens: 900

quality:
  benchmarkIds: [frontend-render-001, frontend-render-002]
  minimumSkillDepthScore: 80
  compatibleModels: [frontier, mid-size, local-7b-plus]
  knownLimitations:
    - framework-specific scheduling behavior can change
```

### 7.1 Policy inheritance

Những quy tắc chung không nằm trong mọi skill. Contract chỉ tham chiếu:

```yaml
policyProfiles:
  - forgeos-artifact-envelope-v2
  - independent-review-v1
  - fresh-evidence-v2
  - bounded-context-v2
```

Hash của policy profile được đóng băng trong bundle.

---

## 8. Cấu trúc thư mục skill v2

```text
skills-v2/<domain>/<skill-id>/
├── manifest.json
├── SKILL.md
├── sections/
│   ├── procedure.md
│   ├── decision-tables.md
│   ├── verification.md
│   ├── failure-modes.md
│   └── examples.md
├── references/
│   └── source-index.json
├── evaluators/
│   ├── cases.json
│   ├── rubric.json
│   └── executable-checks.mjs
├── scripts/
│   └── optional-safe-tool.mjs
└── assets/
```

Quy tắc:

- `SKILL.md` dưới 500 từ, tập trung trigger và core principle.
- Section dài chỉ tải khi planner yêu cầu.
- Scripts không tự chạy khi materialize.
- Mỗi section có SHA-256 và token count theo provider/model family.
- Không có file thực thi ẩn.
- Reference có license, revision, freshness TTL và authority.

---

## 9. Nâng cấp skill lõi

## 9.1 L0 Kernel: 32 skill phải đạt mức cao nhất

Các nhóm bắt buộc:

### Routing và planning

- resolving-user-intent
- decomposing-multi-domain-work
- routing-capability-graph
- composing-technique-workflows
- resolving-skill-conflicts
- planning-parallel-agent-work
- selecting-minimum-provider-set
- explaining-route-decisions

### Context và token

- compiling-global-context
- enforcing-context-budgets
- selecting-skill-sections
- projecting-artifact-deltas
- retrieving-semantic-code-symbols
- distilling-tool-output
- consolidating-project-memory
- calibrating-token-estimates

### Trust và evidence

- issuing-trusted-execution-receipts
- validating-evidence-freshness
- managing-artifact-lineage
- invalidating-dependent-proof
- enforcing-review-separation
- binding-approvals-to-actions
- recovering-interrupted-runs
- auditing-agent-actions

### Skill intelligence

- writing-agent-skills-with-tdd
- benchmarking-skill-utility
- detecting-skill-regression
- detecting-semantic-duplication
- promoting-skill-providers
- expiring-stale-skills
- learning-from-agent-failures
- certifying-release-evidence

### Điều kiện L0

- Metadata được discovery ở mọi session nhưng body không tự preload.
- Main body mục tiêu dưới 250 từ.
- Có executable runtime enforcement cho mọi điều có thể enforce bằng code.
- Có pressure tests, route tests và recovery tests.
- Hoạt động trên tối thiểu bốn host/model family trước khi stable.

## 9.2 L1 Core: 160 skill còn lại

Chia thành:

- 32 research/product/creativity/UX methods;
- 32 architecture/data/interface methods;
- 32 implementation/debugging/refactoring methods;
- 32 testing/security/resilience methods;
- 32 operations/release/evaluation methods.

Mỗi core skill phải có transfer tests ở ít nhất ba domain khác nhau để chứng minh thực sự cross-domain.

---

## 10. Capability Graph v2

## 10.1 Tách bốn lớp

```text
Outcome Capability
  ↓ satisfied-by
Technique
  ↓ delivered-by
Provider
  ↓ verified-by
Evaluator
```

Ví dụ:

```text
Outcome: frontend.interaction-latency-within-budget
  satisfiedBy:
    - profiling-main-thread-long-tasks
    - reducing-react-render-thrashing
    - optimizing-browser-compositor-layers
  deliveredBy:
    - local skill provider
    - approved external skill provider
  verifiedBy:
    - interaction-latency-evaluator
    - behavior-regression-evaluator
```

## 10.2 Quan hệ graph bắt buộc

```text
requires
optionalRequires
satisfies
specializes
composedWith
conflictsWith
alternativeTo
supersedes
produces
consumes
validatedBy
invalidates
```

## 10.3 Không còn chuỗi tuyến tính cứng

Graph phải hỗ trợ:

- branch;
- join;
- parallel skill runs;
- optional nodes;
- cross-domain dependencies;
- retry path;
- rollback path;
- incident/recovery loop;
- partial completion;
- risk-driven insertion.

## 10.4 File kiến trúc mới

```text
capabilities-v2/domains/<domain>/outcomes.json
capabilities-v2/domains/<domain>/techniques.json
capabilities-v2/relations.json
capabilities-v2/artifact-types.json
capabilities-v2/evaluator-bindings.json
```

`scripts/generate-capability-catalog.mjs` phải đổi vai trò thành compiler/validator. Nó không được tự chọn topics, tools hoặc semantics bằng ordinal.

---

## 11. Unified Skill Intelligence Router

Tạo module mới:

```text
src/intelligence/router.mjs
src/intelligence/retrieval.mjs
src/intelligence/reranker.mjs
src/intelligence/composer.mjs
src/intelligence/route-plan.mjs
```

## 11.1 Pipeline

1. Parse intent, domain, risk, current gate và missing artifacts.
2. Hard-filter theo status, tenant, assurance, tools, license, freshness và blockers.
3. Retrieve candidate capability bằng lexical, aliases, multilingual query expansion và graph neighborhood.
4. Retrieve technique bằng trigger/anti-trigger, inputs, outputs, failure symptoms và utility.
5. Rerank bằng measured utility, evidence fit, context cost, compatibility và conflict cost.
6. Compose DAG nhỏ nhất tạo đủ output/evidence.
7. Chọn provider cho từng technique.
8. Compile sections và ContextPack.
9. Đóng băng `RoutePlan` bằng hash.

## 11.2 Công thức rank đề xuất

```text
score =
  0.22 × triggerFit
+ 0.16 × artifactNeedFit
+ 0.12 × domainFit
+ 0.10 × toolFit
+ 0.10 × evidenceFit
+ 0.10 × measuredUtility
+ 0.08 × modelCompatibility
+ 0.07 × freshness
+ 0.05 × trust
- conflictPenalty
- tokenPenalty
- uncertaintyPenalty
```

Hard blocker luôn thắng score.

## 11.3 Measured utility phải thật sự tham gia resolver

Provider record cần:

```yaml
utility:
  evalRunIds: []
  passRateByModel: {}
  qualityDeltaByTaskClass: {}
  tokenDeltaByModel: {}
  failureClusters: []
  confidence: {}
```

Không dùng một score trung bình duy nhất cho mọi context. Utility phải phân đoạn theo:

- model family;
- domain;
- task class;
- assurance level;
- tool availability;
- language;
- project scale.

## 11.4 Router benchmark

- Precision@1 ≥ 0,85.
- Precision@3 ≥ 0,93.
- Recall@6 ≥ 0,97.
- Unsafe/quarantined activation = 0.
- Route determinism với input/hash giống nhau = 100%.
- Cross-domain task composition success ≥ 90% trên holdout.
- Median selected skill sections ≤ 6.

---

## 12. Global Context Kernel: giảm toàn bộ token của agent

Đây là phần bắt buộc để sửa giới hạn lớn nhất của v0.4.

Tạo package:

```text
src/context/
├── context-compiler.mjs
├── token-accounting.mjs
├── budget-policy.mjs
├── skill-section-loader.mjs
├── semantic-abi.mjs
├── artifact-projector.mjs
├── memory-manager.mjs
├── tool-output-distiller.mjs
├── prompt-cache-plan.mjs
├── omission-manifest.mjs
└── context-receipt.mjs
```

## 12.1 Một ngân sách toàn cục

```yaml
modelContextLimit: 128000
hardInputLimit: 96000
outputReserve: 16000
safetyReserve: 8000
budgets:
  system: 5000
  task: 3000
  skills: 8000
  code: 42000
  artifacts: 18000
  memory: 8000
  toolOutput: 8000
  references: 4000
```

Context Compiler phải từ chối request nếu tổng context vượt hard limit sau mọi chiến lược nén.

## 12.2 Token Accounting Provider

Interface:

```ts
interface TokenAccountingProvider {
  id: string;
  modelPattern: string;
  countText(text: string): Promise<number>;
  countMessages(messages: Message[]): Promise<number>;
  countToolSchemas(tools: ToolSchema[]): Promise<number>;
  safetyMargin(observedError?: number): number;
}
```

Các implementation:

```text
OpenAITokenAccounting
AnthropicTokenAccounting
GeminiTokenAccounting
HuggingFaceTokenAccounting
ConservativeByteFallback
```

`bytes/4` chỉ là fallback và phải dùng safety margin cao.

Sau mỗi model call, lưu:

```text
estimated tokens
actual provider-reported tokens
absolute error
relative error
model/version
content class
```

Dùng EWMA hoặc calibration table để điều chỉnh estimator.

## 12.3 Sửa trực tiếp lỗi budget 25/33

Thay:

```js
contextBudget: 1200 + ordinal * 40
```

bằng:

```text
hardBudget = min(
  capabilityPolicy.maxTokens,
  modelRemainingContext,
  tenantCostPolicy,
  routeBudget
)

targetBudget = hardBudget - outputReserve - safetyMargin
```

Provider section budget được lấy từ token count đã build:

```json
{
  "overview": 140,
  "procedure": 420,
  "verification": 230,
  "failureModes": 160,
  "examples": 480,
  "references": 120
}
```

Release gate:

```text
100% stable providers materialize được
100% certified recipes materialize được
resolver estimate sai không quá 8% ở p95
không bundle nào vượt hard context tại runtime
```

## 12.4 Skill section retrieval

Planner yêu cầu section theo operation:

```text
Planning task → trigger + procedure + decision tables
Verification task → verification + failure modes
Novel unfamiliar task → examples + references
Routine known task → core procedure only
```

Không tải toàn bộ body nếu không cần.

## 12.5 Semantic ABI cho codebase

Index code thành symbol graph:

```text
M12 AuthService
F3 login(User)->Token @hash
F4 refresh(Token)->Token @hash
C7 AuthError
T2 auth.test
```

Model nhận map ngắn. Khi cần:

```text
FETCH_SYMBOL F3 expectedHash=abc123
```

Context trả body, direct dependencies, tests và call sites cần thiết.

Yêu cầu:

- stable symbol IDs;
- content hash;
- call/import/test/build graph;
- language adapters;
- incremental reindex;
- patch impact analysis;
- stale symbol rejection;
- permission-aware retrieval.

## 12.6 Artifact projection và delta

Thay vì gửi toàn bộ lịch sử:

```text
Current projection:
PD7@h3
ARCH4@h2
PLAN9@h5

Changes since checkpoint cp_42:
- PD7 pricing: free → freemium
- ARCH4 database: PostgreSQL selected
- PLAN9 sections 4 and 7 invalidated
```

Full artifact chỉ tải qua explicit fetch.

## 12.7 Memory phân tầng

```text
L0 Active memory      – lượt hiện tại
L1 Task memory        – quyết định và blocker của task
L2 Project memory     – ADR, conventions, stable summaries
L3 Archive            – transcript/raw artifacts đầy đủ
```

Mỗi summary có source IDs, hash, freshness và invalidation rules. Không dùng conversation memory làm source of truth.

## 12.8 Tool-output distillation

Raw output được lưu content-addressed. Model chỉ nhận:

```text
command
exit code
duration
summary
failures
relevant ranges
raw evidence ID/hash
truncation/omission notes
```

Test log 20.000 dòng không được đưa nguyên vào context nếu 50 dòng đủ để chẩn đoán.

## 12.9 Prompt cache plan

Prefix ổn định:

- kernel policy;
- schema contracts;
- tool contracts;
- stable project conventions.

Dynamic tail:

- task;
- deltas;
- selected skill sections;
- current evidence.

Caching giảm chi phí/latency nhưng không thay thế context selection.

## 12.10 Mục tiêu token

| Chỉ số | Mục tiêu |
|---|---:|
| Skill materialization median | ≤ 1.200 token |
| L0 skill body | ≤ 250 từ |
| Selected skill sections | ≤ 6 median |
| Total workflow input token reduction | 70–90% trên repo vừa/lớn |
| Code orientation reduction | ≥ 90% trên monorepo benchmark |
| Tool log reduction | ≥ 95% khi raw log >10.000 dòng |
| Estimator p95 error | ≤ 8% |
| Budget overflow sau compile | 0 |
| Information omitted without manifest | 0 |

---

## 13. Skill Quality System

## 13.1 Skill-TDD là bắt buộc

Không tạo hoặc sửa skill trước khi có baseline failure.

```text
RED
Run task without candidate skill
Record exact failure and rationalization

GREEN
Write minimal skill that addresses observed failure
Run same matrix

REFACTOR
Find new loopholes, ambiguity and regressions
Update skill and rerun
```

## 13.2 Test matrix cho từng loại skill

### Discipline skill

- pressure: thời gian;
- pressure: sunk cost;
- pressure: authority;
- pressure: context exhaustion;
- combined pressure;
- rationalization capture.

### Technique skill

- normal application;
- boundary variation;
- missing information;
- tool unavailable;
- conflicting constraints;
- transfer to unseen project.

### Pattern skill

- recognition;
- correct application;
- counter-example;
- over-application prevention.

### Reference/tool skill

- retrieval accuracy;
- correct API application;
- version mismatch;
- common gap test.

### Evaluator skill

- known positive;
- known negative;
- adversarial near-miss;
- false positive/negative rate;
- inter-rater agreement.

## 13.3 Không dùng self-reported quality làm nguồn quyết định

Thay đổi `src/evals/evaluator.mjs`:

- Executor chỉ trả raw output và usage receipt.
- Executable checks tạo metric khách quan.
- Judge độc lập chấm phần semantic.
- Model tạo output không được làm judge chính.
- Judge output phải có rubric item, rationale ngắn, uncertainty và evidence span.
- Promotion sử dụng metric từ trusted evaluator store.

## 13.4 Judge ensemble

Thứ tự ưu tiên:

1. Executable deterministic checks.
2. Domain-specific static analyzers.
3. Human review cho critical skills.
4. Independent model judge ensemble.

Không để model judge ghi đè executable failure.

## 13.5 Hidden holdout

- Public cases giúp contributor phát triển.
- Hidden cases ngăn overfitting.
- Holdout được version và hash.
- Release chỉ lưu aggregated evidence, không lộ toàn bộ hidden prompt.

## 13.6 Maturity model

| Trạng thái | Điều kiện |
|---|---|
| `experimental` | schema/static checks đạt |
| `candidate` | có RED baseline và GREEN improvement |
| `validated` | nhiều case, nhiều seed, ít nhất 2 model family |
| `stable` | holdout đạt, CI lower bound dương, không critical regression, materialize được |
| `certified` | independent maintainer review + production evidence + expiry policy |
| `deprecated` | có replacement hoặc không còn an toàn/chính xác |
| `quarantined` | blocker, regression, stale source hoặc trust failure |

## 13.7 Skill Depth Score

```text
15% trigger precision
15% method specificity
10% decision-rule completeness
10% failure-mode coverage
10% executable verification
10% artifact typing
10% transfer performance
10% robustness under pressure
5% token efficiency
5% freshness/interoperability
```

Điều kiện:

- Candidate ≥ 60.
- Validated ≥ 72.
- Stable ≥ 82.
- Certified ≥ 90.
- Critical failure luôn block bất kể tổng điểm.

## 13.8 Coverage mục tiêu

- Mỗi skill candidate: tối thiểu 6 public scenarios × 3 seeds.
- Mỗi stable skill: tối thiểu 20 scenarios, gồm holdout và transfer.
- L0 kernel: tối thiểu 50 scenarios/skill.
- Mỗi domain: ít nhất 100 cross-skill composition scenarios.
- Toàn release: tối thiểu 10.000 paired runs trước khi tuyên bố 1.024 skill production-grade.

---

## 14. Trust Kernel v2

## 14.1 Enforce context metadata

Runtime phải cưỡng chế:

- `maxDirectArtifacts`;
- `maxReferenceDepth`;
- section allowlist;
- token budget;
- output reserve;
- invalidation targets;
- verbosity profile nếu host hỗ trợ.

## 14.2 Skill-run lease đầy đủ

Skill run cần:

```text
lease owner
lease token
fencing sequence
heartbeat
expiresAt
retry budget
cancellation
resource locks
output target locks
```

Worker cũ không thể complete sau khi lease bị reclaim.

## 14.3 Signed skill manifest

Mỗi stable/certified provider có:

- manifest digest;
- content Merkle root;
- source revision;
- SBOM nếu có script;
- signature;
- evaluator receipt IDs;
- policy profile hashes;
- compatibility matrix;
- expiry.

## 14.4 Transparency log

Audit chain local chưa đủ khi operator có thể viết lại toàn bộ storage. Thêm append-only transparency log với periodic signed checkpoint được lưu ngoài primary database.

## 14.5 Evaluator separation

- Producer trust domain khác evaluator trust domain.
- Evaluator không được sửa provider content.
- Human promoter không được là author duy nhất của skill critical.
- Release signer không được tự bỏ qua eval blocker.

## 14.6 Provenance sâu cho mapping

Capability-provider mapping là artifact phải được ký và review, không phải generated side effect.

## 14.7 Freshness

Mỗi provider và knowledge source có:

```text
observedAt
validUntil
recheckPolicy
sourceRevision
compatibilityWindow
lastSuccessfulEval
```

Hết hạn thì resolver loại khỏi stable route cho đến khi revalidate.

---

## 15. Registry v2

Tạo registry có package metadata:

```text
provider identity
publisher identity
semantic version
immutable digest
dependencies
conflicts
capability mappings
model/tool compatibility
license
security scans
evaluation receipts
maturity
freshness
install count as discovery signal only
```

## 15.1 SemVer và dependency

- Breaking contract change → major.
- New optional section → minor.
- Wording/fix không đổi behavior → patch.
- Dependency range phải được resolve và lock trong RoutePlan.

## 15.2 Không dùng stars làm trust

Stars chỉ được dùng làm discovery signal tối đa rất thấp. Trust đến từ:

- immutable provenance;
- signature;
- scan;
- evaluation;
- maintainer identity;
- production history;
- current freshness.

## 15.3 Deduplication

Dùng nhiều tầng:

1. Exact hash.
2. Normalized structural signature.
3. Trigger/output overlap.
4. Procedure mechanism similarity.
5. Benchmark overlap.
6. Human merge review.

Không tự merge chỉ vì embedding similarity cao.

## 15.4 Registry UX

Người dùng xem được:

- skill giải quyết gì;
- khi nào dùng/không dùng;
- token cost;
- model compatibility;
- benchmark delta;
- failure history;
- trust state;
- dependencies;
- alternatives.

---

## 16. Production hoàn chỉnh

## 16.1 Full PostgreSQL lifecycle

Tạo implementation đầy đủ cho:

- projects;
- artifacts;
- evidence;
- findings;
- approvals;
- snapshots;
- provider registry;
- eval runs;
- A2A tasks;
- skill runs;
- audit/outbox;
- context receipts;
- semantic ABI index metadata.

PostgreSQL backend phải chạy cùng contract suite với SQLite.

## 16.2 Multi-node

- Distributed leases/fencing.
- Idempotency keys.
- Transactional outbox.
- Queue consumer ownership.
- Leader-independent task execution.
- Horizontal HTTP/MCP/A2A sessions hoặc external session store.
- No sticky-session requirement trừ khi được công bố rõ.

## 16.3 Sandbox

Execution profile:

```text
container hoặc microVM
read-only base filesystem
ephemeral writable workspace
CPU/RAM/time quota
network deny-by-default
allowlisted destinations
secret references
syscall policy
artifact export allowlist
full command receipt
```

Imported scripts không chạy ngoài sandbox.

## 16.4 Secret management

- Secret values không vào model context.
- Integration với secret manager qua reference resolver.
- Per-run scoped credentials.
- Rotation và revocation.
- Secret access receipt không chứa value.

## 16.5 Observability

Metrics bắt buộc:

- route latency;
- materialization latency;
- token estimate error;
- context compression ratio;
- provider selection distribution;
- skill success/regression;
- stale evidence rejection;
- sandbox failures;
- queue lag;
- database contention;
- tenant policy denials.

Trace phải liên kết:

```text
request → routePlan → contextPack → skillRun → toolRun → evidence → gate
```

## 16.6 Reliability

- Backup restore drill tự động.
- Point-in-time recovery.
- Disaster recovery runbook.
- Graceful drain.
- Load shedding.
- Rate limiting theo tenant/principal/tool.
- Circuit breaker cho external provider, model, PDP và registry.
- Chaos tests cho worker crash, database failover và network partition.

## 16.7 Protocol

- A2A streaming/push.
- MCP session scaling.
- Resume token cho long-running task.
- Backpressure.
- Cancellation propagation.
- Protocol conformance matrix theo host.

---

## 17. Dễ sử dụng

Một hệ thống mạnh nhưng khó cài sẽ không thể cạnh tranh với dự án phổ biến.

## 17.1 CLI mục tiêu

```bash
npx forgeos init
forge doctor
forge connect codex
forge connect claude
forge run "Build a secure local-first app"
forge explain-route <run-id>
forge skills search "react rerender"
forge skills inspect <skill-id>
forge eval <skill-id>
forge release verify
```

## 17.2 Quick start dưới 5 phút

`forge init` phải:

- phát hiện Node/version;
- chọn SQLite local mặc định;
- tạo secret an toàn;
- cài adapter host;
- chạy doctor;
- mở Studio;
- tạo project demo nhỏ;
- không yêu cầu OIDC/PostgreSQL cho local trial.

## 17.3 Progressive complexity

Ba profile:

```text
Local          – one user, SQLite, safe defaults
Team           – PostgreSQL, OIDC, shared registry
Enterprise     – HA, external PDP, SCIM, sandbox pool, signed registry
```

## 17.4 Studio v3

Cần có:

- capability graph editor;
- skill/provider search;
- route explanation;
- context budget visualization;
- artifact lineage graph;
- evidence freshness;
- finding lifecycle;
- provider quarantine/promotion;
- eval comparison;
- token reduction report;
- project switching không embed toàn bộ project;
- keyboard/accessibility hoàn chỉnh.

## 17.5 Error messages

Không trả lỗi kiểu `bundle unresolved`. Trả:

```text
Không thể chạy vì procedural provider đang candidate.
Cần: evaluation receipt + federation-admin approval.
Provider: reducing-react-render-thrashing@1.0.0
Capability: frontend.interaction-latency-within-budget
```

## 17.6 Adapter thật

Mỗi adapter công bố executable phải có TCK chạy thật. Documentation-only adapter không được tính cùng nhóm với executable integration.

## 17.7 Mục tiêu UX

- Clean install success ≥ 95% trên CI matrix.
- Median time-to-first-successful-workflow ≤ 10 phút.
- `forge doctor` xác định đúng nguyên nhân ≥ 90% failure fixtures.
- Không cần hiểu artifact envelope để chạy workflow đầu tiên.
- Route explanation đọc được trong dưới 60 giây.

---

## 18. File-level migration plan

## Task 1 — Freeze baseline và tạo regression fixtures

**Create:**

```text
tests/fixtures/v0.4-release/
tests/regression/v04-baseline.test.mjs
docs/audits/V0.4-SKILL-BASELINE.md
```

**Actions:**

- Lưu derived counts, stable provider list và release hashes.
- Thêm regression test cho 8/33 materialization success hiện tại để chứng minh lỗi trước khi sửa.
- Thêm fixture cho các mapping sai đã nêu.

**Pass condition:** Test mới phải thất bại trước implementation mới.

## Task 2 — Skill Contract v2 và policy profiles

**Create:**

```text
schemas/skill-contract-v2.schema.json
schemas/skill-section.schema.json
schemas/policy-profile.schema.json
src/skills/v2/contracts.mjs
src/skills/v2/policy-profiles.mjs
config/policy-profiles/*.json
```

**Modify:**

```text
src/core/runtime-schemas.mjs
src/skills/catalog.mjs
scripts/validate-skills.mjs
```

**Tests:**

```text
tests/skill-contract-v2.test.mjs
tests/policy-profile-inheritance.test.mjs
tests/skill-section-schema.test.mjs
```

**Pass condition:** Contract v2 reject trigger mơ hồ, missing anti-trigger, missing evaluator binding và token budget không hợp lệ.

## Task 3 — Chuyển skill sang section-based packaging

**Create:**

```text
src/skills/v2/section-index.mjs
src/skills/v2/section-loader.mjs
scripts/migrate-skills-v2.mjs
```

**Modify:**

```text
src/federation/materializer.mjs
src/federation/contracts.mjs
```

**Tests:**

```text
tests/skill-section-materialization.test.mjs
tests/skill-section-path-security.test.mjs
tests/skill-section-token-budget.test.mjs
```

**Pass condition:** Materializer tải được procedure mà không tải examples/references; section digest mismatch bị chặn.

## Task 4 — Token Accounting Provider và budget engine

**Create:**

```text
src/context/token-accounting.mjs
src/context/token-providers/openai.mjs
src/context/token-providers/anthropic.mjs
src/context/token-providers/gemini.mjs
src/context/token-providers/huggingface.mjs
src/context/token-providers/fallback.mjs
src/context/budget-policy.mjs
```

**Modify:**

```text
src/federation/resolver.mjs
src/federation/materializer.mjs
scripts/generate-capability-catalog.mjs
```

**Tests:**

```text
tests/token-accounting.test.mjs
tests/token-calibration.test.mjs
tests/all-stable-providers-materialize.test.mjs
```

**Pass condition:** 33/33 existing stable provider materialize được sau migration; p95 estimator error đạt mục tiêu trên corpus.

## Task 5 — Capability Graph v2 và mapping nhiều-nhiều

**Create:**

```text
capabilities-v2/domains/*/outcomes.json
capabilities-v2/domains/*/techniques.json
capabilities-v2/relations.json
capabilities-v2/evaluator-bindings.json
src/capabilities/v2/compiler.mjs
src/capabilities/v2/graph.mjs
```

**Modify:**

```text
src/federation/local-provider-seed.mjs
scripts/generate-capability-catalog.mjs
```

**Remove after migration:**

- Greedy `assigned` one-to-one allocation.
- Semantics generated from ordinal/topic rotation.

**Tests:**

```text
tests/capability-v2-domain-specificity.test.mjs
tests/provider-many-to-many.test.mjs
tests/capability-mapping-evidence.test.mjs
tests/cross-domain-graph-paths.test.mjs
```

**Pass condition:** Không còn mapping sai trong stable set; one skill có thể phục vụ nhiều outcomes và one outcome có thể compose nhiều techniques.

## Task 6 — Unified router

**Create:**

```text
src/intelligence/router.mjs
src/intelligence/retrieval.mjs
src/intelligence/reranker.mjs
src/intelligence/composer.mjs
src/intelligence/route-plan.mjs
```

**Deprecate:**

```text
src/router/router.mjs
src/router/planner.mjs
```

Chỉ xóa sau khi compatibility tests đạt.

**Tests:**

```text
tests/router-precision-corpus.test.mjs
tests/router-anti-trigger.test.mjs
tests/router-utility-segmentation.test.mjs
tests/router-cross-domain-composition.test.mjs
tests/router-determinism.test.mjs
```

**Pass condition:** Đạt router metrics ở phần Definition of Done.

## Task 7 — Global Context Compiler

**Create toàn bộ `src/context/`** như kiến trúc phần 12.

**Integrate với:**

```text
src/server/mcp.mjs
src/server/a2a.mjs
src/core/orchestrator.mjs
src/intelligence/route-plan.mjs
```

**Tests:**

```text
tests/context-global-budget.test.mjs
tests/context-artifact-depth.test.mjs
tests/context-omission-manifest.test.mjs
tests/context-stale-summary.test.mjs
tests/context-provider-tokenizers.test.mjs
```

**Pass condition:** ForgeOS có thể chứng minh tổng model request nằm trong budget, không chỉ provider material.

## Task 8 — Semantic ABI, artifact delta và memory tiers

**Create:**

```text
src/context/semantic-abi.mjs
src/context/language-adapters/*
src/context/artifact-projector.mjs
src/context/memory-manager.mjs
src/context/checkpoints.mjs
```

**Tests:**

```text
tests/semantic-abi-stable-ids.test.mjs
tests/semantic-abi-stale-hash.test.mjs
tests/artifact-delta-invalidation.test.mjs
tests/memory-tier-freshness.test.mjs
```

**Pass condition:** Code/artifact full body chỉ tải theo explicit request; stale hash bị từ chối.

## Task 9 — Tool-output distillation và evidence storage

**Create:**

```text
src/context/tool-output-distiller.mjs
src/context/distillers/test-output.mjs
src/context/distillers/compiler-output.mjs
src/context/distillers/browser-output.mjs
src/context/distillers/database-plan.mjs
```

**Tests:**

```text
tests/tool-distillation-losslessness.test.mjs
tests/tool-distillation-provenance.test.mjs
tests/tool-distillation-token-reduction.test.mjs
```

**Pass condition:** Summary giữ đủ failure evidence, raw artifact retrievable, token giảm theo mục tiêu.

## Task 10 — Skill Eval Lab v2

**Create:**

```text
src/evals/skill-lab-v2.mjs
src/evals/judges/*
src/evals/metrics/*
evals-v2/public/*
evals-v2/holdout-manifest.json
```

**Modify:**

```text
src/evals/evaluator.mjs
src/evals/trusted-runner.mjs
src/evals/eval-run-store.mjs
```

**Tests:**

```text
tests/eval-no-self-reported-quality.test.mjs
tests/eval-independent-judge.test.mjs
tests/eval-hidden-holdout.test.mjs
tests/eval-confidence-promotion.test.mjs
```

**Pass condition:** Caller/model output không thể tự đặt quality/pass metric quyết định promotion.

## Task 11 — Viết và kiểm thử 1.024 skill

**Process bắt buộc cho từng skill:**

1. Tạo baseline scenarios.
2. Chạy không có skill.
3. Lưu failure/rationalization.
4. Viết minimal skill.
5. Chạy candidate.
6. Refactor.
7. Tạo evaluator binding.
8. Validate token/materialization.
9. Human review nếu high/critical risk.
10. Promote theo maturity evidence.

**Automation:**

```text
scripts/scaffold-skill-v2.mjs
scripts/run-skill-red-green.mjs
scripts/audit-skill-depth.mjs
scripts/audit-skill-duplication.mjs
scripts/audit-skill-coverage.mjs
```

**Cấm:** Sinh 1.024 body từ một template rồi gọi là hoàn thành.

## Task 12 — Trust, registry và signed supply chain

**Create/modify:**

```text
src/registry/*
src/trust/transparency-log.mjs
src/trust/skill-signing.mjs
src/trust/mapping-attestation.mjs
schemas/provider-manifest-v2.schema.json
```

**Tests:** signature, expiry, rollback, transparency checkpoint, provider substitution, mapping tampering.

## Task 13 — Production multi-node và sandbox

**Create/complete:**

```text
src/storage/postgres-project-store.mjs
src/storage/postgres-federation-store.mjs
src/storage/postgres-eval-store.mjs
src/storage/postgres-task-store.mjs
src/execution/sandbox/*
src/queue/*
```

**Tests:** full contract suite, failover, stale worker, network deny, secret isolation, backup restore.

## Task 14 — CLI và Studio v3

**Create:**

```text
src/cli/*
src/ui/studio-v3/*
```

**Tests:** clean install matrix, accessibility, route explanation, project isolation, large catalog performance.

## Task 15 — Benchmark và release proof

**Create:**

```text
benchmarks/router/*
benchmarks/context/*
benchmarks/skill-quality/*
benchmarks/production/*
docs/BENCHMARK-METHODOLOGY.md
docs/CLAIMS-BOUNDARY-V0.5.md
```

Release verifier phải chạy:

```bash
npm run validate
npm run skills:depth-audit
npm run skills:coverage-audit
npm run skills:materialize-all-stable
npm run router:benchmark
npm run context:benchmark
npm run eval:holdout
npm run federation:eval
npm run federation:audit
npm run production:contract-suite
npm run release:verify
```

---

## 19. Definition of Done

Không phát hành với tuyên bố “1.024 kỹ thuật sâu” nếu thiếu bất kỳ điều kiện bắt buộc nào sau đây.

### 19.1 Skill coverage

- [ ] 1.024 procedural skill contract v2 tồn tại.
- [ ] 192 core skill và 832 domain skill.
- [ ] 32 domain có đúng 26 domain-specific skill.
- [ ] 1.024/1.024 có baseline RED evidence.
- [ ] 1.024/1.024 có evaluator binding.
- [ ] 1.024/1.024 có trigger và anti-trigger.
- [ ] Không skill nào vượt boilerplate ratio 35%.
- [ ] Không knowledge-only provider bị tính là procedural skill.
- [ ] Ít nhất 256 skill stable.
- [ ] Ít nhất 64 skill certified, gồm toàn bộ L0 critical kernel cần thiết.

### 19.2 Routing

- [ ] Precision@1 ≥ 0,85.
- [ ] Precision@3 ≥ 0,93.
- [ ] Recall@6 ≥ 0,97.
- [ ] Quarantined/unsafe activation = 0.
- [ ] Stable mapping semantic mismatch = 0 trong curated audit set.
- [ ] RoutePlan deterministic với cùng semantic revision/hash.
- [ ] Measured utility thực sự ảnh hưởng selection và được test.

### 19.3 Token/context

- [ ] 100% stable provider materialize được.
- [ ] 100% certified recipe materialize được.
- [ ] Resolver và materializer dùng cùng token accounting.
- [ ] p95 estimation error ≤ 8%.
- [ ] Global request budget được enforce.
- [ ] `maxDirectArtifacts` và `maxReferenceDepth` được enforce.
- [ ] Section-level skill loading hoạt động.
- [ ] Semantic ABI hoạt động trên ít nhất TypeScript, Python, Rust và Go.
- [ ] Artifact delta và memory freshness có regression tests.
- [ ] Tổng token giảm 70–90% trên benchmark repo vừa/lớn.

### 19.4 Evaluation

- [ ] Không metric promotion quan trọng nào do producer/model tự khai.
- [ ] Executable failure không thể bị aggregate score che.
- [ ] Hidden holdout tồn tại.
- [ ] Multi-model paired evaluation tồn tại.
- [ ] Confidence interval điều khiển promotion.
- [ ] Critical skill có independent human/domain review.
- [ ] Tối thiểu 10.000 paired runs cho release claim lớn.

### 19.5 Trust

- [ ] Skill-run lease/heartbeat/fencing đầy đủ.
- [ ] Mapping attestation có hash/signature.
- [ ] Stable/certified provider có signed manifest.
- [ ] Transparency checkpoint được lưu ngoài primary store.
- [ ] Stale source/provider/evidence bị loại tự động.
- [ ] Producer, evaluator, approver và release signer có separation phù hợp risk.

### 19.6 Production

- [ ] PostgreSQL pass toàn bộ lifecycle contract suite.
- [ ] Multi-node concurrency/failover tests đạt.
- [ ] Sandbox deny-by-default đạt adversarial corpus.
- [ ] Secret values không xuất hiện trong context/log/evidence.
- [ ] Backup restore drill đạt.
- [ ] A2A streaming/cancellation/backpressure đạt TCK.
- [ ] SLO và production runbook được kiểm thử.

### 19.7 Ease of use

- [ ] `npx forgeos init` tạo local system hoạt động.
- [ ] Clean install success ≥ 95%.
- [ ] Time-to-first-successful-workflow ≤ 10 phút median.
- [ ] `forge doctor` có actionable diagnosis.
- [ ] Studio hiển thị route, context, lineage và evidence.
- [ ] Adapter executable được chạy trong TCK thật.

### 19.8 Claims gate

Chỉ được dùng thông điệp “mạnh hơn các hệ thống 100.000 sao trên các trục đã benchmark” khi:

- benchmark methodology công khai;
- baseline version được pin;
- case/seed matrix giống nhau;
- hardware/model/cost được công bố;
- raw or reproducible evidence được phát hành;
- không chọn riêng nhiệm vụ có lợi cho ForgeOS;
- residual risks được ghi rõ.

---

## 20. Các anti-pattern tuyệt đối tránh

1. Tạo thêm 1.000 tên skill nhưng procedure vẫn là template chung.
2. Dùng lifecycle matrix để giả làm chuyên môn domain.
3. Ép mỗi skill vào một capability chưa dùng để tăng coverage.
4. Tính token bằng ordinal.
5. Tải nguyên cả skill vì section parser chưa có.
6. Chỉ giảm token skill nhưng quảng cáo giảm toàn bộ agent token.
7. Dùng stars hoặc publisher name làm trust proof.
8. Cho producer tự chấm quality.
9. Dùng một model judge duy nhất cho critical promotion.
10. Dùng aggregate score để che critical failure.
11. Thêm skill trước khi có failing baseline.
12. Tăng catalog trước khi router benchmark đạt.
13. Công bố HA khi PostgreSQL chưa pass full lifecycle suite.
14. Cho imported script chạy ngoài sandbox.
15. Làm người dùng phải hiểu toàn bộ trust kernel trước khi chạy demo đầu tiên.

---

## 21. Thứ tự ưu tiên thực tế

Nếu nguồn lực có giới hạn, triển khai theo thứ tự sau để tạo lợi ích lớn nhất:

1. Sửa token accounting và 25/33 materialization failure.
2. Hợp nhất router và bỏ mapping one-to-one sai.
3. Contract v2 + policy inheritance + section loading.
4. Global Context Compiler.
5. Rewrite 32 L0 kernel skill bằng Skill-TDD.
6. Eval Lab v2, không self-reported quality.
7. Capability Graph v2.
8. Mở rộng 192 core skill.
9. Xây 832 domain skill theo 32 pack.
10. Semantic ABI, artifact delta, memory và tool distillation.
11. Full PostgreSQL + sandbox + multi-node.
12. CLI/Studio và public benchmark.

Không nên chờ viết xong 1.024 skill mới sửa router/context. Nếu nền tảng routing sai, càng thêm skill càng làm lỗi lớn hơn.

---

## 22. Kết luận

ForgeOS v0.4 đã có một nền móng trust/federation đáng giá, nhưng sức mạnh skill hiện tại chưa tương xứng với kiến trúc. Bước tiến tiếp theo phải chuyển trọng tâm từ **“xây thêm hạ tầng quanh skill”** sang **“biến từng skill thành kỹ thuật đã được chứng minh, có evaluator, có mapping chính xác và có context footprint nhỏ”**.

Công thức nâng cấp đúng là:

```text
1.024 capability outcome chuyên biệt
+ 1.024 procedural skill sâu
+ many-to-many technique composition
+ unified evidence-aware router
+ Global Context Kernel
+ Skill-TDD và hidden evaluation
+ signed registry và Trust Kernel v2
+ sandbox và multi-node production
+ one-command UX
= Skill Intelligence OS
```

Nếu hoàn thành đầy đủ Definition of Done trong tài liệu này, ForgeOS sẽ không chỉ là một kho skill lớn. Nó sẽ trở thành một hệ thống có khả năng **tìm, kết hợp, thực thi, kiểm chứng, nén context và tiến hóa kỹ thuật** ở quy mô mà các bộ skill đơn giản không cung cấp. Khi đó, mục tiêu vượt các dự án cực lớn có thể được đặt ra một cách nghiêm túc—không dựa trên số lượng file hay lời quảng cáo, mà dựa trên benchmark, trust invariant và giá trị thực tế.

---

## 23. Nguồn tham chiếu kiến trúc bên ngoài

Tài liệu này đối chiếu các nguyên tắc từ những nguồn chính thức sau, được quan sát tại thời điểm rà soát:

- Agent Skills specification: portable skill folders và progressive disclosure.
- Superpowers: skill authoring bằng RED–GREEN–REFACTOR, pressure testing và workflow kỷ luật.
- LangGraph/LangChain: stateful orchestration, checkpointing, long-running agents và ecosystem integration.
- Microsoft AutoGen/Agent Framework: multi-agent orchestration, distributed/runtime concerns và production migration.

Các nguồn này là baseline học hỏi, không phải bằng chứng rằng ForgeOS đã vượt chúng. Việc vượt phải được chứng minh bằng benchmark được mô tả trong tài liệu.

---

# PHẦN NÂNG CẤP LẦN 2 — DETERMINISTIC SKILL FABRIC, CONTINUOUS LEARNING VÀ HỆ SINH THÁI ĐA NGÀNH

> Phần này **bổ sung và nâng mức bắt buộc** cho toàn bộ đặc tả phía trên. Khi có khác biệt, yêu cầu trong phần nâng cấp lần 2 được ưu tiên. Mục tiêu không còn chỉ là có 1.024 skill sâu, mà là tạo một hệ thống trong đó kỹ thuật chuyên môn, pipeline xác định, agent linh hoạt, học liên tục, kiểm chứng độc lập và ngân sách context hoạt động như một thể thống nhất.

## 24. Hai hệ thống tham chiếu mới và bài học phải tích hợp

Hai repository được phân tích bổ sung:

- Alibaba OpenCodeReview: <https://github.com/alibaba/open-code-review>
- ECC: <https://github.com/affaan-m/ECC>

Không sao chép cơ học tên file hoặc prompt. ForgeOS phải rút ra **nguyên lý kiến trúc**, kiểm tra giấy phép trước khi tái sử dụng mã và triển khai lại theo Trust Kernel của chính mình.

## 24.1 OpenCodeReview: deterministic engineering × agent

OpenCodeReview không đặt toàn bộ trách nhiệm lên một prompt review. Hệ thống tách phần bắt buộc phải chính xác sang code xác định, còn model chỉ xử lý phần cần suy luận linh hoạt.

Các nguyên lý đáng tích hợp:

1. **Xác định chính xác phạm vi cần xử lý.** Không cho model tự quyết định tùy ý file nào đáng đọc rồi âm thầm bỏ file.
2. **Chia thay đổi thành các work bundle có liên hệ.** Mỗi bundle có context riêng, có thể chạy song song và có coverage ledger.
3. **Ghép rule theo đặc điểm file/task.** Không nạp tất cả checklist vào mọi request.
4. **Dùng toolset chuyên dụng.** Tool được thiết kế từ trace thật của workflow, không phải danh sách công cụ tổng quát càng nhiều càng tốt.
5. **Tách positioning khỏi reasoning.** Kết luận có thể đúng nhưng vị trí dòng sai; việc neo kết quả vào artifact phải được một module xác định xử lý.
6. **Tách reflection khỏi generation.** Một bước độc lập lọc false positive, kiểm tra tính hành động được và xác nhận bằng chứng.
7. **Benchmark trên dữ liệu thực và ground truth do chuyên gia gán nhãn.** Precision, recall, F1, token và thời gian phải được đo cùng nhau.
8. **Chấp nhận trade-off công khai.** Tối ưu precision có thể giảm recall; không che điều đó bằng một điểm tổng hợp duy nhất.

### 24.1.1 Bài học cốt lõi cho ForgeOS

Một skill Markdown không thể là đơn vị thực thi duy nhất. Mỗi skill sâu phải có thể khai báo:

```yaml
executionMode: hybrid
hardPipeline:
  - scope-selection
  - coverage-ledger
  - work-unit-bundling
  - rule-resolution
  - output-anchoring
  - evidence-validation
agentStages:
  - contextual-investigation
  - hypothesis-generation
  - domain-judgment
reflectionStages:
  - contradiction-check
  - false-positive-filter
  - actionable-output-check
```

ForgeOS phải coi skill như **một chương trình có phần xác định và phần suy luận**, không phải chỉ là văn bản hướng dẫn.

## 24.2 Everything Claude Code (ECC): harness-native operating system

Everything Claude Code (ECC) cho thấy sức mạnh của một hệ thống agent không chỉ đến từ skill. Nó đến từ sự phối hợp giữa:

- skill;
- subagent chuyên vai;
- rules luôn áp dụng;
- hooks trước/sau thao tác;
- command/workflow;
- MCP hoặc CLI adapter;
- memory và session summary;
- continuous learning;
- security scanner;
- cài đặt đa harness;
- profile context thấp hoặc nghiêm ngặt.

Các nguyên lý đáng tích hợp:

1. **Skill là workflow surface chính, nhưng rule và hook thực thi constraint cơ học.** Điều gì có thể cưỡng chế bằng code thì không nên chỉ nhắc bằng prose.
2. **Continuous learning bắt đầu từ instinct nhỏ.** Pattern được quan sát, có confidence, scope và thời hạn; nhiều instinct đủ mạnh mới được clustering thành skill.
3. **Tách memory theo harness và project.** Không để Cursor, Codex hoặc Claude vô tình ghi đè memory của nhau.
4. **Giới hạn lượng memory được inject.** Chỉ inject số instinct ít, đủ confidence, đúng project và đúng task.
5. **Cài đặt theo profile và target.** Người dùng có thể lấy riêng skill, agent, rule hoặc hook thay vì buộc cài tất cả.
6. **Research-first.** Agent kiểm tra tài liệu/API hiện hành trước khi sửa những phần phụ thuộc phiên bản.
7. **Security scan chính hệ thống agent.** Không chỉ scan source code sản phẩm; phải scan skill, hook, MCP, permission, secret và config của agent.
8. **CLI có thể thay MCP khi MCP làm context phình lớn.** Tool surface nên lazy và chỉ xuất hiện khi task cần.
9. **Cross-harness không được tuyên bố parity giả.** Host không có hook thì phải ghi rõ enforcement chỉ dựa vào instruction/sandbox.
10. **Học từ git history và session trace.** Nhưng output học được phải trải qua quarantine, evaluation và promotion.

## 24.3 Ma trận tích hợp vào ForgeOS

| Năng lực tham chiếu | ForgeOS hiện tại | Nâng cấp bắt buộc |
|---|---|---|
| Deterministic file/task coverage | Chưa có engine tổng quát | Coverage Ledger + Work Unit Compiler |
| Smart bundling | Chưa có | Dependency-aware Bundle Planner |
| Rule matching | Router chọn skill/provider | Rule Resolver theo file, AST, risk và artifact |
| Position anchoring | Artifact có ID/hash | Anchor Engine cho dòng, symbol, frame, cell, timestamp |
| Reflection | Gate/evaluator có nhưng chưa nằm sau mọi output | Reflection Pipeline độc lập và risk-aware |
| Toolset từ trace thật | Tool requirements tĩnh | Tool Trace Miner + minimal toolset optimizer |
| Continuous learning | Utility score đơn giản | Instinct Store + Evolution Lab + promotion gate |
| Hook/rule enforcement | Một phần qua protocol | Harness Event Contract + adapter compiler |
| Memory isolation | Project/artifact storage có | Harness/project/user memory namespace và retention |
| Agent config security scan | Federation scanner còn hẹp | Agent Surface Security Engine |
| Cross-harness installer | Adapter/TCK hiện có | Profile compiler + truthful capability matrix |
| Token strategy | Provider material budget | Global budget + isolated bundle contexts + lazy tools |

---

## 25. Các lỗi tiềm ẩn mới phát hiện trong ForgeOS v0.4

Các lỗi dưới đây phải được đưa vào backlog release-blocking. Chúng được tìm thấy khi đọc lại đường thực thi `resolver → service → materializer`, policy, identity, registry và utility.

## 25.1 Bundle còn unresolved vẫn có thể materialize

`compileCapabilityExecutionBundle()` ghi các lỗi vào `bundle.unresolved`, nhưng `materializeCapabilityBundle()` không từ chối khi:

- thiếu stable procedural provider;
- thiếu knowledge provider bắt buộc;
- thiếu MCP provider bắt buộc;
- có conflict chưa giải quyết;
- có approval đang chờ;
- `withinBudget` đã là false ở pha ước tính.

Do đó, một bundle có thể được hash hợp lệ nhưng **không đủ điều kiện thực thi** vẫn tạo context pack.

### Sửa bắt buộc

Tạo `assertExecutableBundle(bundle, executionContext)`:

```javascript
export function assertExecutableBundle(bundle, context) {
  if (bundle.unresolved.length) throw new UnresolvedBundleError(bundle.unresolved);
  if (bundle.approvalsRequired.length) throw new ApprovalRequiredError(bundle.approvalsRequired);
  if (bundle.conflicts.some(x => x.decision !== 'resolved')) throw new ProviderConflictError();
  if (!bundle.context.withinBudget) throw new ContextBudgetError();
  for (const tool of bundle.execution.requiredTools) {
    if (!context.availableTools.has(tool)) throw new RequiredToolUnavailableError(tool);
  }
}
```

Gọi hàm này ở cả:

- resolve trong chế độ `forExecution=true`;
- materialize;
- dispatch worker;
- resume checkpoint;
- retry/reclaim task.

Regression tests:

- bundle chỉ có knowledge provider phải bị từ chối nếu capability cần procedure;
- bundle thiếu browser nhưng capability yêu cầu browser phải bị từ chối;
- bundle còn candidate approval phải không materialize;
- bundle có conflict phải không dispatch;
- bundle ước tính vượt budget phải fail trước khi đọc file.

## 25.2 Capability required tools chưa được cưỡng chế tại resolver

Resolver kiểm tra `provider.compatibility.tools`, nhưng không bắt buộc `context.tools` phải chứa toàn bộ `capability.requiredTools`. Hai tập này không nhất thiết giống nhau.

### Sửa bắt buộc

- Thêm `missingRequiredTools` vào bundle.
- `compatible()` phải nhận cả capability và provider.
- Không chọn provider nếu capability cần tool mà execution context không có.
- Không dùng việc provider vô tình không khai tool để vượt constraint của capability.
- Tool alias phải được normalize: `browser`, `browser.inspect`, `playwright` không được coi là giống nhau nếu chưa có capability mapping.

## 25.3 Resolver chỉ chọn tối đa một provider mỗi loại

Schema hiện giới hạn `selected.maxItems = 3`, và resolver chọn tối đa:

- một skill;
- một knowledge provider;
- một MCP provider.

Điều này ngăn composition thật. Một capability phức tạp có thể cần:

```text
procedure chính
+ security sub-technique
+ accessibility evaluator
+ domain reference
+ static analyzer
+ browser tool
```

### Sửa bắt buộc

Thay `selected[]` bằng `executionGraph`:

```yaml
nodes:
  - role: primary-procedure
  - role: constraint-rule-pack
  - role: specialist-technique
  - role: evaluator
  - role: knowledge-reference
  - role: tool-provider
edges:
  - before
  - validates
  - supplies-context-to
  - conflicts-with
  - fallback-for
```

Giới hạn không dựa trên số provider cứng; giới hạn theo token, latency, risk và graph complexity.

## 25.4 `preferredSourceIds` và nhiều policy chưa tham gia rank đúng nghĩa

Capability có `preferredSourceIds` và `providerPolicy.preferLocal`, nhưng rank hiện ưu tiên local theo code cứng. Danh sách nguồn ưu tiên không được dùng đầy đủ để quyết định.

### Sửa bắt buộc

Scoring phải bao gồm:

- source preference rank;
- authority class;
- contract fit;
- evidence freshness;
- benchmark utility;
- license fit;
- latency/cost;
- model compatibility;
- tenant policy;
- local preference chỉ khi `preferLocal=true`.

Không được để “local-first” thắng một provider chuyên gia tốt hơn nếu capability policy yêu cầu authority cụ thể.

## 25.5 Assurance và risk class chưa điều khiển provider composition đủ sâu

`assurance` hiện chủ yếu được chép vào bundle. Nó chưa buộc:

- số evaluator độc lập;
- loại evidence;
- human approval;
- sandbox profile;
- model tier;
- source authority;
- redundancy;
- retry policy;
- retention/audit.

### Sửa bắt buộc

| Assurance | Yêu cầu tối thiểu |
|---|---|
| A0 | Một procedure, local evidence, không irreversible tool |
| A1 | Procedure + deterministic verifier |
| A2 | Procedure + evaluator độc lập + fresh evidence |
| A3 | Hai phương pháp kiểm tra khác loại + sandbox + human gate cho tác động cao |
| A4 | Certified provider, separation of duties, signed receipt, reproducible run, independent domain reviewer |

## 25.6 Approval provider lưu trong RAM

`FederationService.approvals` là `Map` trong process. Hậu quả:

- restart làm mất approval;
- không dùng được multi-node;
- không có durable audit đầy đủ;
- không có global single-use guarantee giữa replicas;
- không có retention và revocation query.

### Sửa bắt buộc

Tạo `ApprovalRepository` transactional:

- token chỉ lưu hash;
- compare-and-consume trong một transaction;
- TTL index;
- provider digest binding;
- principal binding;
- tenant binding;
- revocation;
- replay detection;
- outbox event;
- PostgreSQL và SQLite adapter cùng contract suite.

## 25.7 Freshness của scan/evaluation chưa được re-check lúc resolve/materialize

Promotion kiểm tra receipt khớp digest, nhưng runtime materializer chỉ kiểm tra stable, digest và blocker. Stable provider có thể tồn tại lâu sau khi:

- scan policy đã đổi;
- evaluator corpus đã đổi;
- dependency/reference đã lỗi thời;
- provider đã quá hạn;
- source bị thu hồi;
- CVE mới xuất hiện.

### Sửa bắt buộc

Bundle phải pin:

```yaml
scanReceiptSha256:
evaluationReceiptSha256:
policyRevision:
scannerVersion:
evaluatorVersion:
validUntil:
sourceStatus:
```

Materializer xác minh lại tất cả trước khi đọc nội dung. Critical provider có thời hạn ngắn hơn low-risk provider.

## 25.8 Security scanner dễ bị né tránh

Scanner hiện dựa nhiều vào regex trực tiếp. Nó có thể bỏ sót:

- Unicode confusable và zero-width characters;
- text mã hóa base64/hex;
- prompt injection chia qua nhiều file;
- HTML/CSS hidden text;
- SVG metadata;
- Markdown link redirect;
- DNS rebinding hostname;
- IPv6 loopback/private ranges;
- shell obfuscation;
- package lifecycle scripts;
- tool description injection;
- nested archive;
- YAML anchors/aliases gây payload expansion;
- executable script ở vị trí không khớp regex;
- instructions yêu cầu agent tự tải và chạy code sau materialization.

### Sửa bắt buộc

Tạo pipeline nhiều tầng:

1. Canonicalize Unicode và bỏ zero-width.
2. Decode bounded layers của base64/hex/url encoding.
3. Parse Markdown/HTML/SVG/YAML/JSON bằng parser thực.
4. Secret scanner nhiều pattern + entropy + allowlist.
5. Network target parser bằng IP/CIDR, không regex URL đơn giản.
6. Shell/PowerShell/JavaScript AST analyzer.
7. Package manifest lifecycle-script analyzer.
8. Prompt-injection classifier deterministic + model-assisted adversarial review.
9. Cross-file instruction graph.
10. Sandbox detonation cho package có executable được phép.

## 25.9 External text được materialize nguyên file

External provider có thể đưa nhiều `.md`, `.json`, `.yaml`, `.csv` vào context. Dù script bị loại, nội dung dữ liệu vẫn có thể chứa instruction độc hại và làm phình context.

### Sửa bắt buộc

- Parse skill thành section AST.
- Materialize theo section allowlist.
- Tách `instruction`, `reference`, `example`, `data` thành trust channel khác nhau.
- Quote dữ liệu không đáng tin trong data envelope mà model được nhắc rõ là không phải instruction.
- Mỗi section có digest riêng.
- Bất kỳ section external nào được dùng làm instruction phải có scan receipt riêng.

## 25.10 Utility score chưa đủ để học selection

`recordSkillUtility()` dùng trung bình đơn giản và không có:

- confidence interval;
- Bayesian prior theo skill maturity;
- recency decay;
- task difficulty normalization;
- model/provider normalization;
- causal attribution khi nhiều skill cùng chạy;
- penalty cho unsafe near-miss;
- exploration/exploitation;
- tenant/domain segmentation;
- rollback khi utility drift.

### Sửa bắt buộc

Dùng contextual bandit có guardrail:

```text
posterior success probability
+ quality delta normalized by task
- token/latency cost
- safety penalty
- uncertainty penalty
+ controlled exploration
```

Critical skill không được auto-promote chỉ vì bandit score cao.

## 25.11 OIDC verifier còn các giới hạn cần harden

Verifier hiện chỉ chấp nhận RS256, đây là fail-closed tốt nhưng còn thiếu:

- kiểm tra `iat` không nằm quá xa trong tương lai;
- kiểm tra `azp` khi token có nhiều audience;
- validation `typ`, `use`, `key_ops`, `kty`;
- JWKS cache/rotation/negative-cache policy chuẩn hóa;
- chống replay bằng `jti` đối với thao tác nguy cơ cao;
- organization/tenant claim mapping configurable;
- issuer discovery pinning;
- algorithm agility có allowlist;
- audit receipt cho authentication decision.

Không tự mở thêm thuật toán chỉ để tăng compatibility; mỗi thuật toán phải có test vector.

## 25.12 Source popularity có thể ảnh hưởng trust dù rất nhỏ

Trust score cộng điểm theo stars. Dù bị cap, popularity không phải security evidence và có thể tạo bias trong tie-break.

### Sửa bắt buộc

- Tách `trustScore` khỏi `adoptionSignal`.
- Stars không được tham gia eligibility hoặc security trust.
- Adoption chỉ dùng sau khi toàn bộ trust gate đạt và chỉ để gợi ý discovery.

## 25.13 Mapping external skill vẫn dựa từ khóa và confidence thô

External synchronizer có explicit capability ID tốt, nhưng khi không có ID, việc map vẫn dựa vào token overlap. Skill chuyên ngành dễ bị gắn sai capability.

### Sửa bắt buộc

- External skill không có explicit mapping chỉ ở trạng thái `discovered`.
- Tạo mapping proposal với top-k, giải thích và evidence.
- Human/domain reviewer hoặc verified semantic evaluator duyệt mapping.
- Không cho `reviewRequired=false` chỉ vì score từ khóa vượt ngưỡng.
- Mapping phải được re-evaluate khi capability contract đổi.

## 25.14 Không có deterministic coverage ledger tổng quát

Router có thể chọn skill đúng nhưng agent vẫn có thể bỏ sót một phần phạm vi, giống vấn đề review thay đổi lớn.

### Sửa bắt buộc

Mọi workflow phải có `CoverageLedger`:

```yaml
scopeItems:
  - id
  - type
  - risk
  - assignedWorkUnit
  - status: pending|processed|excluded|blocked
  - exclusionReason
  - evidenceRefs
coverageInvariant:
  everyInScopeItemIsProcessedOrExplicitlyExcluded: true
```

Không hoàn tất task nếu ledger còn item không có trạng thái hợp lệ.

## 25.15 Không có continuous-learning pipeline đáng tin

ForgeOS có utility/evaluation nhưng chưa có lớp quan sát pattern nhỏ, confidence, scope, decay, clustering và evolution thành skill.

### Sửa bắt buộc

Xây Instinct Engine theo phần 28, nhưng kết hợp Trust Kernel để tránh agent tự học prompt injection hoặc thói quen sai.

## 25.16 Cross-harness enforcement chưa đồng đều

Một số host có hooks, một số chỉ có instruction file. Một skill có thể được gọi là “supported” nhưng constraint thực tế khác nhau.

### Sửa bắt buộc

Mỗi adapter phải công bố machine-readable matrix:

```yaml
supports:
  preToolHook: enforced|emulated|unsupported
  postToolHook: enforced|emulated|unsupported
  sessionStartInjection: enforced|emulated|unsupported
  sandbox: native|external|none
  approval: native|external|instruction-only
  skillAutoDiscovery: native|translated|manual
```

Release claim phải dựa trên mức enforcement, không chỉ file được copy thành công.

---

## 26. Kiến trúc đích mới: Deterministic Skill Execution Fabric

Kiến trúc mới đặt một lớp thực thi xác định giữa router và model.

```text
User/Project Intent
        ↓
Intent Resolver + Risk Classifier
        ↓
Scope Compiler
        ↓
Coverage Ledger
        ↓
Capability/Skill Graph Planner
        ↓
Deterministic Work-Unit Bundler
        ↓
Rule + Technique Resolver
        ↓
Global Context Compiler
        ↓
Isolated Agent Worker(s)
        ↓
Anchor/Positioning Engine
        ↓
Reflection + Independent Evaluation
        ↓
Evidence Receipt + Artifact Commit
        ↓
Continuous-Learning Observer
```

## 26.1 Scope Compiler

Input có thể là:

- git diff;
- toàn repository;
- artifact DAG;
- thiết kế UI;
- bảng dữ liệu;
- video timeline;
- hồ sơ pháp lý;
- mô hình tài chính;
- robot behavior graph;
- tài liệu nghiên cứu.

Scope Compiler biến input thành các `ScopeItem` có ID ổn định, hash, loại, dependency và risk. Model không được tự âm thầm loại item.

## 26.2 Work-Unit Bundler

Bundler nhóm item dựa trên:

- dependency graph;
- shared symbols/data;
- cùng feature/journey;
- cùng rule pack;
- kích thước token;
- risk isolation;
- concurrency safety;
- ownership boundary;
- cross-file localization;
- shared test/evidence.

Mục tiêu:

- mỗi bundle đủ context để giải quyết toàn diện;
- không lớn đến mức model cắt góc;
- không tách những file/artifact phải hiểu cùng nhau;
- có thể retry độc lập;
- có coverage ledger;
- có token budget riêng.

## 26.3 Deterministic Rule Resolver

Rule không phải skill. Rule là constraint nhỏ, có predicate rõ:

```yaml
id: java.npe.optional-dereference
appliesWhen:
  language: java
  astPattern: Optional.get without presence guard
severity: high
requiresEvidence:
  - ast-location
  - control-flow-path
validator: java-nullability-analyzer
```

Rule Resolver chọn rule theo:

- domain;
- file type;
- AST/schema;
- framework/version;
- risk;
- capability;
- project policy;
- historical defects;
- changed surface.

Chỉ rule phù hợp được đưa vào bundle.

## 26.4 Agent Worker

Agent chỉ làm những phần cần:

- hiểu ý nghĩa;
- nối context xa;
- tạo giả thuyết;
- so sánh trade-off;
- thiết kế giải pháp;
- giải thích finding;
- xử lý trường hợp chưa có deterministic analyzer.

Agent không chịu trách nhiệm cho:

- tính đủ của file coverage;
- line number cuối cùng;
- kiểm tra digest;
- enforcement budget;
- approval replay;
- schema validation;
- tool permission;
- freshness;
- dedup cơ học.

## 26.5 Anchor Engine

Kết quả phải neo vào object thật:

| Domain | Anchor |
|---|---|
| Code | file + commit/blob hash + symbol + line/hunk |
| UI | component ID + DOM/accessibility node + screenshot region |
| Spreadsheet | workbook hash + sheet + table/cell range |
| Video | asset hash + track + timestamp/frame range |
| Audio | asset hash + channel + time range |
| Document | document hash + heading + paragraph/block ID |
| Database | schema revision + query fingerprint + plan node |
| Robotics | behavior node + sensor frame + simulation timestamp |
| Legal | source/version + clause + jurisdiction/effective date |

Anchor drift phải được phát hiện và relocate bằng module xác định.

## 26.6 Reflection Pipeline

Mỗi output quan trọng chạy qua:

1. Evidence existence.
2. Evidence freshness.
3. Contradiction với source/artifact.
4. Duplicate finding.
5. False-positive likelihood.
6. Severity calibration.
7. Actionability.
8. Scope completeness.
9. Policy compliance.
10. Anchor validity.

Reflection không được dùng cùng prompt/model state với producer ở assurance cao.

---

## 27. Skill Galaxy: quy mô mới cho kỹ thuật đa ngành

Mục tiêu tăng cường thay thế cách hiểu “1.024 file skill là đủ”. Kiến trúc nên có bốn tầng:

| Tầng | Số lượng mục tiêu | Vai trò |
|---|---:|---|
| Kernel skills | 128 | Điều phối, trust, context, learning, planning, verification |
| Canonical deep skills | 1.024 | Kỹ thuật hoàn chỉnh, có contract/evaluator/benchmark |
| Specialist technique modules | 3.072 | Chuyên biệt theo framework, ngành, công cụ, môi trường |
| Deterministic rule packs | ≥4.096 | Tối thiểu 4.096 deterministic rule packs, mỗi pack có predicate/validator được code cưỡng chế |
| Evaluators | ≥512 | Đánh giá độc lập theo artifact/domain |

**Tổng số procedural skill chính thức vẫn được tính riêng:** 1.152 gồm 128 kernel + 1.024 canonical. Specialist modules không được quảng cáo như stable skill nếu chưa có contract và benchmark tương đương.

## 27.1 64 cụm nghề nghiệp/ngành phải được bao phủ

1. AI agent engineering  
2. Machine learning research  
3. MLOps và model serving  
4. Data science  
5. Data engineering  
6. Analytics engineering  
7. Backend engineering  
8. Frontend engineering  
9. Mobile development  
10. Desktop development  
11. API/integration engineering  
12. Database engineering  
13. Distributed systems  
14. Cloud platforms  
15. DevOps/SRE  
16. Cybersecurity  
17. Privacy engineering  
18. Software testing  
19. Programming languages/compilers  
20. Embedded systems  
21. Electronics/PCB  
22. Robotics/automation  
23. Control systems  
24. Mechanical engineering  
25. Manufacturing/industrial engineering  
26. Automotive systems  
27. Aerospace systems  
28. Civil/structural engineering  
29. Architecture/BIM  
30. Energy/power systems  
31. Telecommunications/networking  
32. GIS/geospatial  
33. Game development  
34. XR/spatial computing  
35. Graphics/rendering  
36. UI design  
37. UX research  
38. Accessibility/human factors  
39. Graphic/brand design  
40. Motion/3D design  
41. Video production  
42. Audio/music production  
43. Technical writing  
44. Journalism/editorial  
45. Localization/translation operations  
46. Product management  
47. Project/program management  
48. Operations leadership  
49. Supply chain/logistics  
50. Sales/revenue operations  
51. Marketing/growth  
52. Ecommerce  
53. Finance/investment  
54. Accounting/audit  
55. Insurance/risk  
56. Legal/compliance  
57. Government/public policy  
58. Education/instructional design  
59. Scientific research  
60. Mathematics/statistics  
61. Physics/chemistry/materials  
62. Biotechnology/pharmaceuticals  
63. Medicine/public health  
64. Agriculture/environment/climate

Mỗi cụm không được tạo cùng một ma trận 32 bước. Mỗi cụm phải có **Domain Editorial Board**, competency map và artifact/evidence riêng.

## 27.2 Phân bổ 1.024 canonical deep skills

Không chia đều máy móc. Phân bổ theo độ rộng, rủi ro và nhu cầu thực tế:

| Siêu nhóm | Canonical skills |
|---|---:|
| Software, platform, data, security | 300 |
| AI/ML/agent/model operations | 140 |
| Hardware, robotics, engineering vật lý | 120 |
| Design, graphics, media, game/XR | 130 |
| Product, operations, business | 100 |
| Finance, legal, compliance, government | 80 |
| Science, medicine, biotech, environment | 90 |
| Education, writing, localization, research methods | 64 |
| **Tổng** | **1.024** |

## 27.3 128 kernel skill mới

### Intent, decomposition và coverage — 16

- resolving-ambiguous-multi-domain-intent
- compiling-verifiable-scope
- constructing-coverage-ledgers
- decomposing-work-into-token-bounded-units
- grouping-dependency-coherent-artifacts
- detecting-scope-omissions
- managing-explicit-exclusions
- escalating-unknown-critical-scope
- mapping-user-outcomes-to-artifacts
- translating-constraints-to-runtime-policy
- detecting-conflicting-requirements
- maintaining-decision-ledgers
- resolving-cross-domain-ownership
- selecting-assurance-levels
- planning-reversible-experiments
- terminating-work-on-satisfied-contracts

### Routing và composition — 16

- routing-capability-graphs
- composing-many-to-many-techniques
- resolving-deterministic-rule-packs
- selecting-specialist-evaluators
- choosing-provider-ensembles
- routing-by-artifact-and-risk
- routing-with-negative-triggers
- balancing-quality-token-latency
- exploring-under-uncertainty-safely
- detecting-route-drift
- explaining-route-decisions
- selecting-fallback-providers
- preventing-provider-conflicts
- calibrating-cross-model-routing
- segmenting-utility-by-context
- rolling-back-bad-routing-policies

### Context và token — 16

- compiling-global-context-budgets
- estimating-provider-specific-tokens
- retrieving-skill-sections
- projecting-artifact-state
- compiling-semantic-code-abi
- distilling-tool-output
- managing-memory-tiers
- isolating-work-unit-contexts
- planning-prompt-cache-prefixes
- selecting-cli-over-mcp
- pruning-stale-context
- preserving-lossless-evidence-references
- detecting-context-poisoning
- reserving-output-and-tool-budget
- measuring-token-attribution
- optimizing-context-with-quality-guards

### Trust, security và policy — 24

- validating-executable-bundles
- enforcing-required-tools
- issuing-durable-single-use-approvals
- verifying-provider-freshness
- scanning-agent-supply-chains
- detecting-cross-file-prompt-injection
- normalizing-obfuscated-instructions
- profiling-mcp-permissions
- sandboxing-untrusted-providers
- isolating-secrets-from-model-context
- binding-evidence-to-subject-hashes
- preventing-stale-proof-reuse
- enforcing-separation-of-duties
- maintaining-transparency-checkpoints
- verifying-signed-skill-manifests
- enforcing-tenant-memory-isolation
- validating-oidc-and-service-identities
- preventing-tool-confused-deputy-attacks
- modeling-agentic-attack-chains
- red-teaming-skill-packages
- blue-teaming-agent-configurations
- auditing-policy-decisions
- recovering-from-compromised-providers
- revoking-transitive-trust

### Learning và evaluation — 24

- observing-reusable-instincts
- scoring-instinct-confidence
- scoping-instincts-to-projects
- decaying-stale-instincts
- clustering-instincts-into-skills
- generating-skills-from-git-history
- mining-tool-call-traces
- creating-failing-skill-baselines
- evaluating-skill-behavior
- running-hidden-holdouts
- calibrating-judge-ensembles
- attributing-quality-in-composed-runs
- detecting-skill-regressions
- promoting-skills-with-evidence
- quarantining-harmful-learning
- exporting-and-importing-instincts-safely
- detecting-learning-data-poisoning
- measuring-router-counterfactuals
- operating-contextual-bandits-safely
- detecting-model-specific-overfitting
- validating-cross-harness-behavior
- curating-domain-ground-truth
- managing-skill-deprecation
- evolving-skills-with-semantic-versioning

### Execution, reflection và release — 32

Bao gồm work-unit scheduling, deterministic validators, anchor relocation, reflection, retry, checkpoint, idempotency, incident recovery, release proof, benchmark reproducibility và rollback. Mỗi skill nhóm này phải có executable harness chứ không chỉ prose.

## 27.4 Ví dụ các specialist technique module chuyên sâu

### Code review

- selecting-review-files-from-git-graphs
- bundling-localization-resource-changes
- relocating-comments-after-diff-drift
- validating-line-level-review-anchors
- detecting-nullability-path-defects
- detecting-thread-safety-contract-violations
- tracing-tainted-data-to-sql-sinks
- tracing-tainted-data-to-html-sinks
- reflecting-code-review-false-positives
- calibrating-review-severity

### Agent engineering

- minimizing-tool-surface-from-call-traces
- detecting-loop-stagnation
- checkpointing-long-running-agent-work
- reclaiming-stale-agent-leases
- preventing-memory-cross-contamination
- measuring-agent-context-rot
- compiling-harness-specific-hooks
- isolating-subagent-context
- evolving-instincts-into-tested-skills
- auditing-agent-config-supply-chain

### UI/graphics

- profiling-browser-compositor-layers
- preventing-layout-shift-under-font-swap
- designing-focus-order-in-virtualized-interfaces
- validating-color-management-across-hdr-sdr
- optimizing-webgpu-resource-lifetimes
- reducing-shader-divergence
- evaluating-motion-accessibility
- anchoring-visual-findings-to-component-regions
- testing-responsive-layout-by-content-constraints
- detecting-visual-regression-with-perceptual-thresholds

### Medicine/life science

- grading-clinical-evidence-quality
- detecting-confounding-in-observational-studies
- validating-biostatistical-analysis-plans
- tracing-claims-to-regulatory-labels
- checking-drug-interaction-evidence-provenance
- designing-reproducible-bioinformatics-pipelines
- assessing-dataset-shift-in-clinical-models
- protecting-patient-data-in-agent-workflows

Các skill y tế/pháp lý/tài chính chỉ hỗ trợ workflow chuyên môn; mọi output có tác động cao phải yêu cầu nguồn hiện hành và human/domain approval.

---

## 28. Continuous Learning v3: từ instinct đến certified skill

ForgeOS phải học liên tục nhưng **không được tự biến mọi hành vi lặp lại thành sự thật**.

## 28.1 Đơn vị học nhỏ nhất: Instinct

```yaml
instinctId: inst_...
statement: Prefer symbol-level retrieval before full-file loading for large repositories.
trigger:
  taskTypes: [code-analysis]
  conditions: [repo_tokens_gt_100k]
antiTriggers:
  - file_is_small
scope:
  tenantId:
  projectId:
  harness:
  language:
observations:
  successes: 7
  failures: 1
confidence:
  posteriorMean: 0.81
  interval95: [0.62, 0.93]
provenance:
  sessionIds: []
  runReceiptHashes: []
security:
  taintStatus: clean
  sourceChannels: [trusted-tool-trace]
status: pending
expiresAt:
```

## 28.2 Pipeline học

```text
Observe trace
→ redact secrets/PII
→ extract candidate pattern
→ detect adversarial/untrusted source influence
→ deduplicate
→ assign scope
→ evaluate counterexamples
→ store pending instinct
→ accumulate independent observations
→ run behavioral test
→ promote to active instinct
→ cluster related instincts
→ draft skill candidate
→ RED baseline
→ GREEN evaluation
→ human/domain review
→ registry promotion
```

## 28.3 Không học từ nguồn không đáng tin

Không tạo instinct trực tiếp từ:

- nội dung web/email/PR chưa được tách data/instruction;
- model self-report;
- một lần chạy thành công duy nhất;
- output không có receipt;
- session có security finding chưa giải quyết;
- task đã bị người dùng bác bỏ;
- code bị rollback;
- benchmark bị flaky;
- confidential project nếu policy cấm cross-project learning.

## 28.4 Scope và isolation

Instinct có các scope:

```text
session → project → workspace → tenant → global
```

Promotion lên scope rộng hơn cần evidence mới. Không tự động đưa thói quen của một project sang global.

Memory root phải phân tách theo:

```text
user / tenant / harness / project / environment / model-family
```

## 28.5 Confidence, decay và prune

- Pending instinct có TTL mặc định.
- Confidence giảm khi không còn phù hợp với phiên bản công cụ/framework.
- Negative evidence được tính mạnh hơn observation trùng lặp cùng nguồn.
- Framework/version change làm instinct `needs-revalidation`.
- Instinct dưới ngưỡng và hết TTL bị prune nhưng audit record vẫn tồn tại.

## 28.6 Skill evolution

Một skill stable không được sửa trực tiếp từ session. Hệ thống tạo version candidate mới:

```text
skill v1.4.2 stable
+ instinct cluster
→ skill v1.5.0 candidate
→ paired benchmark
→ canary routing
→ stable hoặc rollback
```

## 28.7 Git History Skill Miner

Phân tích git để tìm:

- lỗi lặp lại;
- pattern sửa bug thành công;
- test thường đi kèm module;
- convention API/schema;
- rollback và reverted approaches;
- module ownership;
- migration pattern;
- performance fix;
- security patch.

Không biến code style ngẫu nhiên thành skill. Mỗi pattern phải có recurrence, outcome và counterexample.

## 28.8 Tool Trace Miner

Thu thập thống kê:

- tool call frequency;
- tool sequence;
- repeated calls;
- failures/timeouts;
- output tokens;
- contribution tới success;
- permission risk;
- model/harness differences.

Dùng để giảm toolset, tạo macro deterministic và phát hiện tool không tạo giá trị.

---

## 29. Harness Runtime v2: hook, rule, agent và adapter compiler

## 29.1 Harness Event Contract

Định nghĩa event trung lập:

```text
session.created
session.resumed
before.prompt.submit
before.tool.execute
after.tool.execute
before.file.write
after.file.write
before.mcp.execute
after.mcp.execute
before.agent.delegate
after.agent.complete
verification.checkpoint
session.compact
session.ended
```

Adapter ánh xạ event host-native hoặc ghi rõ `unsupported`.

## 29.2 Rule, hook, skill và agent là bốn loại khác nhau

| Loại | Dùng khi |
|---|---|
| Rule | Nguyên tắc luôn áp dụng, ngắn và ổn định |
| Hook | Có event xác định và hành vi có thể code hóa |
| Skill | Cần judgment/procedure có điều kiện |
| Agent role | Cần context/tool/model/authority tách biệt |

Không tạo skill chỉ để nói “sau edit hãy chạy formatter”; đó là hook.

## 29.3 Profile cài đặt

```text
minimal       kernel + router + verification
coding        software packs + code review + testing
creative      UI/graphics/video/audio packs
research      source verification + scientific methods
regulated     trust A3/A4 + domain approvals
local-small   context cực thấp + CLI-first + model nhỏ
enterprise    SSO/PDP/audit/multi-node
```

## 29.4 Context injection budget theo host

Mỗi host adapter phải có:

- session start max tokens;
- max active instincts;
- max always-on rules;
- lazy skill loading mode;
- MCP tool schema cost;
- compaction strategy;
- project memory location;
- data retention.

## 29.5 Adapter conformance

TCK mới kiểm tra behavior thật:

- hook có được gọi đúng event;
- denied command có thực sự bị chặn;
- session memory có đúng namespace;
- skill auto-discovery có hoạt động;
- approval có fail-closed;
- unsupported feature không bị quảng cáo;
- config uninstall không xóa file người dùng;
- update giữ custom override;
- Windows/macOS/Linux path behavior.

---

## 30. Agent Surface Security Engine

ForgeOS cần một security product nội bộ tương đương cấp độ “scan chính agent harness”, không chỉ scan package skill.

## 30.1 Bề mặt phải scan

- system/project instruction files;
- skill folders;
- agent role definitions;
- hook scripts;
- MCP configs và tool descriptions;
- allowed commands;
- sandbox/approval settings;
- environment-variable references;
- package lifecycle scripts;
- browser extension manifests;
- CI workflows;
- generated config cho từng harness;
- session memory và imported instinct;
- external knowledge references.

## 30.2 Năm lớp phân tích

1. Static deterministic rules.
2. Dataflow/permission graph.
3. Prompt-injection and instruction-boundary analysis.
4. Sandbox adversarial execution.
5. Red-team/blue-team/auditor reasoning cho cấu hình nguy cơ cao.

## 30.3 Permission graph

```text
Agent Role
→ can invoke Tool
→ Tool reaches Resource
→ Resource contains Secret/Data
→ Output can leave Trust Domain
```

Phát hiện:

- confused deputy;
- privilege escalation;
- secret exfiltration path;
- write capability không cần thiết;
- broad filesystem/network access;
- MCP tool name collision;
- unsafe fallback provider;
- hook chạy trước trust acceptance;
- environment endpoint override.

## 30.4 Gate trước cài đặt

`forge install <pack>` phải:

1. Pin digest/revision.
2. Verify signature/license.
3. Scan package.
4. Hiển thị permission diff.
5. Materialize preview.
6. Yêu cầu approval theo risk.
7. Cài trong transaction.
8. Chạy post-install TCK.
9. Tạo rollback snapshot.

## 30.5 Security benchmark

Tạo corpus tối thiểu 1.000 case:

- prompt injection trực tiếp/gián tiếp;
- Unicode/hidden text;
- malicious tool descriptions;
- secret patterns;
- destructive shell;
- SSRF/private metadata;
- symlink/path traversal;
- package script abuse;
- approval replay;
- cross-tenant memory leak;
- stale provider;
- malicious instinct import;
- compromised evaluator;
- anchor spoofing.

---

## 31. Global Context Kernel v2: giảm token toàn workflow

Phần 12 vẫn đúng, nhưng cần bổ sung các kỹ thuật học từ pipeline chuyên dụng và harness thực tế.

## 31.1 Context không chỉ được nén; phải được chia đúng ranh giới

Một context 100.000 token được tóm tắt thành 30.000 token vẫn có thể kém hơn bốn work unit 8.000 token có dependency rõ. Context Kernel phải ưu tiên:

1. Scope decomposition.
2. Isolated bundle context.
3. Progressive retrieval.
4. Section loading.
5. Distillation.
6. Cache.

## 31.2 Budget tree

```yaml
requestBudget:
  totalInputTokens: 32000
  outputReserve: 5000
  toolReserve: 3000
  fixed:
    kernel: 1800
    policy: 900
  dynamic:
    task: 1200
    skillSections: 5000
    codeAbi: 6000
    sourceFragments: 5000
    artifactProjection: 3000
    memory: 1600
    toolSchemas: 1500
    evidenceSummary: 1000
```

Mỗi node phải có `actualTokens`, `estimatedTokens`, `source`, `priority`, `dropPolicy`, `freshness`, `digest`.

## 31.3 CLI-first tool strategy

MCP có lợi khi tool discovery và structured invocation quan trọng, nhưng tool schemas luôn nạp có thể tốn context. ForgeOS phải có Tool Surface Optimizer:

- dùng CLI wrapper khi command ổn định và output dễ chuẩn hóa;
- dùng MCP khi cần session/protocol/resource semantics;
- lazy-load MCP tools theo capability;
- chỉ đưa tool subset cần thiết;
- tạo deterministic wrapper cho output;
- benchmark token/latency/reliability của CLI và MCP.

## 31.4 Tool schema distillation

Không gửi toàn bộ schema hàng chục tool. Tạo tool ABI:

```text
T7 git.diff(range, paths?) -> DiffArtifact
T9 repo.symbol(id) -> SourceFragment
T12 test.run(targets, profile) -> TestReceipt
```

Model yêu cầu chi tiết schema khi chọn tool.

## 31.5 Context isolation theo work unit

Mỗi subagent nhận:

- scope item/bundle;
- dependency summary;
- relevant rules;
- relevant skill sections;
- source fragment;
- evidence obligations;
- token budget;
- no unrelated project history.

Aggregator nhận structured results, không nhận toàn bộ chain-of-thought hoặc raw contexts.

## 31.6 Compression phải có loss accounting

Mọi summary/distillation có:

```yaml
sourceDigest:
summaryDigest:
coverage:
  retainedClaims:
  omittedSections:
  unresolvedAmbiguities:
lossRisk: low|medium|high
expandHandle:
```

Critical evidence không được chỉ tồn tại trong summary.

## 31.7 Token calibration sửa toàn diện

- Tokenizer thật theo provider/model.
- Tính cả JSON framing, tool schema, image metadata và cache prefix.
- Dùng safety margin theo p95 error.
- Cập nhật estimator từ usage thực.
- Version estimator và pin vào receipt.
- Materialization test toàn bộ stable/certified provider.
- Không dùng `bytes/4` làm quyết định cuối.

## 31.8 Token attribution

Mỗi run ghi:

```text
kernel tokens
skill tokens
code/source tokens
memory tokens
tool schema tokens
tool output tokens
retry tokens
reflection tokens
wasted/repeated retrieval tokens
```

Từ đó biết phần nào cần tối ưu thay vì chỉ nhìn tổng.

## 31.9 Mục tiêu benchmark

Trên cùng model/task:

- giảm ≥70% tổng input token median so với full-context baseline;
- giảm ≥50% p95 token trên repo lớn;
- quality không giảm quá ngưỡng thống kê;
- coverage không giảm;
- recall không bị hy sinh âm thầm;
- token do retry giảm ≥40%;
- tool schema tokens giảm ≥60% trong profile CLI-first;
- context estimation error p95 ≤8%.

Kết quả “xấp xỉ 1/9 token” của một hệ thống chuyên code review là mục tiêu tham khảo, không được biến thành claim của ForgeOS trước benchmark độc lập.

---

## 32. Code Review Intelligence Pack

Code review nên là pack mẫu chứng minh kiến trúc mới trước khi mở rộng toàn bộ ngành.

## 32.1 Pipeline

```text
Git/object snapshot
→ Diff Parser
→ File Scope Selector
→ Dependency-aware Bundler
→ Language/Framework Detector
→ Rule Resolver
→ Review Agent per Bundle
→ Finding Deduplicator
→ Anchor Relocator
→ Reflection Filter
→ Coverage Gate
→ Review Receipt
```

## 32.2 Skill families tối thiểu

### Scope và diff

- parsing-git-diffs-losslessly
- selecting-review-scope
- respecting-ignore-and-generated-files
- grouping-related-file-changes
- detecting-missing-companion-changes
- reviewing-full-files-without-diff
- resuming-interrupted-review-sessions

### Correctness

- tracing-nullability
- checking-resource-lifecycles
- detecting-state-machine-gaps
- checking-error-propagation
- detecting-inconsistent-localization
- verifying-boundary-contracts
- detecting-timezone-and-numeric-errors

### Concurrency

- detecting-data-races
- checking-lock-order
- validating-idempotency
- checking-transaction-boundaries
- detecting-stale-writer-risk
- validating-async-cancellation

### Security

- tracing-sql-injection
- tracing-xss
- checking-authz-boundaries
- detecting-secret-exposure
- checking-ssrf
- detecting-path-traversal
- reviewing-cryptographic-use
- checking-tenant-isolation

### Performance

- detecting-n-plus-one-queries
- checking-unbounded-memory-growth
- analyzing-hot-loop-complexity
- detecting-blocking-io
- validating-cache-invalidation
- checking-render-performance

### Review output

- anchoring-comments-to-diffs
- relocating-comments-after-edits
- reflecting-false-positives
- calibrating-severity
- writing-actionable-comments
- merging-duplicate-findings
- proving-review-coverage

## 32.3 Ground-truth benchmark

- 50+ repositories;
- 200+ real pull requests;
- 10+ languages;
- 1.500+ expert-labeled issues;
- blind adjudication;
- inter-rater agreement;
- precision/recall/F1 by defect class;
- anchor accuracy;
- file coverage;
- token/time/cost;
- noisy-comment rate;
- severity calibration.

Không dùng benchmark tự sinh hoàn toàn bằng model.

---

## 33. Registry, Trust Kernel và production tăng cường

## 33.1 Provider roles mới

Registry hỗ trợ:

- procedure provider;
- specialist technique provider;
- deterministic rule provider;
- evaluator provider;
- anchor provider;
- context transform provider;
- tool provider;
- composite workflow provider;
- instinct collection provider.

Mỗi role có schema và promotion criteria khác nhau.

## 33.2 Composite provider phải được triển khai thật

`kind: composite` đã tồn tại trong enum nhưng resolver/materializer chưa có execution semantics đầy đủ. Cần:

```yaml
composition:
  nodes: []
  edges: []
  entrypoints: []
  outputs: []
  failurePolicy:
  budgetPolicy:
```

Không cho composite nhúng provider bị revoked hoặc ngoài tenant policy.

## 33.3 Durable workflow state

PostgreSQL full lifecycle phải lưu:

- project/artifact/event;
- provider/source/evaluation;
- approval;
- work unit;
- coverage ledger;
- task lease;
- context pack metadata;
- instinct/memory;
- route decision;
- tool/evidence receipt;
- transparency checkpoint;
- outbox/inbox idempotency.

## 33.4 Multi-node invariant

- lease fencing ở mọi worker write;
- exactly-once effect bằng idempotency, không hứa exactly-once delivery;
- retry có backoff/jitter;
- heartbeat và reclaim;
- distributed rate limit;
- consistent policy revision;
- provider cache invalidation;
- audit ordering theo tenant/project;
- disaster recovery test.

## 33.5 Observability

Metrics mới:

```text
route precision proxy
bundle scope size
coverage completion
context tokens by category
retrieval expansion count
provider rejection reason
reflection rejection rate
anchor relocation success
instinct promotion/rejection
skill regression rate
cross-harness enforcement gap
security finding MTTR
```

Trace phải nối từ user intent đến artifact/evidence cuối.

---

## 34. Dễ dùng ở cấp hệ sinh thái lớn

## 34.1 Cài đặt một lệnh nhưng có preview

```bash
npx forgeos init
forge profile use coding
forge doctor
forge run "review this branch"
```

`init` phải hỏi ít nhưng tự phát hiện:

- host/harness;
- package manager;
- repository language/framework;
- available CLI;
- model/provider;
- sandbox capability;
- secret storage;
- context profile.

Trước khi viết file, hiển thị plan và permission diff.

## 34.2 Selective install

```bash
forge install --skills frontend,database
forge install --agents reviewer,docs-researcher
forge install --rules common,typescript
forge install --hooks safe-defaults
```

Mọi component độc lập, có ownership marker và uninstall an toàn.

## 34.3 Explainability UX

Người dùng xem được:

- vì sao skill được chọn;
- skill nào bị loại và vì sao;
- token budget;
- work bundle;
- coverage ledger;
- tool permission;
- evidence thiếu;
- provider source/license/trust;
- memory/instinct nào được inject;
- enforcement khác nhau theo host.

## 34.4 Low-context/local-model mode

- không inject session summary mặc định;
- tối đa 2–3 skill section;
- CLI-first;
- tool ABI ngắn;
- model nhỏ làm deterministic classification;
- model lớn chỉ cho bước cần reasoning;
- không chạy team agent khi task tuần tự;
- compact tại checkpoint có artifact;
- memory retrieval top-k nhỏ và confidence cao.

## 34.5 Time-to-value

Mục tiêu:

- cài thành công ≥97%;
- workflow đầu tiên ≤5 phút median;
- không cần đọc trust docs để chạy demo;
- advanced settings vẫn đầy đủ;
- lỗi chỉ rõ command sửa;
- Windows 11, macOS và Linux đều có TCK.

---

## 35. File-level migration plan tăng cường

Các task dưới đây bổ sung sau Task 15.

## Task 16 — Executable Bundle Gate

**Tạo:**

- `src/federation/executable-bundle.mjs`
- `tests/executable-bundle-gate.test.mjs`

**Sửa:**

- `src/federation/resolver.mjs`
- `src/federation/materializer.mjs`
- `src/federation/service.mjs`
- `src/federation/schemas.mjs`

**Bắt buộc:** unresolved, approval, conflict, required tool và estimated budget phải fail trước materialization/dispatch.

## Task 17 — Execution Graph và Multi-provider Composition

**Tạo:**

- `src/federation/execution-graph.mjs`
- `schemas/execution-graph.schema.json`
- `tests/execution-graph.test.mjs`

**Sửa:** resolver, materializer, provider contracts. Bỏ `maxItems:3` và thay bằng graph bounded theo policy.

## Task 18 — Deterministic Scope, Bundling và Coverage Ledger

**Tạo:**

- `src/execution/scope-compiler.mjs`
- `src/execution/work-unit-bundler.mjs`
- `src/execution/coverage-ledger.mjs`
- `src/execution/work-unit-store.mjs`
- `tests/coverage-ledger-invariants.test.mjs`
- `tests/work-unit-bundler.test.mjs`

Code review pack là vertical slice đầu tiên.

## Task 19 — Rule Engine

**Tạo:**

- `src/rules/contracts.mjs`
- `src/rules/registry.mjs`
- `src/rules/resolver.mjs`
- `src/rules/validator-runner.mjs`
- `rules/`
- `tests/rule-resolution.test.mjs`

Rule pack có predicate, validator, version, evidence và false-positive corpus.

## Task 20 — Anchor và Reflection Engine

**Tạo:**

- `src/anchors/contracts.mjs`
- `src/anchors/code-anchor.mjs`
- `src/anchors/document-anchor.mjs`
- `src/reflection/pipeline.mjs`
- `src/reflection/deduplicator.mjs`
- `tests/anchor-relocation.test.mjs`
- `tests/reflection-invariants.test.mjs`

## Task 21 — Instinct Store và Continuous Learning v3

**Tạo:**

- `src/learning/instinct-contracts.mjs`
- `src/learning/observer.mjs`
- `src/learning/confidence.mjs`
- `src/learning/evolution.mjs`
- `src/learning/poisoning-detector.mjs`
- `src/storage/sqlite-instinct-store.mjs`
- `src/storage/postgres-instinct-store.mjs`
- `tests/continuous-learning-invariants.test.mjs`

## Task 22 — Git/Tool Trace Skill Miner

**Tạo:**

- `src/learning/git-pattern-miner.mjs`
- `src/learning/tool-trace-miner.mjs`
- `src/learning/skill-draft-generator.mjs`
- `tests/skill-miner.test.mjs`

Không tự promote output.

## Task 23 — Harness Event Contract và Adapter Compiler

**Tạo:**

- `src/harness/events.mjs`
- `src/harness/capability-matrix.mjs`
- `src/harness/profile-compiler.mjs`
- `tck/harness-events.json`
- `tests/harness-adapter-tck.test.mjs`

## Task 24 — Agent Surface Security Engine

**Tạo:**

- `src/security-agent-surface/`
- `security-rules/`
- `evals/agent-security-adversarial/`
- `tests/agent-surface-security.test.mjs`

Corpus tối thiểu 1.000 case trước stable.

## Task 25 — Durable Approval Repository và Freshness Gate

**Tạo:**

- `src/approvals/repository.mjs`
- `src/storage/sqlite-approval-store.mjs`
- `src/production/postgres-approval-store.mjs`
- `src/federation/freshness-gate.mjs`
- `tests/approval-restart-replay.test.mjs`

## Task 26 — Code Review Intelligence Pack

**Tạo:**

- `packs/code-review/`
- `src/packs/code-review/`
- `evals/code-review-ground-truth/`
- `tests/code-review-e2e.test.mjs`

Đây là benchmark flagship cho deterministic × agent hybrid.

## Task 27 — Skill Galaxy expansion

- Viết 128 kernel skill trước.
- Viết 1.024 canonical deep skill theo editorial board.
- Thêm 3.072 specialist modules theo demand và benchmark.
- Thêm ≥4.096 deterministic rules.
- Thêm ≥512 evaluator.
- Không merge hàng loạt generated content nếu chưa có RED baseline.

## Task 28 — Cross-harness UX, selective installer và profile system

**Tạo:**

- `src/cli/profile-commands.mjs`
- `src/cli/selective-installer.mjs`
- `src/cli/permission-preview.mjs`
- `config/profiles/`
- TCK Windows/macOS/Linux.

---

## 36. Definition of Done tăng cường

Các điều kiện này cộng thêm vào Section 19.

## 36.1 Deterministic execution

- [ ] Mọi workflow production có Scope Compiler.
- [ ] Mọi scope item được xử lý hoặc excluded có lý do.
- [ ] Work unit bundling deterministic với cùng snapshot/config.
- [ ] Rule matching precision/recall được benchmark.
- [ ] Anchor accuracy code review ≥99% trên supported diff types.
- [ ] Reflection giảm false positives có ý nghĩa mà không làm recall giảm ngoài ngưỡng công bố.

## 36.2 Bundle safety

- [ ] Bundle unresolved không materialize được.
- [ ] Missing required tool không resolve cho execution.
- [ ] Pending approval không dispatch.
- [ ] Conflict chưa giải quyết không dispatch.
- [ ] Stale scan/eval/policy revision không materialize.
- [ ] Composite graph không chứa revoked/quarantined provider.

## 36.3 Continuous learning

- [ ] Instinct có provenance, scope, confidence, TTL và taint status.
- [ ] Không học từ untrusted instruction channel.
- [ ] Promotion project→tenant→global cần evidence riêng.
- [ ] Skill evolution luôn tạo candidate version mới.
- [ ] Poisoned instinct corpus bị chặn.
- [ ] Restart/multi-node không mất learning state.

## 36.4 Harness parity

- [ ] Mỗi adapter có enforcement matrix machine-readable.
- [ ] Không dùng chữ “supported” cho feature instruction-only mà không chú thích.
- [ ] Hook behavior được test ở host có hook.
- [ ] Memory namespace không cross-contaminate.
- [ ] Selective install/uninstall không phá custom file.
- [ ] Low-context profile có benchmark riêng.

## 36.5 Security

- [ ] Agent Surface Security corpus ≥1.000 case.
- [ ] Unicode/base64/hidden-text injection tests đạt.
- [ ] Permission graph phát hiện secret exfiltration paths.
- [ ] Imported skill instruction sections có scan receipt.
- [ ] Approval repository chống replay qua restart và replicas.
- [ ] OIDC future-iat, azp, key use và replay policy có tests.
- [ ] Stars không tham gia trust eligibility.

## 36.6 Skill Galaxy

- [ ] 128 kernel skill có behavioral tests.
- [ ] 1.024 canonical deep skill có evaluator binding.
- [ ] 64 domain cluster có editorial owner/reviewer policy.
- [ ] Specialist module không bị đếm sai thành certified skill.
- [ ] ≥4.096 deterministic rules có predicate và validator tests.
- [ ] ≥512 evaluator có calibration corpus.

## 36.7 Token và hiệu quả

- [ ] Context được chia theo work unit trước khi nén.
- [ ] Tool schemas lazy-load.
- [ ] CLI/MCP lựa chọn dựa benchmark.
- [ ] Token attribution theo category tồn tại.
- [ ] Compression có loss accounting.
- [ ] Tổng input token giảm ≥70% median trên benchmark lớn.
- [ ] Không giảm coverage để đạt token claim.
- [ ] p95 estimator error ≤8%.

## 36.8 Benchmark vượt hệ thống lớn

ForgeOS chỉ được tuyên bố vượt hệ thống 100.000 sao trên trục cụ thể khi:

- baseline được pin bằng commit/release;
- cùng model và model parameters;
- cùng task set;
- cùng tool access hoặc khác biệt được công bố;
- raw metrics và confidence interval được phát hành;
- có benchmark ngoài software engineering;
- có usability study;
- có security adversarial results;
- có reproducible token accounting;
- có ít nhất một evaluation độc lập ngoài nhóm phát triển.

---

## 37. Chiến lược tích hợp giấy phép và nguồn

- OpenCodeReview dùng Apache-2.0. Nếu tái sử dụng mã, phải giữ notice/license và đánh dấu thay đổi theo yêu cầu giấy phép. Có thể học kiến trúc và triển khai độc lập mà không sao chép code.
- ECC dùng MIT. Mã được tái sử dụng phải giữ copyright/license notice.
- Không vendoring toàn bộ repository chỉ để tăng số skill.
- Mọi imported skill/provider giữ source coordinate, commit digest, license mode và attribution.
- Tài liệu ForgeOS phải phân biệt rõ: “lấy cảm hứng”, “tương thích”, “tái sử dụng mã”, “fork” và “vendor”.
- Benchmark của repository bên ngoài được ghi là **project-reported** trừ khi ForgeOS tái lập độc lập.

---

## 38. Thứ tự nâng cấp mới được khuyến nghị

1. Sửa Executable Bundle Gate và required tools.
2. Sửa token calibration 25/33 và section materialization.
3. Execution Graph nhiều provider.
4. Scope Compiler + Coverage Ledger + Work Unit Bundler.
5. Rule Engine + Anchor + Reflection.
6. Dùng Code Review Intelligence Pack làm vertical slice và benchmark thật.
7. Viết lại 128 kernel skill.
8. Instinct Store + Continuous Learning v3.
9. Agent Surface Security Engine.
10. Harness Event Contract + selective installer.
11. Global Context Kernel v2 + CLI/MCP optimizer.
12. Mở rộng 1.024 canonical skill theo 64 domain board.
13. Thêm specialist modules/rules/evaluators theo benchmark và nhu cầu.
14. Full PostgreSQL/multi-node/sandbox.
15. Public benchmark, usability study và independent audit.

Không nên bắt đầu bằng việc sinh thêm hàng nghìn file. Vertical slice code review phải chứng minh toàn chuỗi:

```text
scope đủ
→ bundle đúng
→ rule đúng
→ context nhỏ
→ agent xử lý sâu
→ anchor chính xác
→ reflection giảm nhiễu
→ evidence đáng tin
→ learning không bị đầu độc
```

---

## 39. Kết luận nâng cấp lần 2

ForgeOS có thể vượt các kho skill lớn chỉ khi nó vượt khỏi khái niệm “kho prompt”. Kiến trúc cần kết hợp ba sức mạnh:

```text
ForgeOS Trust Kernel và Federation
+ deterministic engineering và benchmark chuyên dụng
+ harness-native skills, hooks, memory và continuous learning
```

Công thức đích:

```text
128 kernel skills đã kiểm thử
+ 1.024 canonical deep skills đa ngành
+ 3.072 specialist technique modules
+ 4.096+ deterministic rules
+ 512+ calibrated evaluators
+ Scope Compiler và Coverage Ledger
+ Work-Unit Bundler và isolated contexts
+ Anchor và Reflection Engine
+ Continuous Learning có quarantine/promotion
+ Agent Surface Security Engine
+ Global Context Kernel giảm toàn workflow
+ durable multi-node Trust Kernel
+ cross-harness one-command UX
= Deterministic Skill Intelligence Operating System
```

Sức mạnh không được đo bằng tổng file. Nó được đo bằng khả năng xử lý đủ phạm vi, chọn đúng kỹ thuật, dùng ít context, tạo đúng artifact, neo kết quả chính xác, chứng minh bằng evidence độc lập, học từ kinh nghiệm mà không học sai và hoạt động nhất quán trên dự án thật.

Nếu hoàn thành các Definition of Done của cả hai phần, ForgeOS sẽ có cơ sở kỹ thuật để cạnh tranh với những hệ thống GitHub rất lớn trên các trục cụ thể. Mục tiêu cuối cùng không phải “nhiều sao hơn bằng lời quảng cáo”, mà là tạo một hệ điều hành kỹ thuật mà cộng đồng lựa chọn vì nó **sâu hơn, đáng tin hơn, tiết kiệm hơn và mở rộng sang nhiều ngành hơn**.

---

## 40. Nguồn tham chiếu bổ sung cho Revision 2

- Alibaba OpenCodeReview repository và README: <https://github.com/alibaba/open-code-review>
- OpenCodeReview security assurance case: <https://github.com/alibaba/open-code-review/blob/main/ASSURANCE_CASE.md>
- ECC repository và cross-harness system: <https://github.com/affaan-m/ECC>
- ECC longform guide về token economics, memory và verification: <https://github.com/affaan-m/ECC/blob/main/the-longform-guide.md>
- ECC security guide về agent attack surface: <https://github.com/affaan-m/ECC/blob/main/the-security-guide.md>

Các nguồn trên được dùng để rút ra pattern kiến trúc. Tất cả claim định lượng từ dự án bên ngoài phải được tái lập trước khi dùng làm claim chính thức của ForgeOS.

