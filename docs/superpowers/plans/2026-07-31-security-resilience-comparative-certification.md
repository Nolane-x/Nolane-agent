# Security Resilience & Comparative Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lazy security/certification plane that traces untrusted data to dangerous sinks, enforces supply-chain and audit integrity, exercises bounded escape/failure scenarios, and produces reproducible comparative benchmark evidence without allowing unsupported superiority claims.

**Architecture:** Focused security and benchmark services live behind `SecurityCertificationPlane`, which is lazily owned by `DecisionPlane`. Existing secret scanners, capability stores, dependency intelligence, failure injection, resource accounting, artifact storage, benchmark runner/scorer, and release matrix are extended rather than duplicated.

**Tech Stack:** Node.js ESM, SQLite/filesystem adapters already present in Forge Studio, canonical JSON SHA-256 receipts, node:test, existing release/audit tooling.

## Global Constraints

- Version target is `2.28.0`.
- No raw prompts, model output, secrets, environment dumps, cookies, authorization headers, or unbounded command output in receipts.
- Fake providers are smoke-only and can never create comparative certification.
- No implicit network calls for CVE/license/package intelligence.
- `src/app.mjs` must remain at or below 160 static imports and 180 constructor expressions.
- Existing 2.16–2.27 release gates and historical audit counts remain valid.
- Every new behavior starts with a failing direct test and ends with an independently testable commit.

---

### Task 1: Typed Taint Analysis

**Files:**
- Create: `src/security/taint-analysis-engine.mjs`
- Test: `tests/taint-analysis-engine.test.mjs`

**Interfaces:**
- Produces: `TaintAnalysisEngine.analyze({ nodes, edges, sanitizers, sources, sinks }) -> signed report`

- [ ] Write failing tests proving an untrusted repository value reaches a shell sink, a SQL sanitizer cannot clear shell taint, and ambiguous dynamic edges remain non-safe.
- [ ] Run `node --test tests/taint-analysis-engine.test.mjs`; expect module-not-found failure.
- [ ] Implement bounded graph validation, typed labels/sinks/sanitizers, provenance paths, severity, blockers, ambiguity, and canonical receipt.
- [ ] Re-run the test and `git diff --check`; expect pass.
- [ ] Commit `feat: add typed taint analysis engine`.

### Task 2: Contextual Injection and Prompt Quarantine

**Files:**
- Create: `src/security/contextual-injection-detector.mjs`
- Create: `src/security/prompt-injection-quarantine.mjs`
- Test: `tests/contextual-injection-security.test.mjs`

**Interfaces:**
- Produces: `ContextualInjectionDetector.detect({ context, value, escaping })`
- Produces: `PromptInjectionQuarantine.screen({ sourceKind, content, metadata })`

- [ ] Write failing tests for shell, SQL, path, template, dynamic-code, and prompt injection plus bounded safe projections for repository/browser/terminal/tool content.
- [ ] Verify RED with `node --test tests/contextual-injection-security.test.mjs`.
- [ ] Implement contextual findings, source-kind quarantine, secret redaction, injection flags, and no raw content storage.
- [ ] Verify GREEN and existing `tests/content-sanitizer.test.mjs`.
- [ ] Commit `feat: quarantine contextual injection evidence`.

### Task 3: Dependency Risk, SBOM, and Integrity Quarantine

**Files:**
- Create: `src/security/dependency-risk-intelligence.mjs`
- Create: `src/security/sbom-provenance-service.mjs`
- Create: `src/security/integrity-quarantine.mjs`
- Test: `tests/supply-chain-security.test.mjs`

**Interfaces:**
- Produces: `DependencyRiskIntelligence.assess({ dependency, evidence, compatibility })`
- Produces: `SbomProvenanceService.generate({ commit, components, artifacts })`
- Produces: `IntegrityQuarantine.evaluate({ subject, integrity, policy, compatibility })`

- [ ] Write failing tests for CVE/license/abandonment/malicious evidence, upgrade compatibility blocking, SBOM component provenance, and digest/signature quarantine.
- [ ] Verify RED.
- [ ] Implement deterministic evidence-only risk scoring, compatibility gates, bounded SBOM, and quarantine decisions.
- [ ] Verify GREEN plus semantic dependency tests.
- [ ] Commit `feat: add supply chain provenance and quarantine`.

### Task 4: Exfiltration, Mission Tokens, Audit Chain, and Boundary Protection

