# Forge Studio 3.3.0 — Repository Truth Plane

## Release scope

This release promotes exactly 11 Repository Digital Twin requirements that were `partial` in 3.2.0: `32.2`, `32.3`, `32.4`, `32.7`, `32.9`, `32.10`, `32.11`, `32.12`, `32.15`, `32.17`, and `32.18`.

The implementation adds:

- `RepositoryFactLedger`: immutable, bounded facts tied to project, branch, worktree, dirty state, editor overlay, provider, citation, and source hash.
- `RepositoryTruthMapBuilder`: citation-bound Architecture, Symbol, and Runtime maps with explicit unknowns and rejection of uncited provider edges.
- `RepositoryWorkspaceStateAdapter`: real local Git branch, worktree, HEAD, dirty files, and unsaved editor overlays.
- `RepositoryEvidenceQueryPlanner`: a fixed exact → lexical → AST/LSP → graph → Git → test → semantic → runtime evidence ladder with finite budget and explicit unavailable stages.
- `RepositoryTruthViewer`: bounded pages and zoom from workspace/domain/service/file/symbol to source span, with content-addressed cursors.
- Repository Digital Twin v2 and lazy Repository Intelligence Fabric integration while preserving the v1 node/edge compatibility surface.

## Audit result

The 1,150-item audit reports:

- `verified_source_test`: 996
- `partial`: 91
- `external_gate`: 63
- `not_implemented`: 0

This is not a claim that all 1,150 requirements are production-certified. Every remaining partial and external-gated item is listed in `docs/REMAINING-GAPS-3.3.0.md`.

## Legacy external runtime optional-pack continuity

Forge Studio 3.3.0 preserves the already certified optional artifact `ForgeStudio-LegacyExternalRuntime-2.16.0.zip` through the existing content-addressed carry-forward policy. It does not invent or republish a NolaneNative 3.3.0 archive, and core artifacts do not bundle `nolane_native-agent-main.zip`.
