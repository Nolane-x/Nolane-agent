# Forge Studio 2.11.0 Command Execution Security & Human Control Design

## Goal

Turn the remaining local terminal, dangerous-command, approval-fatigue, SQL, sensitive-upload, and chat-secret checklist items into directly verified behavior without claiming remote or operating-system isolation.

## Scope

This release targets exactly these checklist items:

- 18.10 pseudo-terminal support
- 18.18 argument filtering
- 18.19 shell escaping
- 18.20 Windows PowerShell
- 18.21 CMD when required
- 18.22 Bash
- 18.23 WSL
- 18.28 no unmanaged server process
- 19.6 system-changing commands
- 19.11 permission-changing commands
- 19.12 execute code downloaded from the internet
- 19.14 administrator execution
- 19.15 firewall changes
- 19.16 service start
- 19.17 service stop
- 19.18 outbound data transfer
- 23.48 approval-fatigue resistance
- 24.15 dangerous SQL blocking
- 24.16 sensitive-data upload blocking
- 25.1 do not store API keys in chat

Remote execution, container isolation, network namespaces, and cloud approvals remain outside this release.

## Architecture

### Structured command boundary

All non-interactive commands continue to execute with `spawn(executable, argv, { shell: false })`. A new `CommandExecutionGovernanceService` validates the command before process creation. It receives a structured request and returns an immutable decision receipt. It never accepts a shell command string.

The service normalizes:

```js
{
  command,
  args,
  cwd,
  env,
  stdin,
  commandClass,
  shellKind,
  networkIntent,
  server,
  approval
}
```

It rejects NUL bytes, CR/LF in executable or arguments, excessive argument count/length, disallowed environment keys, URL credentials, ambiguous shell wrappers, and unsafe WSL distribution names.

### Shell codecs and capability registry

`ShellCommandCodec` supports bounded display and explicit interactive-shell argument construction for:

- Bash
- PowerShell
- CMD
- WSL launching Bash

Execution remains argv-based. Quoting exists for display, audit, and the explicit `-Command`/`/d /s /c` interactive-shell boundary only. Each shell adapter exposes a platform capability result and exact executable/argv mapping. Unsupported adapters fail closed.

### Risk classifier

`CommandRiskClassifier` classifies commands using executable and argv tokens rather than substring matching a rendered shell string. Categories include:

- `system-change`
- `permission-change`
- `download-and-execute`
- `administrator`
- `firewall-change`
- `service-start`
- `service-stop`
- `outbound-transfer`
- `dangerous-sql`
- `sensitive-upload`

Critical categories never receive implicit approval. They require a matching capability grant or an explicit decision token supplied by the trusted caller.

### Secret, SQL, and upload guards

The governance service uses `SecretScanner` over argv, stdin, selected environment values, and upload source content. Receipts contain only finding types and fingerprints. Plaintext secrets never appear in command previews, audit records, or approval descriptions.

Dangerous SQL includes destructive statements and broad mutation patterns such as `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, `ALTER SYSTEM`, writable-schema changes, and `DELETE`/`UPDATE` without a `WHERE` clause. These are denied unless a `database.mutate` authorization is present.

Outbound upload or transfer commands are denied when the payload contains secret findings or when the source path matches protected credential files. Safe uploads still require `file.upload` plus `network.use` authorization.

### Approval fatigue resistance

`ApprovalBundleService` groups repeated, identical, non-critical approval requests by a canonical fingerprint within a bounded time window. A bundle records count and affected task IDs but does not widen scope or auto-approve anything. Critical and `always` capabilities are never bundled. Changing executable, arguments, destination, capability, or project creates a new bundle.

### Managed server processes

`ToolBroker` gains three bounded tools:

- `process.startManaged`
- `process.stopManaged`
- `process.listManaged`

`startManaged` requires `server=true`, a positive PID, a unique server ID, and command-governance approval. The broker stores process-group metadata and always terminates the entire process tree on stop, broker close, timeout, or startup failure. `process.run` rejects `commandClass=dev-server` so long-running servers cannot escape PID management.

### Terminal and PTY

The existing native PTY client remains the interactive execution path. `TerminalService` uses the shell adapter registry to validate Bash, PowerShell, CMD, and WSL requests. Direct tests prove creation, input, resize, snapshot, exit, frame bounds, PID exposure, and managed sandbox attachment. This release does not claim that Windows shells execute on the Linux release runner; it verifies exact argv contracts and uses capability detection.

## Data flow

1. Trusted caller submits structured command input.
2. Task contract and allowlist checks run.
3. Argument and shell validation run.
4. Risk, SQL, secret, and upload classification run.
5. Required capabilities are checked.
6. Approval bundling emits an approval bundle only when a decision is required.
7. An allow receipt is passed to ToolBroker or TerminalManager.
8. Process starts with `shell: false`; managed servers are registered before success is returned.
9. Output is secret-redacted and linked to the governance receipt.

## Failure behavior

- Missing or stale approval: deny before spawn.
- Secret in chat-like command fields: deny and return fingerprints only.
- Dangerous SQL without authorization: deny before spawn.
- Sensitive upload: deny before network activity.
- Server without PID management: deny.
- Unsupported shell/platform: fail closed with capability evidence.
- Managed server startup failure: terminate process group and remove registry entry.
- Broker shutdown: terminate all managed server groups.

## Testing

Tests use real child processes where the Linux runner can verify behavior and pure contract tests for Windows-specific argv mappings. Direct release-gate tests require source, ToolBroker wiring, PTY tests, approval bundling, audit movement, documentation boundaries, and Full Release Matrix inclusion.

## Non-claims

- PowerShell/CMD/WSL contract tests are not Windows production certification.
- Shell escaping is not used to make arbitrary shell strings safe; structured argv is the default.
- Approval bundling does not auto-approve or persist broader authority.
- SQL classification is a guardrail, not a complete SQL parser or database authorization system.
- Managed process cleanup is best effort if the operating system refuses process termination.
