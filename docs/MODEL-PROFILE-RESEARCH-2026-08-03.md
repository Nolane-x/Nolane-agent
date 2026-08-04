# Nolane Model Profile Registry — Nghiên cứu và thiết kế hoàn chỉnh

**Ngày khóa dữ liệu:** 2026-08-03  
**Catalog bundled:** 567 exact model IDs, 62 family templates, 13 size templates  
**Receipt SHA-256:** `9d1582b7fa604637d9ebc7b14ec3c33845a8024698ee48a90f4afa6a6b84d59f`

## 1. Kết luận kiến trúc

Nolane không thể đạt độ bao phủ bền vững bằng một danh sách model tĩnh. Một model có thể xuất hiện dưới nhiều tên API, snapshot, alias, quantization và runtime; cùng một base model cũng có context, giá, tool-call và giới hạn khác nhau tùy provider. Vì vậy registry được thiết kế theo năm tầng, theo thứ tự ưu tiên:

1. Exact curated profile cho model quan trọng và lifecycle override.
1. Live provider discovery để biết model tài khoản thực sự nhìn thấy.
1. Catalog import để lấy deployment metadata từ models.dev, OpenRouter, LiteLLM và Portkey.
1. Family + size template để suy luận model open-weight/local chưa có exact profile.
1. Provisional fallback bảo thủ: không bịa context, giá, quota hoặc tool support.

Định nghĩa “đầy đủ” của Nolane là: exact nơi cần độ chính xác cao, open-ended nơi thị trường thay đổi, và luôn biểu diễn uncertainty. Đây là thiết kế mạnh hơn việc cố nhồi mọi tên model vào một file duy nhất.

## 2. Những thiếu hụt ban đầu trong Nolane

- Provider profile chỉ đánh giá theo provider family, nên Sonnet/Opus, Flash/Pro, model nhanh/model reasoning bị trộn.
- Harness profile mô tả cách gọi công cụ nhưng không mô tả giới hạn thật của model.
- Agent profile mô tả role/budget/sandbox nhưng không biết model có đủ năng lực cho role đó hay không.
- Không tách base model khỏi deployment variant; Q4 GGUF bị xem giống FP16 API.
- Không có provenance/confidence, nên giá trị ước lượng dễ bị hiểu nhầm là dữ liệu chính thức.
- Không có lifecycle registry, alias reconciliation hoặc replacement warning.
- Không có task floor/ceiling cho model 0.5B–7B, dẫn đến giao nhiệm vụ quá sức.

## 3. Schema profile chuẩn

### 3.1. Identity

`canonicalId`, `providerModelId`, `aliases`, `publisher`, `family`, `series`, `version`, `displayName`, `releaseDate`, `knowledgeCutoff`, `license`, `openWeights`.

### 3.2. Lifecycle

`status`, `deprecatedAt`, `retirementAt`, `replacement`.

### 3.3. Architecture

`type (dense/MoE/hybrid)`, `totalParameters`, `activeParameters`, `parameterScale`, `tokenizerId`, `format`, `quantization`, `runtime`.

### 3.4. Context

`contextWindow`, `maxInputTokens`, `maxOutputTokens`, `maxImages`, `maxFiles`, `supportsCompaction`.

### 3.5. Modalities

`text/image/audio/video/files input`, `text/image/audio/video output`.

### 3.6. Capabilities

`coding`, `reasoning`, `agentic`, `toolCalling`, `structuredOutput`, `streaming`, `promptCaching`, `batch`, `citations`, `computerUse`, `embeddings`, `fineTuning`, `fillInMiddle`, `vision`.

### 3.7. Tool calling

`supported`, `parallel`, `strictSchema`, `toolChoice`, `preservesReasoningContent`, `maxTools`.

### 3.8. Reasoning

`supported`, `levels`, `defaultLevel`, `controllable`, `visibleTrace`.

### 3.9. Quality dimensions

`coding`, `reasoning`, `debugging`, `largeRefactor`, `frontend`, `toolUse`, `instructionFollowing`, `longContext`.

### 3.10. Task envelope

