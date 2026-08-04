# Repository Discovery & Architecture Intelligence Center 1.7.0

## Goal

Close the repository-discovery partial requirements with evidence-backed detection rather than heuristic claims, and expose the result through an authenticated, project-scoped, futuristic UI.

## Architecture

`RepositoryDiscoveryService` scans only the selected project workspace. It reads a bounded allowlist of manifests and configuration files, derives structured findings, and attaches evidence records containing relative path, line range, SHA-256, confidence, and detector. It never reads known secret files and never returns absolute paths, raw environment values, credentials, or arbitrary file contents.

The service emits one immutable snapshot with sections for languages, frameworks, package/build/test/lint/typecheck tooling, monorepo/workspaces, entry points, CI, containers, migrations, databases, API style, conventions, architecture, generated/vendor paths, commands, environment-variable names, agent documentation, and Git cleanliness. Unsupported conclusions remain `unknown`; no conclusion may be labelled detected without evidence.

The authenticated HTTP API exposes snapshot and refresh operations. `Repository Intelligence Center` is lazy-loaded and visualizes evidence coverage, architecture, commands, risks, and unknowns. The release matrix adds a dedicated gate that tests detector accuracy, secret exclusion, source wiring, UI lazy loading, and versioned artifact inclusion.

## Safety and evidence rules

- All paths returned to clients are workspace-relative.
- Secret-path patterns are excluded before reading.
- Environment detection reports variable names only, never values.
- Commands are read from trusted manifest text; nothing is executed.
- Git inspection uses fixed argv and has bounded output/time.
- Each finding has source evidence or remains `unknown`.
- Snapshot receipt is SHA-256 over the public normalized payload.
- UI is read-only in this component.

## Success criteria

1. Detect the 23 partial repository-discovery items in section 11 when evidence exists.
2. Correctly leave unsupported attributes unknown.
3. Exclude secret files and absolute paths.
4. Provide authenticated API and lazy UI.
5. Add a mandatory full-release-matrix gate.
6. Update the item-level audit only for findings with direct test evidence.
