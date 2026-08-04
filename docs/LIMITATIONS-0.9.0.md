# Forge Studio 0.9.0 — remaining limits

Date: 2026-07-28

## Item-level audit

| Status | Count | Meaning |
|---|---:|---|
| Source + automated test | 523 | Direct implementation and a relevant automated test exist in this source tree. |
| Partial | 192 | Related behavior exists, but the exact requirement is incomplete or not proven across its full surface. |
| External gate | 52 | Completion requires live infrastructure, native runners, credentials, signing identities, marketplace validation, or independent evaluation. |
| Not implemented | 23 | No sufficiently specific implementation exists in this source tree. |

The machine-readable source of truth is `feature-audit-0.9.0.json`.

## Remaining implementation gaps

### User-interface surfaces

The default workroom does not yet provide complete dedicated views for traces, an embedded browser, dependency graphs, permission administration, model administration, MCP administration, secret administration, and sandbox administration. Their underlying services and APIs vary in completeness, but the checklist asks for explicit usable UI surfaces, so these items remain missing.

### Code intelligence and AST mutation

- No embedded tree-sitter runtime or incremental multi-language parse forest.
- No general semantic-vector repository search.
- No complete inheritance graph or issue-to-code index.
- No general AST-query language.
- No language-general AST patch engine.

The LSP gateway, symbol index, call hierarchy, lexical/regex search, and symbol-aware edits do not automatically satisfy those separate requirements.

### Local kernel isolation and resource quotas

- ToolBroker enforces path, command, environment, timeout, cancellation, output, and process-group controls, but it does not directly enforce CPU, RAM, process-count, or disk quotas on every supported local OS.
- Podman, Windows Job Objects/AppContainer, and production macOS sandbox profiles are not implemented end to end.
- Local worktrees and process policy must not be described as microVM-grade isolation.

### Worktree handoff ergonomics

Dependency-ordered integration is implemented, but dedicated “open this worktree in the selected IDE” and “transfer this remote task to a local checkout” workflows remain incomplete.

## External gates

- **Windows:** Authenticode certificate, trusted timestamp, SmartScreen/reputation behavior, and physical Windows execution.
- **macOS:** Developer ID signing, hardened runtime, notarization, stapling, and physical Intel/Apple Silicon execution.
- **Linux:** native distribution/package signing and runtime tests across supported distributions.
- **Cloud:** real gVisor/Kata isolation, CSI and Cilium enforcement, encryption, load/autoscaling, disaster recovery, and data-residency evidence.
- **Enterprise:** external IdP and SCIM conformance, penetration testing, and organizational compliance assessment.
- **IDE marketplaces:** VS Code and JetBrains marketplace verification and publisher signing.
- **Benchmark:** independent operator, identical tasks/budgets, raw receipts, signed attestation, and statistically separated confidence intervals against competing agents.

## Truthfulness rule

A local contract test proves the local contract only. It does not prove external infrastructure behavior or authorize a competitive claim. The release matrix and benchmark claim gate fail closed when required evidence is absent.
