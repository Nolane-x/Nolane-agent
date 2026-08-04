# Forge Studio 2.11.0 release notes

## Command Execution Security & Human Control

Forge Studio now normalizes command execution into an executable plus bounded argv before any process is spawned. Bash, PowerShell, CMD, and WSL receive explicit launch contracts and shell-specific audit previews. Non-interactive execution retains `shell: false`; argument filtering rejects NUL bytes, newlines, oversized argument vectors, and unsupported shell forms.

A new command-governance layer classifies system changes, permission changes, administrator elevation, firewall changes, service control, download-and-execute chains, outbound transfer, dangerous SQL, and sensitive uploads. Execution requires exact principal, project, task, session, capability, and approval scope. Plaintext secret findings are represented by type and fingerprint only.

Development servers now use managed-process tools with real PID ownership, duplicate prevention, process-group termination, and close-time cleanup. Interactive terminal sessions pass through the same shell codec and governance decision before PTY creation. Approval bundles reduce repeated prompts only for identical, noncritical requests and never create or widen permission.

## Audit movement

Twenty checklist items move from partial to source-and-test verified: 18.10, 18.18, 18.19, 18.20, 18.21, 18.22, 18.23, 18.28; 19.6, 19.11, 19.12, 19.14, 19.15, 19.16, 19.17, 19.18; 23.48; 24.15, 24.16; and 25.1. Exact counts are generated in `docs/feature-audit-2.11.0.json`; every remaining non-verified item appears in `docs/REMAINING-GAPS-2.11.0.md`.
