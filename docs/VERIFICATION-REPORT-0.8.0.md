# Forge Studio 0.8.0 verification report

Date: 2026-07-28

This report separates source behavior, integration contracts, packaging checks, and external production gates. All results below were rerun from the recovered 0.8.0 source tree after ForgeOS 0.6.1 synchronization.

## Source gates

| Gate | Command | Fresh result |
|---|---|---|
| Forge Studio syntax and regression suite | `npm run validate` | **284 passed, 0 failed**; `src/app.mjs` syntax check passed |
| Source startup/auth smoke | `npm run smoke` | health 200 on loopback; unauthenticated API access rejected |
| Evaluation smoke | `npm run eval` | deterministic report generated; SHA-256 `d3ca5c0cab9b517ca4b798b3a8564a37f81b2b4742b5bed412452eb5d160038c` |
| Feature audit | `npm run audit:features` | **790 items**: 405 verified, 209 partial, 52 external, 124 missing |
| VS Code recovered package validation | `npm run build:vscode` | version 0.8.0, protocol 0.8, 2 compiled JS files, 12 commands, loopback/HTTPS and SecretStorage gates passed |
| Native modules | `npm run test:go` | launcher, PTY, and credential modules passed |
| ForgeOS 0.6.1 validation | `cd vendor/forge-os && npm run validate` | **411 passed, 0 failed**; syntax/JSON/docs/skills/adapters validation passed |
| Self-benchmark | `npm run benchmark:self` | 3 runs; `independent: false`; `claimAllowed: false` |

The complete command logs are staged under `release/verification/` in the source release.

## Direct integration evidence

- ForgeOS model tools produce redacted, content-addressed receipts.
- Twelve read-only ForgeOS schemas are available by default; remote execution remains hidden unless task capability and one-time approval are valid.
- Range reads, head/tail reads, regex search, and process stdin are bounded and covered by direct tests.
- Enterprise/cloud recovery tests cover tenant-scoped RBAC, OIDC PKCE/nonce/state, SCIM deactivation, queue lease fencing/retry/dead-letter/autoscaling, sandbox policy/persistence, OAuth MCP scopes/sessions, and plugin Ed25519 trust/revocation/transparency.
- The self-benchmark cannot authorize comparative claims. Finalization requires an Ed25519 attestation bound to the exact suite and run digest and a trusted evaluator key.

## Windows bootstrap package gates

Artifact: `ForgeStudio-0.8.0-electron-windows-x64.zip`

| Check | Fresh result |
|---|---|
| ZIP integrity | passed |
| Portable manifest | **2,055 files**; every byte count and SHA-256 matched |
| Staged source runtime smoke | health 200; unauthenticated API access 401 |
| `ForgeStudio.exe` | PE32+ Windows GUI x86-64 |
| `ForgePty.exe` | PE32+ Windows console x86-64 |
| `ForgeCredential.exe` | PE32+ Windows console x86-64 |
| Electron runtime | pinned 43.2.0 first-run bootstrap with SHA-256 verification |
| Authenticode | **not signed**; no production certificate was available |
| Physical Windows 11 launch | **not run in this Linux verification environment** |

The update-payload ZIP also passed ZIP integrity. It is an unsigned staged payload, not a published signed update feed.

## Claims boundary

Passing these local gates does not prove:

- live multi-tenant Kubernetes/microVM isolation, load behavior, disaster recovery, or compliance;
- production identity-provider/SCIM interoperability;
- physical Windows/macOS/Linux desktop execution;
- Authenticode, macOS notarization, IDE marketplace acceptance, or reputation behavior;
- independent superiority over Codex or Claude Code;
- completion of the **385** checklist items currently classified as partial, externally gated, or not implemented.
