# Nolane Agent — Model Profile & Personalization Profile Completion Specification (Reality-Aligned Revision)

**Target milestone:** Checkpoint 14 — Trust, Adoption & Autonomy  
**Document type:** Gap analysis, architecture extension, implementation contract, and acceptance criteria  
**Verified baseline:** Checkpoint 13 — Progressive Experience  
**Baseline source commit:** `72f35b57aa32299bb4369eb84759c489b03ce697`  
**Status:** Planning specification; this document does not claim the described Checkpoint 14 work is already implemented  
**Revision date:** 2026-08-03

---

## 1. Mục đích

Tài liệu này xác định cách hoàn thiện hai hệ profile của Nolane dựa trên đúng kiến trúc đang tồn tại trong Checkpoint 13:

1. **Model Profile** — sự thật có kiểm chứng về base model, snapshot, deployment, local artifact, giới hạn, năng lực, chi phí, policy, health và mức phù hợp với từng nhiệm vụ.
2. **Personalization Profile** — một projection có version trên hệ Settings phân tầng, mô tả người dùng muốn Nolane trình bày, cộng tác, ghi nhớ và thông báo như thế nào.

Hai hệ phục vụ hai mục đích khác nhau:

```text
Model Profile
→ Nolane biết deployment/model nào có thể làm gì,
  trong điều kiện nào, với bằng chứng và độ mới nào.

Personalization Profile
→ Nolane biết người dùng muốn trải nghiệm và cách cộng tác như thế nào,
  trong giới hạn policy và quyền đã được cấp.
```

Các nguyên tắc khóa:

- Personalization không tự cấp thêm quyền cho agent.
- Model Profile không suy luận thuộc tính cá nhân của người dùng.
- Không tạo một Model Registry thứ tư song song với ba lớp đang có.
- Không tạo một preference database cạnh tranh với `SettingsService`.
- Không coi route, dashboard, mock test hoặc catalog entry là bằng chứng rằng capability đã chạy thành công ngoài đời thực.
- Không gọi profile “đầy đủ” chỉ vì schema rộng; độ đầy đủ phải được đo bằng provenance, freshness, eval và coverage có scope.

---

## 2. Kết luận tổng thể

### 2.1 Model Profile hiện tại

Model intelligence của Checkpoint 13 **không bắt đầu từ số 0**. Nó đã có ba lớp vận hành:

1. `src/model-profiles/*` — canonical/advanced registry, exact profile skeleton, family/size template, inference, discovery merge và export receipt.
2. `src/providers/model-profile-registry.mjs` — compatibility projection phục vụ provider/runtime/UI hiện hữu.
3. `src/model-management/*` — health, policy, recommendation, portfolio, dossier và management receipt.

Baseline catalog được kiểm tra có:

- 567 exact model profile.
- 75 family/size template.
- 44 publisher.
- 15 provider family.
- 285 local/self-hostable profile.
- 514 profile có coding capability được gán dữ liệu.
- 457 profile có reasoning capability được gán dữ liệu.
- 218 profile có tool calling được gán dữ liệu.
- 218 profile có structured output được gán dữ liệu.
- 6/567 profile có context window xác định.
- 3/567 profile có max output token xác định.
- 2/567 profile có pricing xác định.
- 0 discovery record trong catalog xuất sẵn.
- 0/567 profile có `verifiedAt`.
- Phần lớn profile chỉ có một provenance source tổng quát.

Những con số trên không nói rằng các model còn lại không hỗ trợ capability. Chúng nói rằng registry **chưa có đủ bằng chứng để gán một kết luận có scope**.

Kết luận:

> CP14 không xây lại Model Profile. CP14 phải hội tụ ba lớp hiện hữu quanh một canonical truth plane bền vững, thêm field-level provenance, freshness, discovery ledger, eval receipt, execution observations và UI giải thích routing.

### 2.2 Personalization Profile hiện tại

Checkpoint 13 đã có `SettingsService` với nguồn chân lý phân tầng:

```text
Defaults < User < Project < Local machine
```

Các key cá nhân hóa hiện hữu gồm:

- `experience.level`
- `general.language`
- `general.defaultIntent`
- `personalization.explanationDepth`
- `personalization.responseStyle`
- `personalization.askBeforeAmbiguousChanges`
- `personalization.showReasoningSummary`
- `personalization.preferredDocumentationLanguage`
- `appearance.*`
- `accessibility.*`
- `memory.*`
- `notifications.*`
- `data.*`
- `permissions.*`
- `autopilot.*`
- `updates.*`
- `models.*`

Các value hiện đã có thể được tải, hiển thị, preview và ghi từ Settings UI. Nhưng hiện còn thiếu:

- Onboarding state độc lập với app version.
- First-run personalization flow.
- Provenance theo nguồn thay đổi preference.
- History và undo.
- Import/export profile có schema.
- Runtime consumption contract cho planner, context composer, agent loop và UI story.
- Cơ chế đồng bộ chắc chắn giữa experience pill, local cache và effective Settings.
- Recommendation policy không tự ghi đè lựa chọn rõ ràng.

Kết luận:

> Personalization Profile phải là projection/export contract trên effective Settings cùng một metadata ledger nhỏ cho provenance/history. Nó không được trở thành database chứa bản sao preference và cạnh tranh với `SettingsService`.

### 2.3 Những điều tài liệu này sửa so với kế hoạch sơ bộ

1. Không gọi hệ mới là “Model Profile v2” một cách mơ hồ, vì compatibility API hiện đã sử dụng nhãn `nolane.model-profiles.v2`, trong khi exact profile có `schemaVersion: 1.0.0`.
2. Không giả định chỉ có một profile phẳng; schema đích tách base model, snapshot, deployment và local artifact.
3. Không tạo `PersonalizationProfileStore` làm nguồn chân lý độc lập.
4. Không thêm enum chưa tồn tại vào Settings mà không có catalog migration.
5. Không đưa `ui-dist` thành nơi chỉnh tay; UI phải sửa trong `ui-v3` rồi build và receipt sang `ui-dist`.
6. Không tuyên bố model/provider parity dựa trên mock/contract test.
7. Không coi health observation tạm thời là capability truth vĩnh viễn.
8. Không cho preference về autonomy vượt qua workspace trust, capability grants, approval policy hoặc project/local policy.