`minimumClass`, `maximumClass`, `recommendedClasses`, `verificationRequired`, `autonomousChangeRisk`.

### 3.11. Pricing and limits

`input/output/cache cost per million`, `RPM`, `TPM`, `maxConcurrency`.

### 3.12. Deployment

`local`, `remote`, `selfHostable`, `endpointType`, `RAM/VRAM estimate and basis`.

### 3.13. Harness recommendations

`contextStrategy`, `toolStrategy`, `patchStrategy`, `retryStrategy`, `preferredHarnesses`.

### 3.14. Provenance

`sources`, `observedAt`, `verifiedAt`, `field confidence`, `receipt SHA-256`.

Mọi trường chưa được xác minh giữ `null`. `false` chỉ được dùng khi nguồn có thẩm quyền xác nhận không hỗ trợ.

## 4. Base model và deployment variant

Registry tách hai khái niệm:

- **Base model profile:** kiến trúc, family, parameter count, modality, license và năng lực nền.
- **Deployment profile:** provider, model ID, endpoint, context thực tế, output cap, giá, quota, quantization, runtime và availability.

Ví dụ `Qwen3-Coder-30B-A3B-Instruct` có thể tồn tại dưới dạng BF16 trên vLLM, FP8, GGUF Q4_K_M trên Ollama, MLX 4-bit, hoặc API do một provider phục vụ. Các deployment này không được phép chia sẻ mù quáng RAM, latency, context hay tool reliability.

## 5. Ma trận model nhỏ: sub-1B đến 8B

| Lớp | Mức nhiệm vụ mặc định | Ví dụ việc phù hợp | Điều cấm mặc định |
|---|---|---|---|
| sub-1B | micro | phân loại, gắn nhãn, chọn tool từ tập nhỏ, chuẩn hóa tên file | không tự sửa repository nhiều file |
| 1B–2.5B | micro | trích xuất schema nhỏ, lọc log, phát hiện pattern, rewrite cục bộ | không tự quyết kiến trúc |
| 3B–4.5B | micro/small | patch một hàm, sinh test đơn giản, query routing | không refactor xuyên module nếu chưa có verifier |
| 5B–8.5B | small | bugfix cục bộ, code completion, test generation, review diff nhỏ | không giao migration lớn không giám sát |
| 9B–14.5B | small/medium | feature nhỏ, debugging có tool, review nhiều file có giới hạn | không mặc định tin tool-call nếu chưa benchmark |

Model nhỏ luôn có `verificationRequired=true`. Nolane nên dùng chúng như specialist rẻ/nhanh, không giả định rằng kích thước nhỏ đồng nghĩa vô dụng hoặc rằng benchmark tổng quát đủ để cấp quyền tự trị.

### 5.1 Các scale nhỏ được catalog nhận biết

`0.5B`, `0.6B`, `1B`, `1.1B`, `1.2B`, `1.3B`, `1.4B`, `1.5B`, `1.7B`, `1.8B`, `2B`, `2.2B`, `2.4B`, `2.8B`, `3B`, `4B`, `6B`, `6.7B`, `6.9B`, `7B`, `7.8B`, `8B`, `9B`, `10B`, `10.7B`, `11B`, `12B`, `13B`, `14B`.

### 5.2 Ví dụ exact profiles nhỏ

- `qwen/qwen3-0.6b` — scale `0.6B`, max task `micro`, coding `True`.
- `qwen/qwen2.5-coder-0.5b-instruct` — scale `0.5B`, max task `micro`, coding `True`.
- `deepseek/deepseek-coder-1.3b-instruct` — scale `1.3B`, max task `micro`, coding `True`.
- `google-gemma/gemma-2-2b-it` — scale `2B`, max task `micro`, coding `True`.
- `qwen/qwen3-4b` — scale `4B`, max task `small`, coding `True`.
- `microsoft/phi-4-mini-instruct` — scale `None`, max task `medium`, coding `True`.
- `qwen/qwen2.5-coder-7b-instruct` — scale `7B`, max task `small`, coding `True`.
- `bigcode/starcoder2-7b` — scale `7B`, max task `small`, coding `True`.

