# Forge Studio 0.5.0 release notes

## Fixed: verification deadlock

A failed verification previously left a task in `review`, while retry only recovered `failed` or `cancelled` tasks. The mission therefore had no ready work and a follow-up message was stored without restarting Autopilot. Version 0.5.0 moves failed verification to a recoverable state, reconciles legacy review-stuck tasks, and automatically relaunches the mission when the user sends a follow-up after failure.

## Electron desktop shell

The browser app-mode launcher has been replaced by an Electron architecture. Electron owns the window, the Forge runtime runs in an isolated utility process, and the renderer uses sandboxing, context isolation and a minimal preload bridge. Runtime exit no longer destroys the desktop shell or the persisted mission state.

## Better live observability

The main task card now shows the active provider, target, action and last progress time. Tool lifecycle events expose safe file/command targets, duration, exit code and byte counts. CLI providers report bounded estimated tokens rather than a misleading zero.

## Provider and safety behavior

Provider onboarding from 0.4.1 remains. Forge refuses to create a mission without an authenticated healthy provider. Autopilot remains governed by ForgeOS and cannot bypass hard-stop actions.

## Packaging note

The Windows ZIP is an Electron bootstrap package. Electron 43.2.0 is downloaded once on the user machine and accepted only after pinned SHA-256 verification. The release does not claim that the Electron runtime is embedded.