---

# PHẦN I — MODEL PROFILE

## 3. Kiến trúc Model Intelligence hiện hữu

### 3.1 Canonical/advanced registry

`src/model-profiles/*` hiện chịu trách nhiệm cho:

- Exact model profiles.
- Family và size templates.
- Conservative fallback.
- Unknown/null semantics.
- Alias/canonical identity.
- Discovery merge.
- Profile hashing và export receipt.
- Inference có confidence.

Đây phải trở thành canonical model-truth plane của CP14.

### 3.2 Operational compatibility registry

`src/providers/model-profile-registry.mjs` đang phục vụ provider-oriented behavior và các contract cũ. Lớp này phải tiếp tục tồn tại trong CP14 dưới dạng adapter/projection:

```text
Canonical truth record
→ compatibility projection
→ existing provider/runtime/UI contracts
```

Nó không được tiếp tục phát triển thành một truth store độc lập.

### 3.3 Model management plane

`src/model-management/*` đã có các khái niệm:

- Health ledger.
- Policy engine.
- Recommendations.
- Portfolio selection.
- Dossier.
- Snapshot/receipt.

CP14 phải nối các thành phần này vào canonical registry và durable observation ledger, thay vì để health/policy/dossier đọc các representation không đồng nhất.

### 3.4 Existing API surface phải giữ tương thích

Các endpoint hiện hữu gồm:

```text
GET  /api/model-profiles
POST /api/model-profiles/discover
POST /api/model-profiles/probe
GET  /api/model-management/snapshot
POST /api/model-management/recommend
POST /api/model-management/portfolio
POST /api/model-management/observations
GET  /api/model-management/dossier
```

CP14 có thể thêm endpoint hoặc response field, nhưng phải:

- Giữ compatibility alias.
- Có schema version rõ.
- Không thay nghĩa `null`, `false` và `0`.
- Không làm UI/provider cũ đọc sai dữ liệu.
- Có contract test cho projection cũ và canonical mới.

---

## 4. Quyết định schema và naming

### 4.1 Không dùng nhãn “v2” chưa phân giải

Trước khi đổi schema, CP14 phải lập một ADR xác định:

- Tên canonical schema mới.
- Tên compatibility export hiện tại.
- Migration từ exact profile `1.0.0`.
- Cách giữ `nolane.model-profiles.v2` cho consumer cũ.

Khuyến nghị:

```text
Canonical entity schema family:
- nolane.model-base.v1
- nolane.model-snapshot.v1
- nolane.model-deployment.v1
- nolane.local-model-artifact.v1
- nolane.model-evaluation.v1
- nolane.model-observation.v1

Compatibility export:
- giữ nolane.model-profiles.v2 trong thời gian migration
```

Tên cuối cùng có thể khác, nhưng không được tạo collision.

### 4.2 Tách bốn thực thể

```text
Base Model
├── owner/publisher
├── family/lineage
├── architecture
├── tokenizer
├── native modalities
└── weights/license

Model Snapshot
├── immutable hoặc time-scoped identity
├── release/knowledge dates
├── behavior change
├── lifecycle
└── replacement relationship

Deployment Variant
├── serving provider
├── endpoint model ID
├── region/account/tier
├── exposed context/output limits
├── pricing/quota
├── provider behavior
└── service health

Local Artifact Variant
├── format/quantization
├── runtime compatibility
├── artifact hashes
├── RAM/VRAM requirements
├── hardware measurements
└── local licensing constraints
```

Một API deployment và một GGUF Q4 của cùng base model không được dùng chung pricing, context cap, latency, RAM, tool reliability hoặc policy.

### 4.3 Canonical IDs

Các ID phải deterministic và có alias history:

```text
baseModelId
snapshotId
modelDeploymentId
localArtifactId
profileAliasId
```

Mọi alias cần:

- `effectiveAt`.
- `expiresAt` hoặc `null`.
- `source`.
- `scope`.
- `replacementId` nếu có.
- receipt hash.

---

## 5. Canonical model truth fields

### 5.1 Identity và lineage

Bổ sung hoặc chuẩn hóa:

- `modelOwner` tách khỏi `servingProvider`.
- `baseModelId`.
- `parentModelIds[]`.
- `fineTuneOf`.
- `distilledFrom[]`.
- `mergedFrom[]`.
- `instructionTune`.
- `checkpointFamily`.
- `snapshotDate`.
- `releaseChannel`: stable, preview, beta, experimental.
- `semanticVersion` khi provider công bố.
- Alias history.

### 5.2 Lifecycle và availability

- `announcedAt`.
- `releasedAt`.
- `deprecatedAt`.
- `retirementAt`.
- `lastAvailableAt`.
- `replacementCandidates[]`.
- `migrationNotes`.
- `regionsAvailable[]`.
- `accountTierRequirements[]`.
- `previewRestrictions[]`.
- `availabilityStatus`: available, restricted, unavailable, unknown.

Lifecycle phải có scheduler và warning, nhưng warning không được tự thay đổi provider/model selection đã bị policy khóa.

### 5.3 Architecture và tokenizer

Schema phải chứa được:

- Dense, MoE, hybrid, state-space hoặc multimodal architecture.
- Total parameters và active parameters.
- Experts và experts-per-token.
- Hidden size, layer count, attention type khi có nguồn mạnh.
- Native tokenizer ID và family.
- Vocabulary size.
- Special-token behavior.
- Chat-template ID và version.
- Tool-call token protocol.
- Reasoning token representation.

Không bắt buộc mọi trường phải biết. Unknown vẫn là unknown.

### 5.4 Context và output limits

Tách rõ:

- Native context.
- Provider-exposed context.
- Maximum input.
- Maximum output.
- Maximum reasoning budget.
- Cached-prefix limit.
- File/image/audio/video count và size limits.
- Context extension method.
- Compaction compatibility.
- Long-context quality bands.
- Needle retrieval reliability.
- Instruction retention.
- Multi-file coherence.

`contextWindow = 1M` không được diễn giải thành “hoạt động đáng tin ở 1M” nếu chưa có eval.

### 5.5 Modalities

Mỗi modality cần support state và scope:

- Text input/output.
- Image input/output.
- Audio input/output.
- Video input/output.
- File/document input.
- Screen/computer input.
- Embedding output.
- MIME types.
- Count/size/duration/resolution limits.
- OCR behavior.
- Native hay adapter-based.
- Streaming support.

### 5.6 Tool calling và agent protocol

Không chỉ lưu `supported=true`. Cần:

- Tool schema dialect.
- Strict JSON-schema conformance.
- Parallel tool calls.
- Nested object, enum, optional và null reliability.
- Tool choice/forced tool support.
- Maximum tool count và schema size.
- Tool-result token limits.
- Multi-turn tool-state retention.
- Duplicate-call rate.
- Hallucinated-tool rate.
- Invalid-argument rate.
- Recovery after tool error.
- MCP compatibility.
- Computer-use compatibility.

Reliability phải đến từ eval hoặc runtime observations có scope.

### 5.7 Structured output

- JSON mode.
- Strict schema mode.
- Grammar/regex constraints.
- Streaming structured output.
- Schema complexity ceiling.
- Ref/union/recursive schema support.
- Validation success rate.
- Repair recommendation.
- Provider-specific incompatibilities.

### 5.8 Reasoning behavior

- Reasoning supported.
- Supported modes/levels.
- Default mode.
- Controllability.
- Hidden reasoning vs user-safe summary.
- Maximum reasoning budget.
- Cost/latency multiplier.
- Tool use during reasoning.
- Behavior after compaction.
- Stability by decoding settings.
- Required reasoning metadata preservation.

Không lưu hoặc yêu cầu raw private chain-of-thought.

### 5.9 Capability matrix

Capability phải được tách thành các nhiệm vụ cụ thể:

- Repository navigation.
- Code search.
- Local bug fixing.
- Multi-file feature work.
- Large refactor.
- Test generation/repair.
- Build/debug loop.
- Frontend implementation.
- Visual UI reasoning.
- Backend/API design.
- Database migration.
- Security review.
- Performance optimization.
- Documentation.
- Research/citation.
- Planning.
- Long-horizon execution.
- Browser/computer use.
- Shell/tool orchestration.
- Code review.
- Merge-conflict resolution.

Mỗi capability observation cần:

```json
{
  "score": 0.0,
  "confidence": 0.0,
  "sampleSize": 0,
  "lastEvaluatedAt": null,
  "evalSuiteVersion": null,
  "scope": {},
  "receipts": []
}
```

### 5.10 Task envelope và autonomy risk

- Recommended task classes.
- Maximum safe task class.
- Minimum verifier requirement.
- Independent-review requirement.
- Allowed autonomy ceiling.
- Change-size/file-count ceiling.
- Risk classes bị cấm tự thực thi.
- Sandbox requirement.
- Retry budget.
- Fallback model class.

Model Profile chỉ mô tả ceiling được chứng minh. Quyền thực tế vẫn là giao của:

```text
Model task envelope
∩ project policy
∩ workspace trust
∩ capability grant
∩ approval state
∩ machine policy
```

### 5.11 Economics

- Input/output pricing.
- Cached read/write pricing.
- Reasoning pricing.
- Image/audio/video units.
- Batch/fine-tuning pricing.
- Minimum charge.
- Currency/region/tax caveat.
- Effective date.
- Official source.
- Free allowance.
- Estimated mission cost bands.
- Cost uncertainty.

Pricing là time-series record; không ghi đè lịch sử.

### 5.12 Service limits và concurrency

- RPM, TPM, RPD.
- Concurrent requests/jobs.
- Queue behavior.
- Burst limit.
- Account tier và region.
- Retry-after behavior.
- Official/observed/account-specific source.
- Observed time và expiry.

### 5.13 Performance và hardware

Cloud deployment:

- Time to first token.
- Output throughput.
- P50/P95 latency.
- Tool-call latency.
- Long-context latency.
- Error/availability rate.

Local artifact:

- Runtime and version.
- Format/quantization.
- Artifact size/hash.
- Minimum/recommended RAM and VRAM.
- CPU/GPU architecture.
- Context memory multiplier.
- Load time.
- Tokens/second by hardware fingerprint.
- Offload configuration.
- Multi-GPU support.

Mọi benchmark phải gắn exact runtime, hardware fingerprint, context, batch và decoding config.

### 5.14 License, policy và data governance

- Model/weight license.
- Redistribution/commercial/fine-tuning restrictions.
- Provider acceptable-use policy.
- Data retention.
- Training-on-input default.
- Zero-retention option.
- Region/data residency.
- Enterprise agreement requirement.
- Sensitive-data suitability.
- Last policy review.

Nếu project policy yêu cầu fail-closed cho dữ liệu nhạy cảm, router không được chọn deployment có policy unknown.

### 5.15 Harness compatibility

Đây là khoảng trống ưu tiên vì tác động trực tiếp đến agent runtime:

- Prompt/chat template.
- Context compiler strategy.
- Tool schema strategy.
- Patch strategy.
- Retry strategy.
- Verification strategy.
- Max parallel lanes.
- Preferred roles: scout/planner/implementer/reviewer/verifier.
- Preferred task size.
- Compaction policy.
- Decoding defaults theo task.
- Fallback chain.
- Known bad patterns.
- Required adapters.

Recommendation phải có provenance và eval receipt, không phải hard-coded marketing claim.

---

## 6. Provenance, freshness và conflict

### 6.1 Field-level provenance

Profile-level confidence là chưa đủ. Mỗi fact phải có:

```json
{
  "path": "context.maxOutputTokens",
  "value": 32768,
  "sourceType": "official-provider-doc",
  "sourceId": "...",
  "observedAt": "...",
  "verifiedAt": "...",
  "confidence": 0.98,
  "scope": {
    "provider": "...",
    "region": "...",
    "accountTier": "...",
    "snapshotId": "..."
  },
  "receiptSha256": "..."
}
```

### 6.2 Source precedence

Khuyến nghị:

```text
Scoped official provider API observation
> scoped official provider/model documentation
> signed Nolane evaluation
> trusted catalog import
> family/size inference
> provisional unknown
```

Source precedence không cho phép ghi đè im lặng. Nếu hai nguồn mạnh mâu thuẫn, tạo conflict record.

### 6.3 Freshness classes

Mỗi fact có:

- `fresh`.
- `stale`.
- `expired`.
- `conflicted`.
- `unknown`.