## 6. Coding models 15B–70B

Đây là vùng Nolane phải đặc biệt mạnh vì phù hợp workstation/local server và agent chuyên môn: Devstral 24B, Gemma 27B, Qwen/Nemotron 30B-A3B, Qwen 32B, DeepSeek Coder 33B, Code Llama 34B, Llama/Nemotron 49B–70B. Resolver parse cả dense và MoE, bao gồm active parameter sau ký hiệu `A` như `30B-A3B`.

| Scale | Chính sách mặc định |
|---|---|
| 15–24B | medium task; patch nhiều file có test gate |
| 25–35B | medium/large; coding specialist được ưu tiên hơn general model cùng size |
| 36–72B | large task; vẫn cần compatibility check cho tool schema/context |
| MoE 30B-A3B | không đánh đồng total capacity với RAM compute hoặc chất lượng dense 30B |

## 7. Frontier model overrides

| Model/family | Architecture | Context | Output | Profile notes |
|---|---:|---:|---:|---|
| DeepSeek V4 Flash | 284B total / 13B active | 1M | 384K | thinking + non-thinking, JSON, tool calls, FIM non-thinking |
| DeepSeek V4 Pro | 1.6T total / 49B active | 1M | 384K | frontier reasoning/coding, tool calls |
| Kimi K3 | 2.8T total / 104B active | 1,048,576 | unknown in bundled profile | native multimodal, long-horizon coding, MoE |
| Qwen3-Coder 480B-A35B | 480B / 35B active | 256K native | unknown | agentic coding, repository-scale; extension runtime-dependent |
| Qwen3-Coder 30B-A3B | 30B / 3B active | 256K native | unknown | local-efficient agentic coding |
| NVIDIA Nemotron 3 Nano | 30B / ~3.5B active | up to 1M | 128K | reasoning switch, tool parser, agentic use |
| Gemini 3.6 Flash | closed | live discovery | live discovery | agentic/multimodal; exact limits fetched from models.list |
| OpenAI GPT/Codex families | closed | live discovery | live discovery | reasoning effort and tool support vary by exact model |
| Anthropic Claude families | closed | live discovery | live discovery | Opus/Sonnet/Haiku must never share one provider-wide quality score |

Tên model mới hoặc chưa được nguồn chính thức xác nhận vẫn có thể tồn tại trong catalog với confidence thấp; availability cuối cùng phải lấy từ provider discovery của tài khoản.

## 8. Family templates

1. `01ai-yi`
2. `ai21-jamba`
3. `allenai-olmo`
4. `amazon-nova`
5. `anthropic-claude`
6. `aya`
7. `baichuan`
8. `bigcode-starcoder`
9. `cohere-command`
10. `databricks-dbrx`
11. `deepcoder`
12. `deepseek-coder`
13. `deepseek-r1`
14. `deepseek-v3`
15. `deepseek-v4`
16. `eleutherai-pythia`
17. `exaone`
18. `google-codegemma`
19. `google-gemini`
20. `google-gemma`
21. `huggingface-smollm`
22. `ibm-granite`
23. `ibm-granite-code`
24. `inclusion-ling`
25. `internlm`
26. `internvl`
27. `magicoder`
28. `meta-code-llama`
29. `meta-llama`
30. `microsoft-phi`
31. `minicpm`
32. `minimax`
33. `mistral-codestral`
34. `mistral-devstral`
35. `mistral-general`
36. `mistral-mixtral`
37. `moonshot-kimi-k2`
38. `moonshot-kimi-k3`
39. `nous-nolane_native`
40. `nvidia-nemotron`
41. `openai-codex`
42. `openai-gpt`
43. `openai-gpt-oss`
44. `openai-o-series`
45. `openchat`
46. `opencoder`
47. `poolside-laguna`
48. `qwen-general`
49. `qwen-reasoning`
50. `qwen2.5-coder`
51. `qwen3-coder`
52. `replit-code`
53. `snowflake-arctic`
54. `solar`
55. `stability-stablelm`
56. `thinking-machines-inkling`
57. `tii-falcon`
58. `tinyllama`
59. `wizardcoder`
60. `writer-palmyra`
61. `xai-grok`
62. `zhipu-glm`