**Files:**
- Create: `src/security/exfiltration-guard.mjs`
- Create: `src/security/mission-capability-token-service.mjs`
- Create: `src/security/audit-hash-chain.mjs`
- Create: `src/security/protected-boundary-guard.mjs`
- Test: `tests/security-boundary-protection.test.mjs`

**Interfaces:**
- Produces: `ExfiltrationGuard.inspect({ boundary, payload, destination })`
- Produces: `MissionCapabilityTokenService.issue/authorize/revoke`
- Produces: `AuditHashChain.append/verify`
- Produces: `ProtectedBoundaryGuard.authorizeChange({ paths, actor, overrideReceipt })`

- [ ] Write failing tests covering prompt/context/memory/trace/log/artifact/error/network secret blocking, token expiry/revoke, hash-chain tamper/reorder detection, and protected policy/verifier/audit/capability paths.
- [ ] Verify RED.
- [ ] Implement bounded summaries, short-lived scoped tokens, append-only hash chain, and human-override-only protected boundary changes.
- [ ] Verify GREEN plus secret/capability tests.
- [ ] Commit `feat: protect security and audit boundaries`.

### Task 5: Sandbox Escape and Extended Failure Scenarios

**Files:**
- Create: `src/security/sandbox-escape-adversarial-suite.mjs`
- Create: `src/verification/extended-failure-scenario-lab.mjs`
- Test: `tests/security-adversarial-runtime.test.mjs`

**Interfaces:**
- Produces: `SandboxEscapeAdversarialSuite.run({ root, adapter, scenarios })`
- Produces: `ExtendedFailureScenarioLab.run({ scenario, adapters, verify })`

- [ ] Write failing tests for traversal, encoded traversal, symlink/junction, child/orphan, environment/socket/credential escape, DNS/provider overload, FD exhaustion, disk full, and file race.
- [ ] Verify RED.
- [ ] Implement fixture-root containment, bounded adapter contracts, scenario receipts, cleanup/resume/reverification, and non-destructive claims.
- [ ] Verify GREEN plus `failure-injection-lab.test.mjs` and sandbox driver tests.
- [ ] Commit `feat: add adversarial sandbox and failure lab`.

### Task 6: Locked Comparative Benchmark Schema

**Files:**
- Modify: `src/benchmark/benchmark-schema.mjs`
- Create: `src/benchmark/comparability-contract.mjs`
- Create: `src/benchmark/contamination-guard.mjs`
- Test: `tests/benchmark-comparability-contract.test.mjs`

**Interfaces:**
- Produces: validated suite/case manifests with repository, distribution, model, machine, budget, permissions, category, split, and artifact policy.
- Produces: `ComparabilityContract.verify({ systems, task })`
- Produces: `ContaminationGuard.assess({ repository, case, disclosures, fingerprints })`

- [ ] Write failing tests for exact commit/environment/model/budget lock, hidden/public split, task categories, contamination fingerprint, and mismatch rejection.
- [ ] Verify RED.
- [ ] Extend schema while preserving v1 compatibility, then implement comparability and contamination receipts.
- [ ] Verify GREEN plus existing benchmark schema tests.
- [ ] Commit `feat: lock comparative benchmark contracts`.

### Task 7: Certified Run Evidence and Metrics

**Files:**
- Modify: `src/benchmark/benchmark-runner.mjs`
- Modify: `src/benchmark/benchmark-scorer.mjs`
- Create: `src/benchmark/run-evidence-journal.mjs`
- Create: `src/benchmark/failure-taxonomy.mjs`
- Test: `tests/benchmark-certified-evidence.test.mjs`

**Interfaces:**
- Runner records adapter/version/environment hashes, resource metrics, corrections, interventions, retained patch, artifacts, and failure class.
- Scorer reports pass@1, verified criteria, regressions, variance, confidence, resource, correction, and keep-rate metrics.

- [ ] Write failing tests for raw evidence fingerprints, process/resource/correction metrics, secret-safe artifact references, failure taxonomy, variance/confidence, and reproducibility.
- [ ] Verify RED.
- [ ] Implement evidence journal and extend runner/scorer without breaking existing run records.
- [ ] Verify GREEN plus benchmark runner/scorer tests.
- [ ] Commit `feat: record certified benchmark evidence`.

### Task 8: Comparative Claim Lock and Independent Certification

