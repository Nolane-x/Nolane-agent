# Forge Studio 0.8.0 release notes

Date: 2026-07-28

## ForgeOS 0.6.1 synchronization

- Replaced the vendored ForgeOS snapshot with the supplied 0.6.1 source tree.
- Added a bridge over ForgeOS v0.6.1 Skill Intelligence, deterministic execution graphs, universal lanes, globally budgeted context compilation, harness profiles, capability matrices, review scope, skill intake, adversarial surface scanning, and remote microVM contracts.
- Added twelve read-only model tools backed by content-addressed receipts.
- Kept `forge.sandbox.run` hidden unless a task has an explicit capability and a matching, unexpired, one-time human approval.

## Stronger local execution tools

- `fs.read` supports exact 1-based line ranges, head/tail reads, total-line metadata, bounded UTF-8 input, file hashes, and path/symlink policy.
- `fs.search` supports bounded literal and regular-expression search, deterministic traversal, ignored dependency/release trees, binary rejection, exact path/line/column results, and result/file caps.
- `process.run` supports bounded stdin through a pipe while preserving argv-only execution, shell disablement, env allowlisting, timeout, cancellation, descendant termination, output limits, and redacted receipts.

## Enterprise and cloud source recovery

- Recovered enterprise organization, OIDC Authorization Code + PKCE, session, SCIM, RBAC, and request-authorization modules into the source release.
- Recovered SQLite cloud queue, atomic lease/fencing, retry/dead-letter, autoscaling, sandbox policy, persistence, Kubernetes driver, and worker-runtime modules.
- Recovered OAuth-protected Streamable HTTP MCP and production plugin Ed25519/trust/revocation/transparency modules.
- Added a direct recovery test suite covering tenant isolation, PKCE/nonce/state, SCIM deactivation, queue fencing, cloud policy, MCP scopes/sessions, and plugin signing.

## Release and evidence tooling

- Added a deterministic 790-item checklist audit with item-level evidence.
- Added an honest validator for the recovered compiled VS Code extension; it does not pretend that missing TypeScript source was compiled.
- Added a deterministic self-benchmark whose report cannot authorize comparative claims.
- Added an Ed25519 independent-attestation finalizer bound to the exact suite and run digest.

## Compatibility and claims boundary

The source-tested contracts are substantial, but the release is not 100% complete against the checklist. Live multi-tenant Kubernetes operation, external IdP/SCIM conformance, public remote MCP hosting, production signing credentials, native macOS/Linux desktop release, JetBrains marketplace verification, and independent comparative benchmarking remain outside the locally verified scope. See `LIMITATIONS-0.8.0.md` and `FEATURE-COMPLETENESS-AUDIT-0.8.0.md`.