TTL đề xuất:

| Nhóm | TTL |
|---|---:|
| Provider health/availability | phút đến giờ |
| Rate limits/account scope | giờ đến ngày |
| Pricing | ngày |
| Context/output limits | ngày đến tuần |
| Tool/structured-output behavior | theo snapshot/eval version |
| Lifecycle/deprecation | ngày |
| Architecture/license | dài hạn nhưng có review date |

### 6.4 Conflict resolver

Khi source khác nhau:

- Giữ tất cả observations.
- Chọn scoped fact cụ thể nhất cho projection.
- Tạo warning và receipt.
- Không biến conflict thành unknown im lặng.
- Fail-closed nếu conflict ảnh hưởng quyền, data policy, context safety hoặc tool conformance.

---

## 7. Discovery và catalog synchronization

### 7.1 Durable discovery ledger

Catalog xuất hiện tại có `discoveryRecords: 0`. CP14 phải lưu discovery observations riêng với canonical profile:

- Provider list-model response đã sanitize.
- Account-visible model IDs.
- Region/account tier.
- Alias mappings.
- Availability.
- Discovery timestamp.
- Response hash.
- Diff so với lần trước.
- Adapter/provider version.
- Error/backoff state.

Không lưu credential hoặc raw payload có secret.

### 7.2 Scheduler

- Manual refresh.
- Refresh khi provider kết nối thành công.
- Periodic refresh có jitter/backoff.
- Refresh trước routing khi fact bắt buộc đã expired.
- Provider-specific rate limits.
- Offline-safe behavior.
- Duplicate refresh suppression.

### 7.3 Projection update

Discovery không trực tiếp ghi đè capability truth. Pipeline đúng:

```text
Provider discovery
→ sanitized observation
→ canonical merge/conflict
→ compatibility projection refresh
→ management snapshot refresh
→ UI notification/audit
```

---

## 8. Evaluation và runtime observations

### 8.1 Eval suite tối thiểu

- Tool-schema conformance.
- Structured-output validity.
- Repository navigation.
- Single-file bug fix.
- Multi-file feature.
- Test generation/repair.
- Refactor safety.
- Long-context retrieval/instruction retention.
- Citation correctness.
- Browser/tool recovery.
- Security-sensitive policy adherence.
- Latency, throughput và cost.

### 8.2 Eval receipt

Mỗi eval cần:

- Exact base/snapshot/deployment/artifact identity.
- Prompt/test suite version.
- Harness/tool protocol version.
- Model request config.
- Provider/hardware scope.
- Raw artifact hashes.
- Scorer version.
- Metrics và pass/fail.
- Receipt SHA-256.

### 8.3 Runtime observation wiring

`POST /api/model-management/observations` đã tồn tại, nhưng CP14 phải nối observations tự động từ execution path:

- Request success/failure.
- Authentication/rate-limit failure.
- Latency và token usage.
- Tool-call parse/conformance.
- Structured-output validation.
- Retry/fallback.
- Context overflow.
- Provider/model identity returned by API.

Runtime observation có TTL, scope và sample size. Nó không được tự biến thành permanent capability truth.

### 8.4 Benchmark không phải chân lý tuyệt đối

Router kết hợp:

```text
Task requirements
+ capability evidence
+ deployment health
+ context/output fit
+ policy/data constraints
+ cost/latency budget
+ user preference
+ verification requirement
```

Không chọn model chỉ bằng một bảng xếp hạng tổng hợp.

---

## 9. Model Profile UI

### 9.1 Giữ và mở rộng UI hiện hữu

Progressive Settings UI hiện đã có discovery/probe surface. CP14 phải tái sử dụng endpoint và controller hiện có trước khi thêm API mới.

### 9.2 Model Catalog

- Search/filter theo provider, lifecycle, modality, capability, local/cloud, cost, freshness và confidence.
- Badge `verified`, `observed`, `inferred`, `stale`, `unknown`, `conflicted`.
- Không hiển thị unknown như `false`, `0` hoặc “unsupported”.
- Cho biết record là base, snapshot, deployment hay local artifact.

### 9.3 Model Dossier

Các phần:

1. Overview.
2. Identity/lineage/lifecycle.
3. Context/modalities.
4. Tool/structured output/reasoning.
5. Capability/evaluations.
6. Performance/economics.
7. Deployment/local hardware.
8. Safety/license/data policy.
9. Provenance/freshness/conflicts.
10. History/observations.

### 9.4 Comparison

So sánh 2–5 **deployment/artifact profiles**, không chỉ base model:

- Task suitability.
- Confidence/sample size.
- Context quality.
- Tool reliability.
- Cost/latency.
- Availability.
- Data policy.
- Hardware requirement.

### 9.5 Routing explanation

Mỗi routing decision phải trả lời:

- Candidate nào được xem xét.
- Deployment nào được chọn.
- Fact/eval nào hỗ trợ.
- Candidate nào bị loại và vì sao.
- Unknown/conflict nào còn lại.
- Cost/latency estimate.
- Fallback chain.
- Verification policy.
- Receipt.

---

## 10. Migration và compatibility của Model Profile

- Giữ đọc được exact profiles và compatibility export hiện tại.
- Migration deterministic và idempotent.
- Unknown fields được giữ khi round-trip.
- `null` không thành `false` hoặc `0`.
- Alias cũ map tới canonical IDs mới.
- Dossier/receipt cũ vẫn truy xuất được.
- Routing decision cũ replay bằng catalog snapshot tương ứng.
- Nếu migration lỗi, profile cũ read-only; không destructive write.
- Health ledger và discovery ledger phải durable hoặc replayable.
- Compatibility projection có golden tests cho existing consumers.

---

## 11. Acceptance gates cho Model Profile

### Architecture

- [ ] ADR giải quyết naming/schema collision.
- [ ] Ba lớp hiện tại có ownership rõ.
- [ ] Canonical registry là nguồn chân lý.
- [ ] Compatibility registry chỉ là projection/adapter.
- [ ] Management plane đọc canonical snapshot và durable observations.

### Schema và integrity

- [ ] Base/snapshot/deployment/local artifact được tách.
- [ ] Validators và idempotent migrations.
- [ ] Field-level provenance.
- [ ] Unknown/false/zero semantics PASS.
- [ ] Deterministic receipt PASS.
- [ ] Alias/history round-trip PASS.

