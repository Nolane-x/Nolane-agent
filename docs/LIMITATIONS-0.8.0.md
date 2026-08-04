# Forge Studio 0.8.0 — Remaining limits

Date: 2026-07-28

## Audit result

The supplied checklist contains 790 item-level requirements across 28 sections.

| Status | Count | Meaning |
|---|---:|---|
| Source + automated test | 405 | Direct implementation and a relevant automated test exist in this source tree. |
| Partial | 209 | Related components exist, but the exact item is incomplete or not proven over the full surface. |
| External gate | 52 | Local contracts exist, but production completion requires live infrastructure, credentials, native runners, or independent evaluation. |
| Not implemented | 124 | No sufficiently specific implementation was found in the audited source tree. |

The machine-readable source of truth is `feature-audit-0.8.0.json`. A broad subsystem test never upgrades unrelated checklist items automatically.

## Highest-impact missing capabilities

### Code intelligence and editing

- No production tree-sitter/LSP integration, semantic vector search, full reference/definition engine, inheritance graph, or repository-wide call graph.
- No general AST patch engine, symbol-aware function/class replacement, reverse patch, three-way patch merge, or rename-aware patch application.
- Search now supports bounded literal/regex matching, but specialized import/TODO/compiler/log/diff/history query providers remain incomplete.

### Local isolation and resource enforcement

- Worktrees, path policy, process groups, timeout, output caps, command allowlists, and autonomy policy are implemented.
- CPU, RAM, process-count, disk, file-descriptor, network-namespace, and OS-kernel isolation are not enforced by the local ToolBroker.
- Podman, Windows Job Objects, and a production macOS sandbox backend are absent.
- Therefore an untrusted local repository must not be described as microVM-grade isolation.

### Cloud production operation

- Kubernetes manifests/drivers, tenant policies, quotas, persistence, TTL, region/residency checks, CSI secret references, and network-policy contracts exist and are tested locally.
- No live cluster was provisioned during this verification. There is no evidence here for real gVisor/Kata isolation, CSI integration, Cilium enforcement, encrypted storage, autoscaling under load, disaster recovery, or data-residency certification.
- ForgeOS remote microVM execution remains unavailable until a compatible HTTPS provider with signed request-bound receipts is configured.

### Enterprise conformance

- OIDC PKCE/nonce/state, JWKS verification, opaque sessions, RBAC, SCIM users/groups, tenant isolation, and audit paths are source-tested.
- No external identity provider, enterprise directory, SCIM conformance suite, penetration test, SOC 2/ISO 27001 audit, or regional compliance assessment was run.

### IDE, SDK, and desktop distribution

- The recovered VS Code extension is a compiled package with a structural validator, not a reproducible TypeScript-source build.
- A complete JetBrains plugin source/build and JetBrains Plugin Verifier result are not present in this recovered source tree.
- Python and TypeScript SDKs and standalone interactive/non-interactive CLIs are not implemented.
- Windows Authenticode signing, macOS Developer ID signing/notarization/stapling, and Linux package signing require external credentials and native release runners.
- The recovered native source remains Windows-centered; Linux/macOS desktop artifacts must not be called production releases without native build and runtime evidence.

### Git and delivery automation

- Repository inspection, worktree creation, safe rollback, status/diff evidence, and bounded Git commands exist.
- Dedicated typed providers for rebase, merge, cherry-pick, revert/reset, GitLab, Bitbucket, and end-to-end hosted PR creation are incomplete.
- Preview deploy, CI monitoring, and paid API/deploy actions remain provider-specific and require explicit credentials and policy.

### Benchmark claims

- The local self-smoke benchmark validates the harness only and is always marked `independent: false`.
- A claim that Forge Studio beats Codex or Claude Code requires the same public tasks, environment, budget, timeouts, raw receipts, success verifier, cost/latency accounting, independent operator, signed attestation, and statistically separated confidence intervals.
- No such independent result is included in 0.8.0.

## Recommended next implementation order

1. Production local isolation backend: Linux namespaces/cgroups/seccomp, Windows Job Objects/AppContainer, and macOS sandbox profiles.
2. Tree-sitter + language-server intelligence with incremental symbol/reference/call graph indexes.
3. Typed Git mutation/PR gateway with GitHub, GitLab, and Bitbucket adapters.
4. Reproducible VS Code and JetBrains source builds with marketplace verification.
5. Live Kubernetes conformance environment and external OIDC/SCIM interoperability tests.
6. Python/TypeScript SDKs and standalone CLI.
7. Independent benchmark program only after the above gates are reproducible.
