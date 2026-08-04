# Forge Studio 0.2.0 release notes

Release theme: **governed intelligence and bounded autonomy**.

## Added

- Incremental repository intelligence with task-ranked context and omission accounting.
- Exact unified patch tool with expected-hash conflict protection.
- Codex app-server protocol client.
- Adaptive provider routing and circuit breaker.
- Forge Action Protocol for read-only official CLI reasoning workers.
- Durable task interrupts and idempotent resume.
- Stdio MCP client, namespaced registry, and deny-by-default task-scoped MCP gateway.
- Isolated Builder worktrees and Reviewer attachment to candidate workspaces.
- Intelligent structured mission planning with repair and safety validation.
- Immutable inter-agent handoff packets.
- Automatic Git/test verification and commit/diff/receipt-bound evidence.
- Evidence-quarantined project memory.
- Governed Git inspector.
- Reproducible evaluation harness.
- Bounded run-to-completion mission autopilot.
- Expanded local workroom UI for Git, memory, MCP, evaluations, and automatic verification.

## Security changes

- Official coding CLIs now run as reasoning workers in scratch directories instead of receiving direct project write authority.
- Built-in and MCP tool schemas are progressively exposed by task capability.
- Task path ownership is enforced for reads, writes, patches, and process working directories.
- Autopilot fails closed on verification failure, cancellation, no-progress scheduling, and task-limit exhaustion.

## Compatibility

- Node.js 22.12 or newer.
- Windows x64 launcher; Windows bootstrap pins Node.js 22.16.0 x64.
- ForgeOS 0.6.1 authority bundle.

## Not claimed

This release does not claim to outperform Claude Code or Codex. It establishes the architecture, controls, and evaluation surface needed for reproducible head-to-head work. The release also does not contain an embedded PTY, Monaco editor, graphical merge editor, OS-keychain integration, remote worker fleet, code signing, or auto-update.