## 9. Size templates

1. `121b-250b`
2. `15b-24b`
3. `1b-2b`
4. `1t-plus`
5. `251b-500b`
6. `25b-35b`
7. `36b-72b`
8. `3b-4b`
9. `501b-1t`
10. `5b-8b`
11. `73b-120b`
12. `9b-14b`
13. `sub-1b`

## 10. Publisher coverage bundled

| Publisher | Exact IDs | Ví dụ |
|---|---:|---|
| `qwen` | 57 | `qwen/codeqwen1.5-7b-chat`, `qwen/qvq-72b-preview`, `qwen/qwen1.5-0.5b-chat`, `qwen/qwen1.5-1.8b-chat` |
| `openai` | 46 | `openai/chatgpt-4o-latest`, `openai/codex-mini-latest`, `openai/computer-use-preview`, `openai/gpt-3.5-turbo` |
| `mistralai` | 30 | `mistralai/codestral-22b`, `mistralai/codestral-25.01`, `mistralai/codestral-25.08`, `mistralai/codestral-mamba` |
| `deepseek` | 28 | `deepseek/deepseek-chat`, `deepseek/deepseek-coder-1.3b-instruct`, `deepseek/deepseek-coder-33b-instruct`, `deepseek/deepseek-coder-6.7b-instruct` |
| `anthropic` | 21 | `anthropic/claude-2.0`, `anthropic/claude-2.1`, `anthropic/claude-3-5-haiku-latest`, `anthropic/claude-3-5-sonnet-latest` |
| `google` | 21 | `google/gemini-1.5-flash`, `google/gemini-1.5-pro`, `google/gemini-2.0-flash`, `google/gemini-2.0-flash-lite` |
| `microsoft` | 21 | `microsoft/phi-1`, `microsoft/phi-1.5`, `microsoft/phi-2`, `microsoft/phi-3-medium-128k-instruct` |
| `ibm-granite` | 20 | `ibm-granite/granite-20b-code-instruct`, `ibm-granite/granite-3.0-3b-a800m-instruct`, `ibm-granite/granite-3.0-8b-instruct`, `ibm-granite/granite-3.1-2b-instruct` |
| `meta-llama` | 20 | `meta-llama/codellama-13b-instruct`, `meta-llama/codellama-34b-instruct`, `meta-llama/codellama-70b-instruct`, `meta-llama/codellama-7b-instruct` |
| `zai-org` | 19 | `zai-org/codegeex4-all-9b`, `zai-org/cogvlm2-llama3-chat-19b`, `zai-org/glm-4-air`, `zai-org/glm-4-airx` |
| `opengvlab` | 17 | `opengvlab/internvl2-1b`, `opengvlab/internvl2-26b`, `opengvlab/internvl2-2b`, `opengvlab/internvl2-40b` |
| `moonshotai` | 16 | `moonshotai/kimi-audio-7b`, `moonshotai/kimi-k1.5`, `moonshotai/kimi-k2-base`, `moonshotai/kimi-k2-instruct` |
| `01-ai` | 14 | `01-ai/yi-1.5-34b-chat`, `01-ai/yi-1.5-6b-chat`, `01-ai/yi-1.5-9b-chat`, `01-ai/yi-34b-chat` |
| `cohere` | 14 | `cohere/aya-23-35b`, `cohere/aya-23-8b`, `cohere/aya-expanse-32b`, `cohere/aya-expanse-8b` |
| `google-gemma` | 14 | `google-gemma/codegemma-2b`, `google-gemma/codegemma-7b`, `google-gemma/codegemma-7b-it`, `google-gemma/gemma-2-27b-it` |
| `nvidia` | 14 | `nvidia/cosmos-reason1-7b`, `nvidia/llama-3.1-nemotron-70b-instruct`, `nvidia/llama-3.1-nemotron-nano-8b-v1`, `nvidia/llama-3.1-nemotron-ultra-253b-v1` |
| `tii` | 14 | `tii/falcon-11b`, `tii/falcon-180b-chat`, `tii/falcon-40b-instruct`, `tii/falcon-7b-instruct` |
| `amazon` | 13 | `amazon/nova-2-lite`, `amazon/nova-2-sonic`, `amazon/nova-canvas`, `amazon/nova-lite` |
| `allenai` | 12 | `allenai/molmo-72b-0924`, `allenai/molmo-7b-d-0924`, `allenai/molmo-7b-o-0924`, `allenai/molmoe-1b-0924` |
| `ai21labs` | 10 | `ai21labs/jamba-1.5-large`, `ai21labs/jamba-1.5-mini`, `ai21labs/jamba-9b`, `ai21labs/jamba-instruct` |
| `eleutherai` | 10 | `eleutherai/gpt-j-6b`, `eleutherai/gpt-neox-20b`, `eleutherai/pythia-1.4b-deduped`, `eleutherai/pythia-12b-deduped` |
| `huggingfacetb` | 10 | `huggingfacetb/smollm-1.7b-instruct`, `huggingfacetb/smollm-135m-instruct`, `huggingfacetb/smollm-360m-instruct`, `huggingfacetb/smollm2-1.7b-instruct` |
| `x-ai` | 10 | `x-ai/grok-2`, `x-ai/grok-2-vision`, `x-ai/grok-3`, `x-ai/grok-3-mini` |
| `baichuan-inc` | 9 | `baichuan-inc/baichuan-13b-chat`, `baichuan-inc/baichuan-7b`, `baichuan-inc/baichuan2-13b-chat`, `baichuan-inc/baichuan2-7b-chat` |
| `internlm` | 9 | `internlm/internlm-xcomposer2-vl-7b`, `internlm/internlm-xcomposer2.5-7b`, `internlm/internlm2-1.8b-chat`, `internlm/internlm2-20b-chat` |
| `minimax` | 9 | `minimax/abab5.5-chat`, `minimax/abab6-chat`, `minimax/abab6.5-chat`, `minimax/abab6.5s-chat` |
| `bigcode` | 8 | `bigcode/santacoder-1.1b`, `bigcode/starchat-beta`, `bigcode/starchat2-15b`, `bigcode/starcoder-15b` |
| `lg-ai-exaone` | 8 | `lg-ai-exaone/exaone-3.5-2.4b-instruct`, `lg-ai-exaone/exaone-3.5-32b-instruct`, `lg-ai-exaone/exaone-3.5-7.8b-instruct`, `lg-ai-exaone/exaone-4.0-1.2b` |
| `openbmb` | 8 | `openbmb/minicpm-2b-sft-bf16`, `openbmb/minicpm-o-2_6`, `openbmb/minicpm-o-2_6-int4`, `openbmb/minicpm-v-2_5` |
| `stabilityai` | 8 | `stabilityai/stable-beluga-2`, `stabilityai/stable-beluga-7b`, `stabilityai/stable-code-3b`, `stabilityai/stable-code-instruct-3b` |
| `nousresearch` | 7 | `nousresearch/nolane_native-3-llama-3.1-405b`, `nousresearch/nolane_native-3-llama-3.1-70b`, `nousresearch/nolane_native-3-llama-3.1-8b`, `nousresearch/nolane_native-4-405b` |
| `writer` | 7 | `writer/palmyra-creative`, `writer/palmyra-fin`, `writer/palmyra-med`, `writer/palmyra-small` |
| `databricks` | 5 | `databricks/dbrx-base`, `databricks/dbrx-instruct`, `databricks/dolly-v2-12b`, `databricks/dolly-v2-3b` |
| `snowflake` | 5 | `snowflake/arctic-embed-l-v2.0`, `snowflake/arctic-embed-m`, `snowflake/arctic-embed-m-v2.0`, `snowflake/arctic-embed-s` |
| `inclusionai` | 4 | `inclusionai/ling-2.0-1t`, `inclusionai/ling-3.0-flash`, `inclusionai/ling-mini-2.0`, `inclusionai/ring-1t` |
| `infly` | 4 | `infly/opencoder-1.5b-base`, `infly/opencoder-1.5b-instruct`, `infly/opencoder-8b-base`, `infly/opencoder-8b-instruct` |
| `ise-uiuc` | 4 | `ise-uiuc/magicoder-cl-7b`, `ise-uiuc/magicoder-ds-6.7b`, `ise-uiuc/magicoder-s-cl-7b`, `ise-uiuc/magicoder-s-ds-6.7b` |
| `openchat` | 4 | `openchat/openchat-3.5`, `openchat/openchat-3.5-0106`, `openchat/openchat-3.5-1210`, `openchat/openchat-3.6-8b` |
| `upstage` | 4 | `upstage/solar-10.7b-instruct-v1.0`, `upstage/solar-mini`, `upstage/solar-pro`, `upstage/solar-pro-2` |
| `poolside` | 3 | `poolside/laguna-instruct`, `poolside/laguna-s-2`, `poolside/laguna-s-2.1` |
| `replit` | 3 | `replit/replit-code-v1_5-3b`, `replit/replit-code-v1_5-3b-instruct`, `replit/replit-code-v1-3b` |
| `thinking-machines` | 3 | `thinking-machines/inkling-large`, `thinking-machines/inkling-medium`, `thinking-machines/inkling-small` |
| `agentica-org` | 2 | `agentica-org/deepcoder-1.5b-preview`, `agentica-org/deepcoder-14b-preview` |
| `tinyllama` | 2 | `tinyllama/tinyllama-1.1b-chat-v1.0`, `tinyllama/tinyllama-1.1b-intermediate-step-1431k-3t` |

