# Forge Studio 0.5 Electron Recovery and Live Trace Design

## Goal

Replace the browser-app-mode launcher with a secure Electron desktop shell while fixing failed-run recovery and making every model/tool/verification step observable in plain language.

## User experience

A user opens Forge Studio, chooses a repository with a native folder picker, assigns an outcome, and watches a live trace. If a model, command, or verification step fails, Forge shows the exact safe reason and offers automatic recovery. Sending any follow-up to a failed run resumes from the nearest durable checkpoint without recreating the mission.

## Architecture

- Electron main process owns the window lifecycle, native dialogs, single-instance lock, and strict navigation policy.
- A sandboxed, context-isolated renderer loads only the loopback Forge UI. Node integration is disabled.
- Forge runtime runs in an Electron `utilityProcess`, not in the renderer or main process.
- The existing ForgeOS-governed agent runtime remains the source of truth for missions, checkpoints, tools, permissions, evidence, and recovery.
- A narrow preload bridge exposes only native folder selection, platform/version metadata, and desktop readiness.
- The runtime supervisor starts the utility process, waits for its authenticated handoff file, restarts boundedly after early crashes, and surfaces a recovery page rather than a blank window.

## Recovery contract

- Verification failure moves the task from `review` to `failed`, clears its lease, and persists a structured failure record.
- Retry resets failed, cancelled, and verification-stuck review tasks to `ready`.
- A follow-up message on a failed mission persists the message, performs the same recovery transition, and automatically launches the mission again.
- Failure details are secret-redacted and include stage, task, safe reason, failed check, command label, and exit code where available.

## Live trace contract

- Agent loop emits model, tool-start, tool-complete, verification, recovery, and checkpoint events.
- UI projects these events into human-readable activities with provider, target path/command label, duration, token usage, exit code, and bytes.
- Raw prompts, secrets, full environment values, and unrestricted command arguments are never rendered.
- Exact API usage is displayed when supplied; CLI usage is marked as an estimate.

## Electron security

- `app.enableSandbox()` before readiness.
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- Local loopback origin only; navigation and window creation are denied outside the runtime origin.
- Every IPC method validates sender URL and arguments.
- Permission requests are denied by default.
- No remote code, remote renderer, or CDN resource is loaded.

## Packaging

- Windows Electron runtime is pinned to a stable version and downloaded only during release construction.
- The app source is staged under `resources/app`; Electron is renamed to `ForgeStudio.exe`.
- Native ConPTY and Credential Manager helpers remain bundled.
- User data is stored in Electron's per-user `userData` directory and is excluded from update payloads.

## Verification

- Existing Studio and ForgeOS regression suites remain mandatory.
- New tests cover failed-run continuation, retry from review, failure projection, CLI token estimation, Electron policy, runtime supervisor, preload surface, and package closure.
- Release verification checks hashes, ZIP integrity, PE format, and a portable runtime smoke test where supported.
