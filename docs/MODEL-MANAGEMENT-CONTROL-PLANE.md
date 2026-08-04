# Nolane Model Management Control Plane

## 1. Purpose

Checkpoint 11 turns the model catalog into an operational control plane. The catalog remains the source of normalized model facts; the control plane adds selection, health, fallback, portfolio assignment, receipts, and operator-facing dossiers without changing the existing provider or Settings contracts.

The design is deliberately fail-closed. A capability marked `null` or `unknown` does not satisfy a hard requirement. Unknown pricing cannot prove a strict cost budget. An unavailable provider, open circuit breaker, retired model, insufficient context window, or exceeded RAM budget blocks selection instead of being hidden by a score.

## 2. Layered architecture

### 2.1 Catalog truth layer

`src/model-profiles/` owns:

- canonical model identity and aliases;
- exact profiles plus family/size inference;
- nullable capability, context, pricing, lifecycle, architecture, and deployment fields;
- provider discovery imports;
- deterministic normalization and SHA-256 receipts;
- conservative resolution for unknown models.

Catalog precedence is exact profile, alias, imported/discovered operational metadata, family template, size template, inference, then provisional unknown. Curated identity and lifecycle facts are not silently replaced by provider observations.

### 2.2 Compatibility layer

`src/providers/model-profile-registry.mjs` remains compatible with the checkpoint-10 UI and provider connection APIs. Every connected model record now carries an `intelligence` object containing the normalized advanced profile. The v1 fields remain available while `publicView()` advertises `nolane.model-profiles.v2` and a catalog summary.

### 2.3 Decision layer

`src/model-management/` owns:

- `ModelHealthLedger`: bounded observations, p50/p95 latency, reliability, spend, token totals, tool success, quality, manual state, circuit breaker, redaction, and receipts;
- `ModelPolicyEngine`: hard blockers plus explainable weighted scoring;
- `ModelManagementService`: recommendation, fail-closed selection, provider-diverse fallback, role portfolio, dossier, and snapshot;
- adapters between legacy provider records and normalized profiles;
- dossier generation for operators and release evidence.

## 3. Policy model

### 3.1 Hard blockers

A candidate is ineligible when any requested invariant cannot be proven:

- required capability is false or unknown;
- requested task class exceeds the declared task envelope;
- context is missing or below the minimum;
- local-only or remote-forbidden policy is violated;
- estimated RAM exceeds the machine budget;
- profile confidence is below the requested minimum;
- lifecycle is retired or disabled;
- preview/experimental models are disallowed;
- provider is unavailable, unauthenticated, or unhealthy;
- model circuit is open, offline, or in maintenance;
- estimated cost exceeds the budget, or price is unknown under a strict budget;
- observed p95 latency exceeds the latency budget.

### 3.2 Explainable score

Eligible candidates are scored from normalized components:

- quality for the requested task kind;
- observed or provider-derived reliability;
- estimated cost efficiency;
- observed p95 latency;
- profile provenance confidence;
- local/remote preference;
- lifecycle stability.

Weights are request-overridable and normalized to one. A blocked candidate always receives score zero, so a high quality estimate can never override a policy violation.

### 3.3 Fallback design

Fallbacks are selected from eligible candidates and de-duplicated by provider and model family. This avoids returning four aliases of the same deployment as an apparent resilience strategy. The default maximum is four fallbacks.

### 3.4 Role portfolios

The portfolio API can assign distinct models to `primary`, `fast`, `verifier`, and `local` roles. Roles can be replaced with custom policy objects. The service prefers unique models, but permits reuse when the eligible set is smaller than the role set.

## 4. Health and circuit breaking

The ledger retains a bounded sample window per canonical model ID. Each observation can include:

- success/failure;
- latency;
- input/output tokens;
- USD cost;
- normalized quality score;
- tool execution success;
- safe metadata and error code.