### Discovery và freshness

- [ ] Discovery record thật cho provider được kết nối.
- [ ] TTL/stale/expired/conflicted handling.
- [ ] Alias/lifecycle reconciliation.
- [ ] Conflict resolver.
- [ ] Offline/backoff behavior.

### Data completeness

- [ ] Mọi production deployment có context/output limit verified hoặc bị chặn rõ.
- [ ] Mọi paid deployment có timestamped pricing hoặc explicit unknown.
- [ ] Mọi deployment được cấp quyền tool execution có conformance receipt.
- [ ] Mọi local artifact có format, quantization, hash và hardware requirement.
- [ ] Mọi production deployment có license/data-policy review.

### Evaluation và observations

- [ ] Eval suite versioned.
- [ ] Eval receipts reproducible.
- [ ] Runtime observations tự động nối từ execution path.
- [ ] Health observation có TTL/scope/sample size.
- [ ] Không có self-reported quality score không bằng chứng.

### UI và routing

- [ ] Existing discovery/probe vẫn hoạt động.
- [ ] Dossier đầy đủ.
- [ ] Comparison UI hoạt động.
- [ ] Routing explanation receipt hoạt động.
- [ ] Unknown/conflict được trình bày đúng.
- [ ] No fake control hoặc dead action.

### External certification

- [ ] Provider-specific live probes được gắn scope.
- [ ] Local hardware measurements chạy trên declared hardware.
- [ ] Mock/contract test không bị báo cáo như real-provider parity.
- [ ] Unsupported/unavailable external gates được ghi riêng.

---

# PHẦN II — PERSONALIZATION PROFILE

## 12. Nguyên tắc kiến trúc

1. Người dùng kiểm soát mọi preference.
2. Settings phân tầng vẫn là nguồn có thẩm quyền.
3. Profile là projection, không phải duplicate store.
4. Onboarding state độc lập với app version.
5. Không hỏi cloud/local trong onboarding.
6. Không tự nâng quyền/autonomy.
7. Experience switching luôn hai chiều và trực tiếp.
8. Preference tách khỏi conversation/project memory content.
9. Explicit choice ưu tiên suggestion/inference.
10. Không suy luận thuộc tính nhạy cảm.
11. Update không chạy lại onboarding.
12. Migration không làm mất unknown fields.
13. Project/local/machine policy có thể siết chặt hơn user preference.
14. Mọi runtime consumption phải bounded và explainable.

---

## 13. Nguồn chân lý và projection contract

### 13.1 SettingsService vẫn authoritative

Current paths:

```text
<dataDir>/settings/user.json
<project>/.forge/settings.json
<dataDir>/settings/projects/<projectId>.local.json
```

Effective value:

```text
Defaults < User < Project < Local machine
```

Personalization Profile không được ghi một bản sao độc lập của các effective values.

### 13.2 Profile projection

Profile service đọc:

- Settings catalog metadata.
- User-layer values.
- Effective values.
- Winning layer.
- Preference source metadata.
- Onboarding state.
- Recommendation/history ledger.

Rồi xuất:

```json
{
  "schema": "nolane.personalization-profile.v1",
  "profileId": "default",
  "settingsCatalogVersion": "...",
  "userValues": {},
  "effectiveValues": {},
  "effectiveSources": {},
  "preferenceMetadata": {},
  "onboarding": {},
  "recommendations": [],
  "createdAt": "...",
  "updatedAt": "...",
  "receiptSha256": "..."
}
```

### 13.3 Metadata ledger

Một ledger riêng chỉ chứa metadata không có sẵn trong Settings:

- Source: explicit, onboarding, accepted recommendation, migration, policy.
- ChangedAt.
- Previous value hash.
- Actor/surface.
- Undo reference.
- Recommendation state.
- Receipt hash.

Ledger không chứa secret và không thay thế value store.

### 13.4 Không dùng behavioral inference làm implicit write

Nếu CP14 phân tích pattern sử dụng, kết quả chỉ trở thành suggestion:

```text
observed behavior
→ recommendation proposal
→ user accepts
→ SettingsService writes user layer
→ metadata ledger records accepted recommendation
```

---

## 14. Onboarding State

Onboarding state chỉ trả lời wizard đã hoàn thành hay chưa:

```json
{
  "schema": "nolane.onboarding.v1",
  "completed": true,
  "completedAt": "ISO-8601",
  "schemaVersion": 1,
  "source": "guided|recommended-defaults|skipped|existing-user-upgrade",
  "lastReviewedAt": "ISO-8601"
}
```

Rules:

- App update không reset `completed`.
- Existing mature data mà thiếu record được xử lý là upgrade, không phải fresh install.
- New onboarding schema chỉ hiển thị optional review card.
- Corrupt onboarding record không được dẫn tới silent full wizard nếu mature data tồn tại.

---

## 15. Baseline Settings keys và enum chính xác

CP14 phải dùng enum hiện hữu trừ khi có catalog migration rõ ràng.

### 15.1 Experience

```text
experience.level:
- everyday
- workspace
- studio
- expert
```

### 15.2 Communication

```text
personalization.explanationDepth:
- concise
- balanced
- detailed
- research

personalization.responseStyle:
- direct
- collaborative
- teacher
- reviewer
```

### 15.3 Appearance

```text
appearance.theme:
- system
- nocturne
- obsidian
- graphite
- aurora
- snow
- paper

appearance.accent:
- violet
- blue
- cyan
- rose
- amber
- emerald

appearance.density:
- comfortable
- compact

appearance.motion:
- system
- full
- reduced
```

Do đó các value `brief`, `research-grade`, `pink`, `dense` hoặc `none` không được đưa vào profile baseline nếu chưa có Settings catalog migration, UI support, i18n và compatibility tests.

### 15.4 Existing keys trước khi thêm mới

CP14 ưu tiên sử dụng các key hiện hữu:

- `general.language`.
- `general.defaultIntent`.
- `personalization.askBeforeAmbiguousChanges`.
- `personalization.showReasoningSummary`.
- `personalization.preferredDocumentationLanguage`.
- `accessibility.*`.
- `memory.*`.
- `notifications.*`.
- `data.*`.
- `permissions.*`.
- `autopilot.*`.
- `updates.*`.
- `models.*`.

