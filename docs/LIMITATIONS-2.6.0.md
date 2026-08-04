# Forge Studio 2.6.0 — remaining limits

The item-level source of truth is `docs/feature-audit-2.6.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.6.0.md`.

## Handoff boundary

A local handoff is a governed continuation bundle. It does not prove that an IDE opened successfully, that any code was executed, that tests passed, or that the task completed. Task completion, verification, cost, and approval state remain derived from durable evidence rather than from the handoff request.

## Repository and path boundary

Forge Studio does not clone repositories as part of local handoff. It does not accept arbitrary filesystem paths from the HTTP request or VS Code command. The opened path must come from a server-produced managed-worktree bundle, must be absolute, and must pass the extension schema and receipt checks.

## Execution boundary

Local handoff does not execute shell commands. The VS Code helper calls only `vscode.openFolder`; it does not invoke `child_process`, a terminal, a task runner, or an extension-provided command string. Opening the folder does not grant additional tool permissions to the task.

## Cloud boundary

Forge Studio does not transfer tasks to cloud in this flow. The execution target is explicitly `local`. Cloud sandboxes, hosted runners, remote repository provisioning, and cross-host workspace synchronization remain separate external-gated capabilities.

## IDE boundary

The verified integration targets the packaged Forge Studio VS Code extension. It does not claim equivalent opening behavior in every IDE, marketplace approval, remote-development extensions, container workspaces, WSL remotes, SSH remotes, or Codespaces.

## Production boundary

A passing local release gate proves source implementation and direct automated tests in this source tree. It is not independent certification of every filesystem, Git installation, IDE build, operating system, or enterprise policy configuration. Authenticode, Apple notarization, hosted cloud conformance, marketplace approval, and independent comparative benchmarks still require external infrastructure or evidence.
