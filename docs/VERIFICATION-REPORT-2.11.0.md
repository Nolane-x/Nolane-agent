# Forge Studio 2.11.0 verification contract

A 2.11.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Command execution governance gate

`command-execution-governance` must prove:

- bounded argv filtering and shell-specific Bash, PowerShell, CMD, and WSL launch contracts;
- non-interactive execution with `shell: false` and no free-form child-process shell strings;
- pre-spawn classification for system, permission, administrator, firewall, service, download-and-execute, outbound-transfer, and dangerous-SQL actions;
- exact capability and approval scope bound to principal, project, task, session, command, arguments, working directory, and environment fingerprints;
- plaintext-secret, dangerous-SQL, and sensitive-upload denial before process or network execution;
- bounded approval grouping that never combines critical or always-approval requests and never grants permission;
- PID-managed development processes with duplicate rejection, process-group cleanup, and no unmanaged server execution through `process.run`;
- governed interactive PTY creation with linked receipts and stable fallback task identity;
- item-level audit evidence for all twenty checklist requirements;
- explicit platform and non-claim boundaries in `docs/LIMITATIONS-2.11.0.md`;
- inclusion in source reconstruction and release packaging.

All verification evidence is bound to the exact Git commit and written beneath `release/matrix-2.11.0/`.
