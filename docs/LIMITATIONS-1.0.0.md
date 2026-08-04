# Forge Studio 1.0.0 — remaining limits

Date: 2026-07-29

The item-level source of truth is `feature-audit-1.0.0.json`. Version 1.0.0 does not redefine local contract tests as proof of external infrastructure.

## Remaining local implementation gaps

- Several dedicated administration views remain incomplete, including full trace, dependency-graph, permission, model, MCP, secret, and sandbox management surfaces.
- Embedded tree-sitter parse forests, a language-general AST query/patch engine, complete inheritance graph, and issue-to-code index remain incomplete.
- CPU, RAM, process-count, and disk quotas are not enforced natively on every local operating system.
- Podman, Windows Job Objects/AppContainer, and production macOS Seatbelt profiles are not complete end to end.
- Dedicated “open worktree in selected IDE” and remote-to-local task handoff workflows remain incomplete.

## External gates

- Windows Authenticode certificate, timestamping, SmartScreen/reputation, and physical Windows validation.
- Apple Developer ID signing, hardened runtime, notarization, stapling, and native Intel/Apple Silicon validation.
- Native Linux distribution/package signing and broad distribution testing.
- Real gVisor/Kata, CSI, Cilium, encryption, load, autoscaling, disaster recovery, and data-residency evidence.
- External IdP/SCIM conformance, penetration testing, and compliance assessment.
- VS Code and JetBrains marketplace publisher validation.
- Independent comparative benchmark with identical tasks/budgets, raw receipts, signed attestation, and statistically separated confidence intervals.
