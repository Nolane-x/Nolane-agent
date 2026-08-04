# Forge Studio 0.6.0 Research Notes

## Browser automation

Forge uses the official Playwright CLI architecture rather than inventing coordinate-based computer control. The integration uses named sessions, persistent profiles, headed operation, bounded snapshots, targeted search, element refs, console/network inspection and screenshots. The runtime is pinned to 0.1.17 for this release and installed into a managed cache.

The design deliberately exposes concise CLI operations to agent context while keeping persistent browser state in the runtime. Browser write operations remain Forge capabilities rather than implicit model rights.

## Plugin compatibility

Forge imports compatible marketplace and plugin metadata for skills, agents, commands, MCP and LSP. Compatibility does not mean trust: source acquisition, package identity, activation and runtime capability are separate stages. Hooks are metadata-only and quarantined in 0.6.0.

## Design rule

Use upstream standards and focused utilities when they reduce implementation risk, but never let a third-party framework become the authority for permissions, secrets, worktree ownership, evidence or completion. Those remain ForgeOS contracts.
