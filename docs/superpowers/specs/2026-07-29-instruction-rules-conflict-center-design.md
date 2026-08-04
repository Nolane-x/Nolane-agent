# Instruction Rules & Conflict Center 1.8.0 Design

## Goal

Turn repository guidance into a bounded, explainable instruction-policy graph that supports global, repository, directory, language, and task scopes without allowing project text to override Forge security policy.

## Architecture

`InstructionDiscovery` remains the compatibility reader used by AgentLoop. A new `InstructionPolicyService` consumes discovered records plus explicitly configured global instruction roots, resolves safe imports, validates typed frontmatter, builds precedence and inheritance edges, computes effective typed rules, and reports conflicts and invalid records. Free-form Markdown remains guidance only; only frontmatter `rules` values participate in deterministic conflict resolution.

The trust boundary remains server-side. Project instructions are unavailable until workspace trust is granted. Global roots are opt-in configuration and are never inferred from arbitrary home directories. Imports must remain within an approved root, reject symlinks, traversal, cycles, excessive depth, excessive bytes, and unsupported file types.

## Typed frontmatter

Supported keys:

- `scope`: `global`, `repository`, `directory`, `language`, or `task`.
- `languages`: bounded string list.
- `tasks`: bounded string list.
- `priority`: integer from -1000 through 1000.
- `imports`: bounded list of relative Markdown paths.
- `rules`: flat typed mapping whose values are string, number, boolean, or null.
- Existing `globs`, `alwaysApply`, and `description` remain supported.

Unknown keys are preserved as metadata but do not affect policy. Invalid typed fields create visible invalid records instead of being silently ignored.

## Precedence

The deterministic order from lowest to highest precedence is:

1. global
2. repository
3. directory, ordered by directory depth
4. language
5. task

Within the same scope and depth, lower priority is applied first, then normalized source path. Higher-precedence rules override lower-precedence values. Two applicable records at the same precedence tuple defining different values for the same key create a conflict. Conflicts remain visible and the effective rule is withheld until a higher-precedence unambiguous value resolves it.

## Data flow

1. Discover bounded instruction files and their provenance.
2. Parse typed frontmatter and body.
3. Resolve safe imports with cycle and traversal protection.
4. Filter records by paths, language, task type, and workflow invocation.
5. Build inheritance/precedence graph.
6. Compute effective rules, conflicts, invalid records, omissions, and receipt.
7. AgentLoop receives selected guidance plus a compact policy summary.
8. Authenticated API and lazy UI expose allowlisted policy state.

## UI

Instruction Governance Center contains:

- Effective Rules
- Precedence Graph
- Conflicts
- Invalid Records
- Sources & Imports

It uses the existing futuristic Control Center visual language, is lazy-loaded, never exposes absolute paths or hidden prompts, and provides refresh/filter controls. It is read-only in 1.8.0; source files remain edited through normal file tools and diff review.

## Release evidence

A dedicated `instruction-policy-governance` gate verifies typed scopes, inheritance, precedence, conflicts, invalid records, safe imports, API wiring, UI lazy loading, audit coverage, and source-package inclusion. The exhaustive Remaining Gaps Report remains mandatory.

## Non-goals

- Inferring contradictions from arbitrary natural-language prose.
- Allowing repository instructions to alter Forge security policy, approval rules, audit, or trust state.
- Executing imported scripts.
- Reading unconfigured user-global directories.