Danh sách đầy đủ của 567 IDs nằm trong `config/model-profiles/nolane-model-profiles.v1.json`; tài liệu này không lặp lại toàn bộ để tránh biến thành một file inventory khó đọc.

## 11. Discovery adapters

| Adapter | Endpoint/shape | Dữ liệu lấy |
|---|---|---|
| OpenAI-compatible | GET /v1/models | model ID, owner, availability |
| Anthropic | GET /v1/models, pagination after_id | model ID, display name, created time |
| Gemini | GET /v1beta/models, pageToken | input/output limits, supported actions |
| Ollama | GET /api/tags | installed ID, family, parameter size, GGUF format, quantization, artifact size |
| LM Studio | GET /api/v1/models then /v1/models fallback | loaded ID, architecture, parameter count, quantization, MLX/runtime |

Credentials chỉ được truyền vào request. Output và receipt không chứa API key, Authorization header hoặc vault reference.

## 12. Catalog import adapters

- `models.dev`: normalize base model, provider deployment, context/output, cost, modality, tool/reasoning flags và lifecycle.
- `OpenRouter`: normalize model ID, context, max completion, supported request parameters, modality và per-token pricing.
- `LiteLLM`: normalize cost/context map và capability flags cho hàng loạt provider.
- `Portkey`: normalize provider/model inventory, context, capability và pricing khi endpoint được cấu hình.

