# Forge Studio 1.3.0 — remaining limits

Date: 2026-07-29

The item-level source of truth is `feature-audit-1.3.0.json`. Source and automated tests do not prove external infrastructure availability.

## Diff-review boundary

- Partial reject currently supports modified files whose old and new paths are identical.
- Added, deleted, renamed, and binary files remain visible but cannot be partially rejected.
- Decisions operate in managed candidate worktrees; merging into a user branch remains a separate typed Git approval.
- The UI records hunk decisions but does not replace independent reviewer findings or final full-suite verification.

## Remaining local gaps

- Several dedicated administration views remain incomplete, including full trace, dependency-graph, model, MCP, secret, and sandbox management surfaces.
- Embedded tree-sitter parse forests, language-general AST query/patch, complete inheritance graph, and issue-to-code indexing remain incomplete.
- CPU, RAM, process-count, and disk quotas are not enforced natively on every local OS.
- Podman, Windows Job Objects/AppContainer, and production macOS Seatbelt profiles remain incomplete.
- Dedicated open-worktree-in-IDE and remote-to-local task handoff workflows remain incomplete.

## External gates

Authenticode, Apple notarization, native validation on every supported OS, live multi-tenant cloud conformance, enterprise IdP/SCIM conformance, public marketplace approval, and an independently operated comparative benchmark remain external gates.
