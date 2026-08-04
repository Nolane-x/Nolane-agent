# Forge Studio 0.3.0 verification report

This report is completed from fresh release-gate commands. It distinguishes verified behavior from environment-dependent behavior.

## Automated suites

- Forge Studio Node suite: 130 tests passed, 0 failed.
- Vendored ForgeOS suite: 389 tests passed, 0 failed.
- Native launcher, PTY helper, and credential helper Go suites passed.
- Windows launcher, PTY, and credential binaries cross-compiled as PE32+ x86-64.

## Verified release behaviors

- Source startup binds loopback and writes an authenticated runtime handoff.
- Staged portable dependency closure starts with the host Node runtime and returns HTTP 200 from `/health`.
- Portable manifest includes both native helpers and content hashes.
- Update payload excludes `data`, `runtime`, and local update configuration.
- Ed25519 release manifest generation and verification pass.
- Update safe extraction, traversal/hash rejection, apply, rollback, incomplete-apply recovery, and Windows replacement implementation are covered by tests.
- ZIP integrity and final SHA-256 verification are run after artifact creation.

## Environment limitations

- The build environment cannot execute Windows PE binaries, so actual ConPTY and Windows Credential Manager behavior requires a Windows 11 acceptance run.
- Chromium in this environment is governed by an enterprise URL block policy that blocks loopback pages. HTTP/API/UI static tests pass, but a full local browser rendering smoke cannot be completed here.
- The environment cannot download npm tarballs, so Monaco/xterm installation is verified with deterministic package fixtures and pinned SRI values. The release uses the one-time verified installer rather than prebundled assets.
- The EXEs are not Authenticode-signed.
- No benchmark currently establishes superiority over Claude Code or Codex.