Mỗi key mới phải có:

- Settings catalog definition.
- Defaults.
- Validation.
- i18n label/help.
- User/project/local behavior.
- Import/export behavior.
- Migration.
- Tests.

---

## 16. Profile sections

### 16.1 Primary uses

Primary uses chưa có một canonical multi-value field đầy đủ. CP14 có hai lựa chọn hợp lệ:

1. Giữ `general.defaultIntent` làm một baseline intent và lưu onboarding selections trong metadata/recommendation context; hoặc
2. Thêm `personalization.primaryUses` qua Settings catalog migration.

Khuyến nghị thêm field có enum:

```text
everyday-chat
writing-summarization
learning-research
planning-projects
software-building
advanced-agent-operations
```

Nó là preference sản phẩm, không phải identity attribute.

### 16.2 Experience preference

Profile cần biểu diễn:

- Effective default level từ `experience.level`.
- Last active level trong bounded session/view state.
- Optional per-project level sau này.
- Direct switch availability.

`lastLevel` không nên ghi đè `experience.level` ở mỗi route change nếu việc đó gây write churn. Có thể lưu trong session restore state và chỉ cập nhật default khi user chọn “đặt làm mặc định”.

### 16.3 Language

Baseline phải map vào key hiện có:

- UI language.
- Preferred documentation language.
- Response language nếu được thêm phải có catalog migration.
- Locale/date/number formatting nếu được thêm phải có catalog migration.

Không được có tình trạng shell tiếng Việt nhưng Settings hoặc onboarding tự trở về tiếng Anh ngoài ý muốn.

### 16.4 Communication

Baseline:

- Explanation depth.
- Response style.
- Ask before ambiguous changes.
- Show reasoning summary.
- Preferred documentation language.

Extension có thể gồm summary-first, citation preference hoặc technical-term density, nhưng chỉ sau khi key được khai báo chính thức.

`showReasoningSummary` là user-safe explanation, không phải raw private chain-of-thought.

### 16.5 Collaboration và approvals

Profile có thể điều chỉnh:

- Cách trình bày plan.
- Mức hỏi lại khi mơ hồ.
- Review format.
- Approval grouping.
- Default task intent.

Nhưng effective behavior luôn bị siết bởi:

```text
machine/project policy
> workspace trust
> capability grants
> approval requirements
> user preference
```

### 16.6 Agent visibility / Execution Story

CP14 có thể thêm các settings cho:

- Story/timeline/technical default view.
- Show files read/changed.
- Show commands/tools/skills/subagents.
- Show model choice.
- Show cost/token usage.
- Group low-level events.
- Auto-expand errors.

Các key này phải map tới projection từ durable events hiện hữu. Không tạo event giả chỉ để làm UI sống động.

### 16.7 Appearance và accessibility

Profile export phải bao gồm các existing appearance/accessibility settings và winning layer. Accessibility không bị reset khi đổi theme.

Nếu thêm font scale, high contrast, larger targets hoặc blur controls, phải đi qua catalog migration và visual/accessibility tests.

### 16.8 Memory

Tách rõ:

- Preference về có dùng memory hay không.
- Retention/configuration.
- Actual memory records.

Profile chỉ chứa preference và policy summary. Actual conversation/project memory ở store chuyên biệt.

Rules:

- Sensitive memory off/fail-safe theo policy.
- Project boundary được giữ.
- Tắt memory không tự xóa records.
- Xóa/export memory là action riêng có confirmation và receipt.

### 16.9 Notifications

Profile projection dùng `notifications.*` hiện hữu. Nếu thêm quiet hours, update-ready hoặc recovery notification fields, phải thêm qua catalog migration.

Update notification phải hiện trong mọi experience level, không chỉ Expert.

### 16.10 Privacy và data controls

Profile có thể biểu diễn effective preferences cho:

- Diagnostic/crash reporting.
- Log retention.
- Export behavior.
- Auto-redaction.
- Local-only/no-history session.

Không gộp “reset profile” với “xóa conversation/project/memory”.

---

## 17. Preference provenance và history

Mỗi preference metadata record:

```json
{
  "path": "personalization.explanationDepth",
  "source": "explicit|onboarding|accepted-recommendation|migration|project-policy|local-policy|default",
  "layer": "default|user|project|local",
  "changedAt": "ISO-8601",
  "previousValueHash": "...",
  "actor": "settings-ui|onboarding|migration|policy",
  "overridable": true,
  "receiptSha256": "..."
}
```

Precedence của value do SettingsService quyết định. Metadata chỉ giải thích nguồn.

Không dùng một precedence list riêng làm thay đổi semantics của Settings layers.

History UI cần:

- Trường nào thay đổi.
- Old/new value hoặc redacted diff.
- Surface/actor.
- Layer.
- Thời gian.
- Undo khi hợp lệ.

---

## 18. Runtime consumption contract

### 18.1 Bounded personalization context

Profile service tạo một packet nhỏ, không chứa toàn bộ settings:

```json
{
  "language": "vi",
  "explanationDepth": "detailed",
  "responseStyle": "collaborative",
  "askBeforeAmbiguousChanges": true,
  "showReasoningSummary": true,
  "preferredDocumentationLanguage": "vi",
  "defaultIntent": "...",
  "visibilityLevel": "workspace",
  "receipt": "sha256"
}
```

### 18.2 Consumers

- Onboarding recommendations.
- Progressive UI shell.
- Mission planner presentation.
- Context composer.
- Agent response formatter.
- Execution Story renderer.
- Documentation/artifact language selector.
- Notification coordinator.
- Model router chỉ với soft preferences đã cho phép.

### 18.3 Không được điều khiển bởi profile

Personalization packet không được:

- Cấp filesystem/network/shell/browser permission.
- Bật unrestricted autopilot.
- Bỏ qua approval.
- Mở rộng workspace root.
- Chọn provider vi phạm data policy.
- Vượt qua model task envelope.
- Tắt verifier bắt buộc.

### 18.4 Explainability

Khi preference ảnh hưởng output, UI có thể giải thích ngắn:

> Trả lời chi tiết bằng tiếng Việt theo thiết lập người dùng.

Không cần hiển thị internal prompt hoặc hidden reasoning.

---

## 19. Personalization UI

### 19.1 Profile Overview