Một nguồn lỗi chỉ tạo failure receipt cho nguồn đó. Các nguồn thành công vẫn được giữ, tránh single point of failure.

## 13. Merge precedence và bảo vệ sự thật

```text
canonical identity/lifecycle override
  > live account-visible provider observation
  > imported deployment metadata
  > family behavior template
  > size/task envelope template
  > provisional unknown profile
```

Live discovery được phép cập nhật operational fields như context, tool support, pricing và quota, nhưng không tự đổi publisher/base identity/lifecycle đã được xác minh. Mỗi lần resolve sinh receipt SHA-256 để audit.

## 14. Quantization và hardware estimate

Registry nhận biết `FP32`, `FP16`, `BF16`, `FP8`, `INT8`, `INT4`, `NF4`, `Q2`–`Q8`, `AWQ`, `GPTQ`, `EXL2`, `EXL3`, `GGUF`, `MLX`, Ollama và vLLM. RAM/VRAM là estimate dựa trên parameter count × bit-width + overhead; nó luôn có `estimateBasis` và cảnh báo capability variance.

Không được dùng RAM estimate để suy ra tốc độ hoặc chất lượng. KV cache, context, backend kernels, offload CPU/GPU, batch size và multimodal encoder có thể làm yêu cầu thực tế khác lớn.

