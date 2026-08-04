# Checkpoint 14 — Test Hardening and Runtime Purity Report

**Product:** Nolane Agent 5.0.0-beta.6  
**Implementation commit:** `47d3cc6168489b696bce954aabaf2d04be8c974f`  
**Baseline:** `a4dc79910df33069962b1cf13209f231ff2ec6b5`  
**Date:** 2026-08-04  
**Status:** Source, static UI, runtime API, packaging, extension, evidence, and compatibility gates passed. Windows installation/update replay and external visual/accessibility certification remain external gates.

## 1. Scope

This checkpoint performed a repository-wide test and hardening pass across:

- Nolane Agent backend and HTTP control plane.
- Progressive UI source and production distribution.
- Electron security and installer contracts.
- VS Code extension build and validation.
- Model catalog and model-truth compatibility.
- Evidence, forensic receipts, release manifests, vendor manifests, and historical compatibility fixtures.
- Runtime ownership and product identity.
- Real loopback-runtime route and authentication behavior.

The checkpoint also removed the forbidden legacy runtime identifier from tracked paths, source content, generated distributions, nested ZIP/VSIX artifacts, model profiles, tests, documentation, evidence, and release tooling.

## 2. Runtime ownership result

The product ownership boundary is now explicit:

- **Nolane Agent** owns the product and orchestration system.
- **Nolane Native** is the Nolane-owned production runtime implementation.
- Historical research attribution is preserved as a neutral third-party provenance record.
- No external runtime, external model profile, external adapter, external package, or upstream archive is distributed under the Nolane Native identity.

The purity verifier scans both path names and file contents, including nested ZIP and VSIX archives. It also rejects misleading ownership language, not only exact string matches.

Final purity result:

| Metric | Result |
|---|---:|
| Files scanned | 5,561 |
| Forbidden path findings | 0 |
| Forbidden content findings | 0 |
| Nested archive findings | 0 |
| Ownership terminology findings | 0 |
| Purity status | PASS |
| Receipt | `996a53b25d4dce16faf6974297f733db74611dba7beefc14bd0bb8f7cd0e0bb9` |

Mutation tests prove that the gate rejects:

- A forbidden identifier in a tracked file path.
- A forbidden identifier in source content.
- A forbidden identifier hidden inside ZIP or VSIX content.
- Misleading language that represents Nolane Native as missing or third-party.
- An upstream research source falsely represented as Nolane-owned.

## 3. Model catalog correction

External model profiles were removed rather than relabelled as Nolane models.

Final bundled catalog:

- 560 exact model profiles.
- 74 model families/templates.
- Existing Model Truth and compatibility projections retained.
- Catalog receipts regenerated from the corrected source.

Unknown facts remain unknown; the migration does not convert absent evidence into fabricated capability, pricing, license, or deployment claims.

## 4. Backend runtime validation and defects fixed

A production runtime was started against a fresh local data directory and an ephemeral loopback port.

### 4.1 Authenticated smoke checks

Ten selected surfaces were exercised, including runtime state, onboarding, personalization, settings, model intelligence, Execution Story validation, Time Travel, manifest delivery, and authentication boundaries.

Result:

- 10 checks executed.
- 0 unexpected responses.
- Unauthorized runtime access returned HTTP 401.
- Model catalog reported 560 profiles.

### 4.2 Exact GET route sweep

Ninety-one exact GET routes were called against the running product.

The initial sweep exposed two real internal-server defects:

1. Git snapshot route threw when `projectId` was absent.
2. Browser permission route threw when `goalId` was absent.

Both were repaired at the contract boundary. The final behavior is:

- Missing required identifier: HTTP 400 with a structured code.
- Unknown resource: HTTP 404 with a structured code.
- Task/project mismatch: HTTP 409.
- No internal exception is exposed.

Final sweep:

| Status | Count |
|---|---:|
| HTTP 200 | 62 |
| HTTP 400 | 23 |
| HTTP 404 | 6 |
| HTTP 500 | 0 |
| Connection errors | 0 |
| Total | 91 |