Hiển thị:

- Effective experience.
- Language.
- Communication style.
- Memory/notification/privacy summary.
- Winning layer.
- Recommendation đang chờ.
- Last change.

### 19.2 Edit by section

UI nên tái sử dụng Settings catalog renderer, không tạo form schema thứ hai:

- Usage & intent.
- Experience.
- Language.
- Communication.
- Collaboration.
- Agent visibility.
- Appearance.
- Accessibility.
- Memory.
- Notifications.
- Privacy.

### 19.3 Reset

- Reset field ở user layer.
- Reset section ở user layer.
- Reset user personalization.
- Không xóa project/local policy.
- Không xóa conversation, mission, project hoặc memory records.

### 19.4 Import/export

- Export schema/version/catalog version.
- Preview diff trước apply.
- Validation và conflict summary.
- Unknown-field retention.
- Không export credential/secret.
- Cho phép chỉ export preference, không memory content.
- Apply qua `SettingsService`, không ghi file value song song.

### 19.5 Recommendation UI

- Recommendation có rationale và affected key.
- Accept/dismiss.
- Không auto-apply.
- Không đề xuất tăng autonomy nếu chưa có security-specific flow.

---

## 20. First-run personalization

### 20.1 Product rule

- Tối đa bốn màn hình.
- Có recommended defaults ngay từ màn hình đầu.
- Có Skip for now.
- Không hỏi cloud/local.
- Không bắt provider connection.
- Không tự bật unrestricted autonomy.

### 20.2 Screen 1 — Language và primary use

- Tiếng Việt / English / System.
- Một hoặc nhiều primary use.

### 20.3 Screen 2 — Collaboration

- Explanation depth dùng enum hiện hữu.
- Response style dùng enum hiện hữu.
- Ask-before-ambiguous behavior.
- Optional activity visibility preset.

### 20.4 Screen 3 — Experience và appearance

- Everyday / Workspace / Studio / Expert.
- Theme/accent/density/motion dùng exact catalog enums.
- Preview.
- Giải thích có thể đổi lại bất kỳ lúc nào.

### 20.5 Screen 4 — Memory, notifications và privacy

- Memory preference.
- Mission completion/approval/error/update notifications.
- Diagnostic/crash reporting nếu key đã tồn tại hoặc được migrate.

### 20.6 First-run detection

```text
valid completed onboarding record
→ skip

mature settings/projects/missions/user data
→ mark existing-user-upgrade and skip

enterprise/environment disables onboarding
→ skip

otherwise
→ show onboarding
```

---

## 21. Experience switching và profile

### 21.1 Direct switcher

Checkpoint 13 cyclic pill phải được thay bằng destination menu hỗ trợ mọi cặp chuyển đổi.

### 21.2 Persistence

- Default level lưu qua user-layer Settings.
- Temporary current level có thể nằm trong session restore state.
- LocalStorage chỉ là bounded cache, không authoritative.
- Cache mismatch phải được reconciled từ effective Settings/session state.

### 21.3 State preservation

Trước transition capture:

- Route.
- Conversation/thread.
- Mission/project.
- Draft/attachments.
- Selected tab.
- Open file/artifact.
- Pending approval.
- Running process references.
- Panel/summary state.

Transition không restart mission, không duplicate task và không đổi quyền.

---

## 22. Update và migration của Personalization

### 22.1 Preservation

Sau update phải giữ:

- Onboarding completion.
- User-layer settings.
- Effective experience/language/theme.
- Preference provenance/history.
- Session/draft state.
- Memory settings và actual records.
- Notification/privacy preferences.
- Project/local overrides.

### 22.2 Migration

```text
pre-update snapshot
→ install new binary
→ open old settings/profile metadata read-only
→ validate
→ migrate temporary records
→ validate invariants
→ atomic replace
→ post-update health
→ keep last-known-good snapshot
```

Nếu lỗi:

- Không ghi đè bản cũ.
- Không reset về defaults.
- Không chạy lại onboarding.
- Mở recovery surface.
- Cho phép diagnostics/retry/last-known-good.

### 22.3 Forward compatibility

Unknown fields trong imported/exported profile phải được giữ hoặc profile chuyển read-only. Version cũ không được silently delete field mới.

---

## 23. Acceptance gates cho Personalization

### Source-of-truth

- [ ] Values chỉ được ghi qua `SettingsService`.
- [ ] Không có duplicate preference database.
- [ ] Profile projection deterministic.
- [ ] Winning layer và source metadata được phân biệt.
- [ ] Local cache reconciliation PASS.

### Schema và migration

- [ ] Onboarding schema/version.
- [ ] Profile export schema/version.
- [ ] Metadata/history ledger schema.
- [ ] Atomic/idempotent migrations.
- [ ] Unknown-field retention.
- [ ] Secret rejection.

### Onboarding

- [ ] Fresh install.
- [ ] Skip.
- [ ] Recommended defaults.
- [ ] Existing-user upgrade.
- [ ] No cloud/local question.
- [ ] No provider requirement.
- [ ] No autonomy escalation.
- [ ] Exact current enum values.

### Runtime consumption

- [ ] Bounded personalization packet.
- [ ] Planner/context/response/story consumers wired.
- [ ] Preference affects presentation as expected.
- [ ] Permission/policy invariants unchanged.
- [ ] Project/local policy overrides remain authoritative.

### Experience switching

- [ ] Direct any-to-any switch.
- [ ] Everyday → Expert visible.
- [ ] Expert → Everyday visible.
- [ ] State preserved.
- [ ] User setting persists.
- [ ] Keyboard/screen-reader support.
- [ ] No route loop or duplicate mission.

### UI

- [ ] Profile Overview.
- [ ] Reuses Settings catalog renderer.
- [ ] Provenance/history.
- [ ] Partial reset.
- [ ] Import/export preview.
- [ ] Vietnamese/English coverage.
- [ ] All themes/responsive states.
- [ ] No dead/fake controls.

### Memory/privacy

- [ ] Preference separated from actual memory content.
- [ ] Project boundaries.
- [ ] View/edit/delete/export actions distinct.
- [ ] No sensitive inference by default.
- [ ] Reset profile does not delete user data.

### Update safety

