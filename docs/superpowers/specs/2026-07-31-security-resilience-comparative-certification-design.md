# Forge Studio 2.28.0 Security Resilience & Comparative Certification Design

## Goal

Build a local-first security and certification plane that traces untrusted data to dangerous sinks, protects capability and audit boundaries, evaluates dependency and artifact integrity, exercises sandbox/failure escape paths, and runs reproducible comparative benchmarks under locked model, token, time, machine, permission, and repository conditions.

## Scope

This release covers frontier requirement groups 43 and 45. It extends existing guardrails, secret scanning, dependency intelligence, failure injection, benchmark runner, scorer, attestation, resource accounting, and release evidence. It does not claim that Forge Studio has defeated Codex, Claude Code, Cursor, or Copilot without raw external runs and independent certification.

## Architecture

One lazy `SecurityCertificationPlane` is owned by the existing `DecisionPlane`. It exposes three focused subsystems:

1. **Security Intelligence** — taint/data-flow analysis, contextual injection detection, prompt-injection quarantine, dependency risk, SBOM/provenance, secret/exfiltration control, short-lived capability tokens, audit hash chains, integrity quarantine, and self-protection rules.
2. **Adversarial Runtime Resilience** — sandbox escape scenarios, environment/socket/credential leakage checks, expanded bounded fault injection, orphan/FD/disk/process scenarios, and post-fault recovery/verification receipts.
3. **Comparative Certification** — locked benchmark manifests, repository contamination controls, adapter/version/environment capture, raw evidence journals, failure taxonomy, resource and correction metrics, confidence intervals, independent attestation, and comparative-claim locks.

Every subsystem uses canonical, bounded, privacy-safe receipts. Raw secrets, prompt text, model output, cookies, authorization headers, environment dumps, and unbounded command output are prohibited.

## Security Intelligence

### Taint and Contextual Injection Analysis

`TaintAnalysisEngine` accepts bounded source facts and exact graph edges. Taint labels include user input, repository content, website content, terminal output, tool output, environment, secret material, and downloaded artifact. Supported sinks are shell, SQL, network, filesystem, template, dynamic code, prompt/context, memory, trace, log, and artifact.

A finding requires a source-to-sink path with provenance and source hashes. Sanitizers are typed by sink; a SQL sanitizer cannot clear shell taint. Ambiguous dynamic edges remain ambiguous and never become proof of safety. Critical unsanitized paths block patch authorization or execution.

`ContextualInjectionDetector` recognizes command, SQL, path, template, code, and prompt-injection patterns using sink context and escaping history. It returns findings, not rewritten production code. `PromptInjectionQuarantine` screens repository, browser, terminal, and tool content before context ingestion and emits a safe bounded projection plus quarantine receipt.

### Dependency and Supply Chain

`DependencyRiskIntelligence` combines exact lockfile/manifest facts with supplied vulnerability, license, abandonment, and malicious-package evidence. No network lookup is performed implicitly. Dependency upgrades require compatibility evidence, API existence, test receipts, and a signed approval decision.

`SbomProvenanceService` produces a CycloneDX-like bounded SBOM for source, packages, model packs, plugins, and release artifacts, including exact commit, digest, origin, license evidence, and build lineage. `IntegrityQuarantine` blocks dependency/model/plugin/artifact use when digest, signature, provenance, policy, or compatibility checks fail.

### Secrets, Exfiltration, Capabilities, and Audit

`ExfiltrationGuard` scans prompts, context, memory, trace, logs, artifacts, network requests, and errors. It blocks secret material and suspicious high-entropy or cross-boundary payloads, while preserving hashes and bounded summaries for audit.

Mission capability tokens are short-lived, scope-bound, single- or limited-use, and revocable. Existing capability stores remain the authorization source of truth; the new plane adds mission token issuance and revocation receipts, not a second permission database.

`AuditHashChain` signs ordered security decisions with previous-receipt hash, sequence, actor, scope, and event digest. Tampering, deletion, reordering, or forked history is detected. `ProtectedBoundaryGuard` denies agent-authored changes to policy, verifier, audit, capability, release-gate, and security-boundary files unless an explicit human-governed override receipt is supplied.

Evidence thresholds scale with reversibility and impact. Irreversible or high-impact actions require stronger independent evidence.

## Adversarial Runtime Resilience

`SandboxEscapeAdversarialSuite` executes adapter-driven local fixtures for:

- path traversal and encoded traversal
- symlink and junction escape
- mount/root boundary escape
- child-process escape and orphan creation
- environment leakage
- socket/network escape
- credential/helper escape
- writable policy/verifier/audit boundary attempts

It never performs a real destructive escape against the host. Adapters provide an isolated fixture root and bounded commands; the suite proves that Forge Studio blocks or detects the attempt.

`ExtendedFailureScenarioLab` reuses `FailureInjectionLab` and adds network timeout, DNS failure, provider overload, RAM pressure, process death, orphan child, FD exhaustion, database lock, disk full, and file-race scenarios. Every scenario requires checkpoint, bounded injection, cleanup, resume, criterion re-verification, and no irreversible action while uncertain.

## Comparative Certification

### Locked Suite and Case Manifests

Benchmark manifests include:

- suite/case version and distribution fingerprint
- exact repository URL or local source identity and commit
- contamination fingerprint and disclosure
- task category: bug, feature, refactor, migration, review, long-horizon, browser/UI, multi-agent, or security
- exact model/provider/harness/adapter version
- machine/platform/runtime fingerprint
- token, time, cost, RAM, process, network, filesystem, and permission budgets
- setup, objective, verification commands, hidden/public split marker, and artifact policy

The harness rejects runs when systems do not share the locked model/budget/environment contract. Fake providers may run smoke tests but are excluded from comparative certification.

### Run Evidence and Metrics

Each run records bounded raw-command fingerprints, environment manifest hash, exact adapter version, process-tree metrics, token/cost, latency, peak RSS, RSS-seconds, process count, verification receipts, first-patch success, correction cycles, reverted lines, human interventions, retained-patch state, artifacts, and failure taxonomy.

Raw output is stored through the content-addressed artifact store and secret-scanned. Benchmark reports include pass@1/verified-criteria success, regression rate, resource metrics, variance, confidence intervals, reproducibility, and failure classes.

### Claim Lock

A comparative claim requires:

- at least two real systems and a minimum common-task count
- exact comparable environment and budget contract
- no fake provider in certified runs
- independent signed attestation of raw evidence
- statistically separated verified-success intervals
- explicit benchmark version/distribution disclosure
- platform limitation disclosure
- no benchmark-specific code, prompt, rule, or hardcoded answer

Without these conditions the report must state `claimAllowed: false` and explain the missing gate.

## Integration

`SecurityCertificationPlane` is lazy and exposed through `DecisionPlane`. `app.mjs` must not import its internal services directly. The plane integrates with Verification Control and Construction authorization by returning blockers and receipts; it never edits files, upgrades dependencies, executes network calls, or promotes benchmark claims on its own.

Release status/API/UI may expose bounded security and certification snapshots, but 2.28 does not add a new top-level navigation shell. Evidence Center receives compact security findings and certification readiness only.

## Error Handling

- missing/stale provenance → fail closed or retain ambiguity
- secret or exfiltration detection → block and redact before boundary crossing
- invalid dependency/model/plugin digest → quarantine
- audit chain mismatch → tamper status and block certification
- sandbox scenario unavailable → explicit external gate, never pass by omission
- incompatible benchmark contract → reject before run
- fake provider in comparative set → smoke-only status
- missing independent attestation → comparative claim locked

## Testing

Every production module is introduced RED→GREEN. Required evidence includes:

- typed taint source-to-sink path and sanitizer mismatch
- contextual command/SQL/path/template/code injection findings
- prompt-injection quarantine across repository/browser/terminal/tool content
- dependency compatibility, SBOM/provenance, integrity quarantine
- secret/exfiltration blocking in prompt, memory, trace, log, artifact, error, and network boundaries
- short-lived capability revoke and audit hash-chain tamper detection
- protected policy/verifier/audit/capability file denial
- sandbox traversal/symlink/child/env/socket/credential fixtures
- expanded failure injection recovery receipts
- locked benchmark contract, fake-provider exclusion, contamination fingerprint, raw evidence metrics, variance/confidence, and independent claim lock
- lazy plane lifecycle and unchanged composition-root budget

## Release Gates

Two new required gates:

- `security-resilience-supply-chain`
- `comparative-certification-harness`

The gates verify direct behavior, measurement, audit transition, limitations, and non-claims. External competitor execution, private held-out suites, and full Windows/Linux/macOS certification remain partial or external until raw evidence is supplied.
