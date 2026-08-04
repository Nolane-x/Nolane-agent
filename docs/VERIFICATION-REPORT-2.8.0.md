# Forge Studio 2.8.0 verification contract

A 2.8.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Remaining completion gate

`remaining-completion` must prove:

- a lazy authenticated Integrated Browser surface over governed browser APIs;
- HTTP/HTTPS-only navigation and rejection of credential-bearing URLs;
- a metadata-only Secrets Manager with explicit set and delete operations;
- no reveal, resolve, plaintext export, or arbitrary credential injection UI;
- a project-bound Tree-sitter CLI contract with realpath containment, supported-file policy, bounded JSON output, version probe, authenticated API, and receipt;
- a rootless Podman argv contract with network deny by default, dropped capabilities, no-new-privileges, read-only root, resource bounds, and managed workspace mount;
- a Windows-only Job Object native-helper protocol that fails closed on other platforms;
- a macOS-only deny-default sandbox profile contract that fails closed on other platforms;
- no arbitrary native isolation execution endpoints;
- item-level audit movement for 4.21 and 4.30 to `verified_source_test`;
- item-level movement for 13.27, 21.4, 21.6, and 21.7 to `external_gate`;
- an audit count of zero `not_implemented` items;
- actual runtime capability probe evidence in the release receipt;
- inclusion in source reconstruction and release packaging.

## Inherited gates

All prior gates remain required, including code relationship intelligence, local worktree handoff, local resource sandbox, AST intelligence, semantic/dependency intelligence, mission governance, ForgeOS validation, SDK tests, Windows packaging, fresh-source reconstruction, and archive integrity.

Every partial or external-gated requirement must appear exactly once in `docs/REMAINING-GAPS-2.8.0.md` and the machine-readable remaining-gaps report. An external gate is not counted as completed production operation.