- [ ] Onboarding does not reappear.
- [ ] Settings/profile/history survive update.
- [ ] Corrupt-record recovery.
- [ ] Last-known-good path.
- [ ] Real Windows update replay.
- [ ] Before/after data comparison.

---

# PHẦN III — QUAN HỆ GIỮA HAI PROFILE

## 24. Interaction contract

Personalization là soft input. Model truth và policy quyết định feasibility.

```text
User preference
+ task requirements
+ canonical model truth
+ live deployment health
+ project/data/security policy
+ cost/latency budget
+ verification requirements
→ routing decision + explanation receipt
```

Ví dụ:

- Người dùng thích câu trả lời ngắn.
- Task cần đọc repository lớn và sửa nhiều file.
- Model A rẻ nhưng tool conformance hết hạn.
- Model B có verified tool receipt và context phù hợp.

Router có thể chọn Model B, rồi formatter vẫn trình bày kết quả ngắn theo preference. Preference không được ép chọn Model A.

### 24.1 Model-related preferences hợp lệ

Có thể lưu:

- Ưu tiên quality/cost/latency ở mức mềm.
- Cho phép local-only hoặc provider allowlist nếu key/policy được thiết kế rõ.
- Preferred model role hoặc pinned deployment cho project.
- Cho phép fallback hay không.
- Hiển thị routing explanation.

Các preference này không thay thế policy và capability evidence.

### 24.2 Không lưu trong Personalization Profile

- API keys/credentials.
- Provider secrets.
- Raw prompts chứa dữ liệu nhạy cảm.
- Raw chain-of-thought.
- Undeclared demographic/sensitive attributes.
- Runtime health truth.
- Model capability scores.
- Actual memory content.
- Capability grants/approval receipts.

---

## 25. Thứ tự triển khai

### Stage A — Baseline và ownership

- Freeze catalog/API/settings inventories.
- ADR schema naming.
- Assign ownership cho ba model layers.
- Define profile projection rule.
- Add retention tests.

### Stage B — Canonical model truth

- Entity split.
- Field-level provenance/freshness/conflict.
- Durable discovery ledger.
- Compatibility projection migration.

### Stage C — Evaluation và management

- Eval schemas/receipts.
- Runtime observation wiring.
- Durable health.
- Harness recommendations.
- Dossier/comparison/routing explanation.

### Stage D — Personalization foundation

- Onboarding state.
- Metadata/history ledger.
- Profile projection/export/import.
- Exact Settings catalog migrations.
- Runtime packet and consumers.

### Stage E — Adoption UX

- Direct Experience Switcher.
- First-run onboarding.
- Profile Settings UI.
- Session state reconciliation.

### Stage F — Update certification

- Snapshot/migration/recovery.
- Real Windows update replay.
- Before/after settings/profile/model-catalog comparison.
- Complete Delivery receipts.

---

## 26. Definition of Done

### Model Profile

Model Profile chỉ hoàn chỉnh khi:

- Ba lớp hiện hữu hội tụ quanh canonical truth.
- Schema naming không collision.
- Base/snapshot/deployment/artifact tách rõ.
- Facts có provenance/freshness/conflict.
- Discovery và execution observations durable.
- Eval/harness recommendation có receipts.
- Existing APIs tương thích.
- Dossier/comparison/routing explanation hoạt động.
- Real provider/local claims được scope và chứng minh.

### Personalization Profile

Personalization chỉ hoàn chỉnh khi:

- SettingsService vẫn authoritative.
- Profile projection deterministic và exportable.
- Provenance/history hoạt động.
- Onboarding một lần, không hỏi cloud/local.
- Runtime thực sự tiêu thụ bounded preference context.
- Direct experience switching giữ state.
- Không có permission/autonomy escalation.
- Profile survive update và recovery.
- Reset profile không xóa dữ liệu người dùng.

---

## 27. Quyết định khóa

1. Canonical Model Profile nằm trong model-truth plane hiện hữu, không phải registry mới.
2. Compatibility registry tiếp tục tồn tại như adapter cho đến khi consumer migration hoàn tất.
3. Management plane dùng canonical snapshot và durable observations.
4. Không dùng tên schema mới gây collision với `nolane.model-profiles.v2` hiện hữu.
5. Unknown vẫn là unknown.
6. Personalization values thuộc Settings layers.
7. Profile chỉ projection + metadata ledger.
8. Onboarding không hỏi cloud/local.
9. Experience switching không đổi quyền.
10. LocalStorage không authoritative.
11. Enum mới chỉ được thêm qua Settings catalog migration.
12. Mock/route/UI presence không phải production certification.
13. Windows update replay là CP14 exit gate, không phải mục tiêu tùy chọn về sau.

---

## 28. Artifact dự kiến khi triển khai xong

### Model Profile

- Schema/ADR và validators.
- Canonical entity stores/migrations.
- Durable discovery ledger.
- Field-level provenance/freshness/conflict records.
- Eval suites và signed receipts.
- Runtime observation adapters.
- Health/harness recommendation records.
- Compatibility projection tests.
- Catalog/dossier/comparison/routing UI.
- Model truth coverage report.

### Personalization

- Onboarding schema/service/UI.
- Preference metadata/history ledger.
- Profile projection/import/export service.
- Settings catalog migrations.
- Runtime personalization packet and consumers.
- Direct Experience Switcher.
- Session/cache reconciliation.
- Profile Overview/history/reset UI.
- Update preservation/migration tests.

### Certification

- Full repository regression.
- Provider probe scope report.
- UI captures in all experience levels.
- i18n/accessibility results.
- Clean-room receipts.
- Real Windows update replay.
- Before/after data preservation report.
- SHA-256 artifact manifest.

---

## 29. Final statement

Checkpoint 14 không cần thêm hai hệ thống profile mới. Nó cần biến các nền móng đã tồn tại thành hai contract sản phẩm đáng tin cậy:

```text
Model intelligence hiện hữu
→ hội tụ thành canonical, evidence-backed model truth

Layered Settings hiện hữu
→ được chiếu thành controllable, versioned personalization profile
```

Hoàn thành nghĩa là profile không chỉ “có schema” hoặc “có UI”, mà thật sự được runtime tiêu thụ, được giải thích bằng receipt, giữ nguyên qua update, không tạo quyền ngầm và không tuyên bố vượt quá những gì đã được kiểm chứng.