Direct HTTP regression tests now lock the corrected error contracts.

## 5. Full repository certification

The final Node suite was executed from zero receipts under the implementation commit.

| Test system | Result |
|---|---:|
| Node tests | 2,348 / 2,348 PASS |
| Node test files | 848 / 848 PASS |
| Isolated pool cache | 0 |
| Packaging/integration cache | 0 |
| Go launcher module | PASS |
| Go PTY module | PASS |
| Go credential module | PASS |
| Python SDK | 3 / 3 PASS |
| Python held-out fixture | 2 / 2 PASS |

The Node run includes all serial packaging, release-tooling, VS Code bridge, native capability, model-provider, and historical compatibility gates.

## 6. UI and product-surface validation

The progressive UI was rebuilt from source and the production distribution was verified.

| Gate | Result |
|---|---|
| UI production files | 110 |
| Source/distribution receipt match | PASS |
| Design-token files | 21 |
| Undefined CSS variables | 0 |
| Token cycles | 0 |
| Raw colors outside primitives | 0 |
| UI capability surfaces | 22 |
| Missing required surfaces | 0 |
| Duplicate routes/IDs | 0 |
| Checkpoint 13 retention | PASS |
| Experience levels | 4 |
| Global destinations | 8 |
| Settings categories | 18 |
| Settings fields | 84 |
| Control Plane domains | 14 |
| Backend routes/domains | 426 / 105 |

Static source-level accessibility, responsive, offline, token, theme, i18n, and capability checks passed.

A real Chromium navigation/capture attempt was made, but the execution environment blocked localhost and file navigation with an administrator policy. Therefore this report does **not** claim external screenshot, screen-reader, or real-browser visual certification.

## 7. Electron and VS Code validation

### Electron

- App ID: `com.nolane.agent`.
- Stable NSIS GUID retained.
- Windows target remains NSIS x64.
- Narrow update IPC and installer security tests passed.
- No renderer-controlled installer path, URL, or command was introduced.

### VS Code extension

- Version: 5.0.0-beta.6.
- 19 commands validated.
- HTTPS-or-loopback policy enforced.
- VS Code SecretStorage used.
- Safe local-worktree open retained.
- VSIX structure validation passed.
- Direct VSIX purity scan passed.

## 8. Evidence and compatibility integrity

| Evidence system | Result |
|---|---:|
| Evidence requirements checked | 198 |
| Stale/missing evidence accepted | No |
| Canonical acceptance items | 1,460 |
| Verified items | 1,372 |
| External gates | 88 |
| Implemented-not-wired | 0 |
| Not implemented | 0 |
| Evidence hashes checked | 10,603 |
| Fresh evidence | PASS |
| Native inventory entries | 7,617 |
| Owned behavior candidates | 2,110 / 2,110 |

Historical evidence and provenance readers retain versioned compatibility. Generated manifests and receipts were regenerated using repository tools rather than edited by hand.

Complete and superiority claims remain locked because external certification gates are still open.

## 9. External gates and non-claims

This checkpoint does not claim completion of:

- Real Windows CP13-to-CP14 installer/update replay.
- Automatic post-install relaunch certification on Windows.
- Windows binary rollback and full multi-store recovery replay.
- Authenticode production signing.
- Real Windows 8 GB performance certification.
- External screen-reader audit.
- External screenshot/visual certification.
- Long-duration provider and runtime dogfood.

These are deliberately retained as external gates rather than represented as passed by Linux or static tests.

## 10. Conclusion

The source, UI distribution, backend contracts, Electron/VS Code surfaces, evidence chain, model catalog, release tooling, historical compatibility, and nested artifacts have been re-tested and hardened. The forbidden legacy runtime identity is absent from the tracked source and generated release artifacts, while legitimate historical third-party attribution remains preserved without being bundled or represented as Nolane-owned technology.

The checkpoint is suitable as the source basis for the remaining Windows, accessibility, performance, and long-duration external certification work.
