# Forge Studio 1.7.0 release notes

Date: 2026-07-29

## Repository Discovery & Architecture Intelligence Center

Forge Studio 1.7.0 adds evidence-bound repository discovery. The detector does not claim a framework, command, database, API style, architecture, or toolchain unless it can cite a relative source path, exact line, and SHA-256 content hash.

### Detected surfaces

- Primary and secondary source languages.
- Frameworks and package managers.
- Build systems, test runners, formatters, linters, and type checkers.
- Monorepo/workspace topology and entry points.
- Configuration files, CI workflows, Docker/Compose files, migrations, and databases.
- REST, GraphQL, and gRPC source signals.
- Naming and architecture conventions.
- Generated and vendor paths.
- Development, build, test, lint, format, type-check, and deployment commands.
- Environment variable names from templates only; values are never read.
- Agent instruction documents and Git cleanliness.

The Repository Intelligence Center presents Architecture, Toolchain, Commands, Evidence, and Unknowns views through a lazy-loaded, project-scoped UI.

## Complete remaining-gaps report

Every partial, external, and not-implemented checklist item is now emitted into `REMAINING-GAPS-1.7.0.md` and `release/remaining-gaps-1.7.0.json`. Each item includes the reason it remains open, current evidence, and the condition required to complete it. The full release matrix rejects stale or incomplete reports.

## Release matrix

The mandatory matrix adds `repository-discovery-intelligence` and `remaining-gaps-report` to every prior governance, runtime, ForgeOS, NolaneNative, SDK, IDE, audit, benchmark, reconstruction, packaging, and archive-integrity gate.