Secret-like metadata keys are removed and token-shaped values are redacted. The default circuit breaker opens after at least five calls when failure rate reaches 60%, or after three consecutive failures. It cools down after 60 seconds unless manually overridden. Manual states support healthy, degraded, offline, and maintenance.

Every health summary includes a deterministic receipt. Raw credentials and authorization data are never part of the receipt payload.

## 5. Detailed profile dossier

A dossier is a read-only, receipt-bound operational view containing:

- executive identity and lifecycle summary;
- architecture, parameter scale, runtime, format, and quantization;
- input/output context limits;
- modalities;
- verified, unsupported, and unknown capability sets;
- reasoning controls;
- quality dimensions;
- specialties and task envelope;
- pricing and rate limits;
- local/remote deployment and RAM/VRAM estimates;
- harness recommendations;
- current health;
- one or more policy evaluations;
- known/unknown field counts;
- warnings, provenance, profile receipt, and dossier receipt.

The generated release contains JSON dossiers for every exact profile and a complete Markdown dossier volume. Nulls remain null; the generator does not fill gaps with assumptions.

## 6. API surface

All routes remain protected by the existing HTTP authentication and request authorization boundary.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/model-management/snapshot` | Catalog and health summary with receipts |
| POST | `/api/model-management/recommend` | Rank candidates and return selection plus fallbacks |
| POST | `/api/model-management/portfolio` | Assign models to operational roles |
| POST | `/api/model-management/observations` | Record bounded execution health evidence |
| GET | `/api/model-management/dossier?modelId=...` | Return a full normalized dossier |

Existing `/api/model-profiles`, discovery, and probe routes remain intact.

## 7. CLI surface

Examples:

```bash
npm run models:manage -- snapshot
npm run models:manage -- recommend --task large --require coding,toolCalling,structuredOutput
npm run models:manage -- recommend --local --max-ram 16 --models qwen/qwen3-coder-30b-a3b-instruct,google/gemma-3-27b-it
npm run models:manage -- portfolio
npm run models:manage -- dossier --model openai/gpt-5.3-codex --format markdown
npm run models:artifacts
```

## 8. Provider discovery strategy

Provider discovery and catalog metadata are separate evidence channels:

- catalog profiles describe model identity and curated capabilities;
- provider discovery describes what a configured deployment currently exposes;
- probes describe observed behavior;
- health observations describe operational outcomes.

Sparse discovery records do not erase exact profile capabilities. Only meaningful operational fields are registered as discovery evidence.

## 9. Local model management

Local profiles preserve runtime, format, quantization, estimated RAM/VRAM, and deployment locality. Quantization is treated as deployment metadata, not a new base-model identity. The policy engine can enforce `localOnly`, `remoteAllowed: false`, and `maxRamGB`.

A local profile with unknown tool support cannot be selected for a tool-required mission merely because its name contains “coder”. Provider probing or curated evidence must establish the capability.

## 10. Security and privacy

- No provider credential is stored in a model profile.
- Observation metadata is key-filtered and token-redacted.
- HTTP routes inherit the existing authenticated local/enterprise boundary.
- Receipts contain normalized public/operational metadata, not secrets.
- Unknown capability and pricing fields are never promoted to true or zero.
- Provider readiness is a hard gate when inventory is available.

## 11. Verification

Checkpoint 11 adds dedicated tests for:

- circuit breaker, summaries, and manual health state;
- hard policy blockers and explainable scoring;
- recommendation, fallback, portfolio, dossier, and snapshot;
- compatibility adapter correctness;
- HTTP endpoints;
- the original profile registry/import/export/sync suite;
- a standalone control-plane verifier;
- release artifact generation and receipt integrity.

These gates are appended to the full release matrix rather than replacing checkpoint-10 evidence.

## 12. Non-claims and retained external gates

This checkpoint does not claim that every model fact is current forever, that every provider has been authenticated, or that real Windows hardware/accessibility certification has been completed. The existing external gates for Windows 8 GB performance, WCAG 2.2 AA, responsive visual validation, UI resource budgets, and real provider dogfooding remain external until corresponding receipts exist.
