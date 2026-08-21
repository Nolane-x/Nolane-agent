# Codex App Server Run Authority Design

Date: 2026-08-21
Status: approved by the workspace owner for inline implementation

## Goal

Make the selected Nolane Agent run authority reach the Codex App Server. A
run created with **Full access** must use Codex's `danger-full-access` sandbox
and answer its approval requests automatically. Other runs remain fail-closed
when no interactive Nolane approval exists.

## Root cause

`permissions.defaultMode: full` is translated to the `deep` agent mode and
copied into each task's metadata. The Agent Loop never passes it to the
provider. Codex App Server consequently starts all sessions read-only, while
`src/app.mjs` installs a handler that always returns `decline`.

## Contract

`resolveCodexAppServerExecutionPolicy(task)` is the sole translation from
persisted task metadata to App Server policy.

| Task metadata | Sandbox | Automatic approval |
| --- | --- | --- |
| Valid `deep` policy that allows writes and commits | `dangerFullAccess` | `true` |
| Valid writable non-deep policy | `workspaceWrite` | `false` |
| Missing, malformed, or read-only policy | `readOnly` | `false` |

The Agent Loop sends this policy only when the selected provider is
`codex-app-server`. ProviderRegistry keeps it on the logical-session scope.
The adapter normalizes and records it by App Server thread, sends the matching
thread and turn sandbox shapes, and gives it to the approval handler. The app
accepts only the normalized automatic Full-access policy. Unknown/resumed
threads have no policy and are declined.

## Non-goals

- No new interactive approval-card RPC bridge.
- No changed permissions for CLI/API providers, browser automation, OS tools,
  packaging, credentials, or signing.
- No unsigned 0.0.0 release.

## Verification

Focused Node tests prove policy resolution, registry propagation, and the
Codex thread/turn/approval boundary. The focused suites, full Node suite, and
GitHub CI must pass before merge.
