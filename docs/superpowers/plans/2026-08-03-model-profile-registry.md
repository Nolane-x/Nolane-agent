# Model Profile Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a model-specific profile registry and model-discovery/export subsystem that covers commercial, open-weight, local, quantized, dense, and MoE models.

**Architecture:** Resolve profiles by merging exact seeds, live discovery, family templates, deployment inference, and conservative fallbacks. Keep provider transport separate from model truth, and preserve provenance and confidence for every profile.

**Tech Stack:** Node.js 22 ESM, `node:test`, built-in `fetch`, canonical JSON SHA-256 utilities, existing credential vault and provider connection service.

## Global Constraints

- Profile-only scope; do not redesign unrelated agent or harness systems.
- Unknown facts must remain null rather than fabricated.
- Credentials must never enter exports or profile provenance.
- Every profile and export must be deterministic and deeply immutable.
- Discovery must be bounded by timeout, pagination, and response-size limits.

---

### Task 1: Schema, inference, and registry

**Files:**
- Create: `src/model-profiles/model-profile-schema.mjs`
- Create: `src/model-profiles/model-identity-inference.mjs`
- Create: `src/model-profiles/model-family-catalog.mjs`
- Create: `src/model-profiles/model-profile-seeds.mjs`
- Create: `src/model-profiles/model-profile-registry.mjs`
- Test: `tests/model-profile-registry.test.mjs`

**Interfaces:**
- Produces: `normalizeModelProfile`, `inferModelIdentity`, `createBuiltInModelProfiles`, `ModelProfileRegistry`.

- [ ] Write registry tests for exact, alias, family, unknown, MoE, quantization, hardware estimates, lifecycle, immutability, and deterministic receipts.
- [ ] Run the tests and verify failure because modules do not exist.
- [ ] Implement the minimal schema, inference, catalog, seeds, and registry required by the tests.
- [ ] Run the tests and verify they pass.

### Task 2: Provider model discovery

**Files:**
- Create: `src/model-profiles/model-discovery-service.mjs`
- Test: `tests/model-discovery-service.test.mjs`

**Interfaces:**
- Consumes: `ModelProfileRegistry.registerDiscovered()`.
- Produces: `ModelDiscoveryService.discover(input)` and normalized discovery receipts.

- [ ] Write tests for OpenAI, Anthropic pagination/capabilities, Gemini pagination/actions, Ollama metadata, LM Studio metadata, response limits, and partial invalid records.
- [ ] Run the tests and verify failure.
- [ ] Implement bounded discovery adapters and reconciliation.
- [ ] Run the tests and verify they pass.

### Task 3: Provider connection and HTTP integration

**Files:**
- Modify: `src/providers/provider-connection-service.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/provider-model-discovery-integration.test.mjs`

**Interfaces:**
- Produces: `ProviderConnectionService.discoverModels()`, `modelProfiles()`, `resolveModelProfile()`, and model-profile HTTP routes.

- [ ] Write integration tests first.
- [ ] Run the tests and verify failure.
- [ ] Add dependency injection, credential-safe discovery, selected-model profile exposure, and routes.
- [ ] Run the tests and verify they pass.

### Task 4: Deterministic catalog export

**Files:**
- Create: `scripts/export-model-profiles.mjs`
- Create: `config/model-profiles/README.md`
- Modify: `package.json`
- Test: `tests/model-profile-export.test.mjs`

**Interfaces:**
- Produces: `npm run profiles:export -- [output]` and `config/model-profiles/nolane-model-profiles.v1.json`.

- [ ] Write export tests first.
- [ ] Run the tests and verify failure.
- [ ] Implement deterministic export with schema/version/receipt and no secrets.
- [ ] Generate the bundled catalog.
- [ ] Run targeted and full test suites.