## 15. Lifecycle và alias

- Alias được map về canonical ID trước family inference.
- Stable, preview, latest, dated snapshot và experimental phải là deployment identities riêng nếu provider phân biệt.
- Deprecated/retired model sinh warning và replacement hint.
- `deepseek-chat` và `deepseek-reasoner` được đánh dấu retired sau 2026-07-24, chuyển sang V4 Flash mode tương ứng.
- Gemini model đã shutdown được đánh dấu retired và replacement theo lịch chính thức.

## 16. Compatibility report

Nolane có thể kiểm tra trước khi giao việc: yêu cầu tool call, structured output, vision, minimum context, maximum RAM. Trường unknown không được coi là pass. Report có blockers, warnings và receipt riêng.

## 17. Chất lượng và confidence

| Nguồn | Confidence điển hình | Ý nghĩa |
|---|---:|---|
| Official model card/provider docs | 0.90–1.00 | architecture/limits/lifecycle được xác minh |
| Live provider discovery | 0.80–0.95 | availability và operational metadata theo tài khoản |
| Aggregator deployment catalog | 0.65–0.90 | hữu ích nhưng chỉ có thẩm quyền cho deployment của nguồn |
| Family + size inference | 0.45–0.70 | dùng để routing bảo thủ |
| Unknown provisional | <0.50 | không giao quyền tự trị cao |

## 18. Lệnh sử dụng

```bash
npm run profiles:test
npm run profiles:export
npm run profiles:sync -- --sources models.dev,openrouter,litellm
npm run profiles:discover -- --provider ollama --base-url http://127.0.0.1:11434
npm run profiles:discover -- --provider openai-api --base-url https://api.openai.com --api-key-env OPENAI_API_KEY
```

## 19. File map

- `src/model-profiles/model-profile-schema.mjs` — schema, canonical JSON, deep freeze, receipt.
- `src/model-profiles/model-identity-inference.mjs` — parser family/size/MoE/quant/runtime.
- `src/model-profiles/model-family-catalog.mjs` — family và size templates.
- `src/model-profiles/model-profile-seeds.mjs` — 567 exact bundled profiles.
- `src/model-profiles/model-profile-registry.mjs` — resolve/merge/compatibility/export.
- `src/model-profiles/model-catalog-import.mjs` — four catalog normalizers.
- `src/model-profiles/model-catalog-sync.mjs` — resilient multi-source sync.
- `src/model-profiles/model-discovery-service.mjs` — provider/local discovery.
- `scripts/export-model-profiles.mjs` — deterministic bundled export.
- `scripts/sync-model-profiles.mjs` — live catalog snapshot.
- `scripts/discover-models.mjs` — account/local model discovery.
- `config/model-profiles/source-ledger.json` — source authority ledger.
- `config/model-profiles/nolane-model-profiles.v1.json` — final catalog.

## 20. Giới hạn trung thực

Không hệ thống nào có thể đóng băng “mọi model” vì mỗi ngày xuất hiện fine-tune, alias, private endpoint, community quant và model mới. Catalog bundled này là nền chính xác đủ rộng; tính đầy đủ thực tế đến từ live discovery + import + inference. Model chưa biết vẫn dùng được ngay nhưng bị gắn confidence thấp, unknown fields và verification requirement.

## 21. Nguồn nghiên cứu chính

- OpenAI Models API và model catalog.
- Anthropic Models API và Claude model/pricing documentation.
- Google Gemini Models guide, models.list API và deprecation schedule.
- DeepSeek V4 official release, pricing và changelog.
- MoonshotAI Kimi K3 official repository/model card.
- Qwen official Qwen3-Coder collection/model cards.
- NVIDIA Nemotron 3 official NIM model cards.
- Mistral official model overview and models API.
- models.dev schema/API, OpenRouter models API, LiteLLM map và Portkey models catalog.
- Ollama and LM Studio local model listing APIs.

Chi tiết URL và phạm vi thẩm quyền của từng nguồn nằm trong `config/model-profiles/source-ledger.json`.