**Files:**
- Modify: `src/benchmark/independent-attestation.mjs`
- Create: `src/benchmark/comparative-certification-service.mjs`
- Test: `tests/comparative-certification-service.test.mjs`

**Interfaces:**
- Produces: `ComparativeCertificationService.certify({ suite, runs, contracts, attestation })`

- [ ] Write failing tests proving fake providers are smoke-only, incomparable budgets block certification, minimum common tasks are enforced, attestation must cover normalized raw evidence, and statistical separation is required.
- [ ] Verify RED.
- [ ] Implement certification readiness, platform/distribution disclosures, benchmark-specific hardcoding lock, and claim explanation.
- [ ] Verify GREEN plus independent attestation tests.
- [ ] Commit `feat: enforce comparative certification claim lock`.

### Task 9: Lazy Security Certification Plane Integration

**Files:**
- Create: `src/security/security-certification-plane.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Test: `tests/security-certification-plane.test.mjs`
- Modify: lifecycle contract tests that compare full `DecisionPlane.snapshot()` objects.

**Interfaces:**
- `DecisionPlane` wrappers expose security analysis, quarantine, dependency/SBOM, exfiltration, audit, sandbox/failure scenarios, comparability, and certification.

- [ ] Write failing tests proving fast path does not load the plane, each subsystem loads independently, snapshot is bounded/privacy-safe, close releases lifecycle, and `app.mjs` has no direct internal imports.
- [ ] Verify RED.
- [ ] Implement lazy facade and DecisionPlane wrappers/lifecycle field.
- [ ] Verify GREEN plus DecisionPlane, verification, construction, and composition tests.
- [ ] Commit `feat: integrate lazy security certification plane`.

### Task 10: Runtime Evidence Surface

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `ui/collaboration-experience-center.js`
- Modify: `ui/collaboration-experience-center.css`
- Modify: `extensions/vscode/src/mission-state.ts`
- Test: `tests/security-certification-http-ui.test.mjs`
- Test: `tests/vscode-security-certification-state.test.mjs`

**Interfaces:**
- Local API/UI/VS Code expose bounded security blockers, quarantine state, audit integrity, benchmark comparability, and claim readiness from the same DecisionPlane source.

- [ ] Write failing tests for capability-gated API actions, bounded projections, Evidence Center disclosure, accessibility, VS Code event bounds, and no shell/merge execution.
- [ ] Verify RED.
- [ ] Implement compact Evidence panels and state projections without new top-level navigation.
- [ ] Verify GREEN, UI tests, and `npm run build:vscode`.
- [ ] Commit `feat: expose security certification evidence surfaces`.

### Task 11: Release Measurement, Audit, and Gates

**Files:**
- Create: `src/release/security-resilience-verifier.mjs`
- Create: `src/release/comparative-certification-verifier.mjs`
- Create: `scripts/measure-security-certification.mjs`
- Create: `scripts/verify-security-resilience.mjs`
- Create: `scripts/verify-comparative-certification.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Test: `tests/security-certification-release-gates.test.mjs`

**Interfaces:**
- Adds required gates `security-resilience-supply-chain` and `comparative-certification-harness`.

- [ ] Write failing gate tests requiring source behavior, measurement receipt, version-aware audit transition, limitations, and comparative non-claims.
- [ ] Verify RED.
- [ ] Implement deterministic measurement, verifiers, gate registration, evidence mapping, and honest 1,150-item statuses.
- [ ] Verify GREEN and all frontier gates 2.16–2.28.
- [ ] Commit `release: add 2.28 security certification gates`.

### Task 12: Version, Documentation, Full Matrix, and Artifacts

**Files:**
- Modify all version surfaces to `2.28.0`.
- Create release notes, verification report, adversarial weakness matrix, limitations, audit, gaps, manifests, measurement, checksums, release evidence, and change set.

- [ ] Update package/runtime/launcher/SDK/VS Code/README/version surfaces and preserve all historical limitations.
- [ ] Regenerate every inherited measurement on the 2.28 source tree and run version coherence.
- [ ] Run focused tests and all frontier gates.
- [ ] Commit the clean release tree.
- [ ] Run `npm test`, runtime/SDK/ForgeOS/Windows/package/reconstruction/archive gates, and merge canonical matrix groups if the interactive runner times out.
- [ ] Verify the exact exported `/mnt/data` artifacts, checksums, archive integrity, matrix receipt, audit count, source identity, evidence log count, change-set lineage, composition budget, and clean Git tree.
