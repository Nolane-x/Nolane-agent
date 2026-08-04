# Forge Studio 3.1.0 — Intelligence Completion Kernel

## Release scope

This release promotes exactly 13 requirements that were `not_implemented` in 3.0.0: `30.13`, `30.14`, `30.15`, `31.12`, `32.5`, `32.8`, `32.13`, `32.16`, `33.6`, `33.7`, `36.12`, `36.13`, and `36.17`.

The implementation is split into six bounded local services and one lazy integration surface:

- `ContextLearningKernel`: query expansion, verified-only evidence utility, and context-card ablation replay.
- `PagedVectorStore`: checksummed INT8 pages, page-local reads, bounded selection, and memory telemetry.
- `RepositoryIntelligenceCompletionService`: cited repository relations, module map, architecture zones, and Git risk profile.
- `ProgramAnalysisKernel`: bounded CFG and interprocedural DFG with explicit dynamic ambiguity.
- `VariableLineageService`: evidence-bound temporal binding transitions.
- `CounterfactualPatchAblator`: isolated per-hunk ablation under the unchanged verification contract.
- `RepositoryIntelligenceFabric`: lazy adapters that do not expand the application bootstrap or repository fast path.

## Audit result

The 1,150-item audit for 3.1.0 is expected to report:

- `verified_source_test`: 972
- `partial`: 115
- `external_gate`: 63
- `not_implemented`: 0

This does not mean all 1,150 requirements are fully production-certified. Partial and external-gated requirements remain open and are enumerated in `docs/REMAINING-GAPS-3.1.0.md`.

## Legacy external runtime optional-pack continuity

Forge Studio 3.1.0 does not republish the unchanged 67,431,284-byte NolaneNative Agent runtime archive. The release preserves upstream commit `846b14ab01a84483d2c3dd429579173040474585` and archive SHA-256 `1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9`, then references the already certified optional artifact `ForgeStudio-LegacyExternalRuntime-2.16.0.zip`.

The 3.1.0 release gate prefers direct archive verification whenever that pack is installed. When it is absent, the gate accepts only `vendor/nolane_native-agent/carry-forward-certification.json`, which binds the successful 3.0.0 matrix and NolaneNative receipts to exact hashes of the unchanged NolaneNative runtime and integration files. The resulting report uses mode `certified-carry-forward` and records `archiveReadInCurrentRun: false`.

Core source, Windows, update, and VS Code artifacts continue to exclude `nolane_native-agent-main.zip`. The release manifest marks the optional component `reuse-certified` and `publishedWithRelease: false`; it never lists or checksums a nonexistent 3.1.0 NolaneNative pack.
