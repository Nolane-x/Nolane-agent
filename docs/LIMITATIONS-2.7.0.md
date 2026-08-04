# Forge Studio 2.7.0 — remaining limits

The item-level source of truth is `docs/feature-audit-2.7.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.7.0.md`.

## Parser and language boundary

Forge Studio does not use Tree-sitter in this release. Relationship extraction is backed by the vendored TypeScript compiler and is limited to JavaScript, TypeScript, JSX, and TSX syntax. It does not claim language-general inheritance indexing for Java, C#, Python, Rust, Go, or other languages.

## Resolution boundary

A resolved inheritance edge proves only that the indexed local evidence matched the bounded resolution rules. Dynamic mixins, runtime prototype mutation, generated declarations, path aliases not represented by relative imports, declaration merging across unsupported layouts, and framework-specific metaprogramming may remain unresolved. Ambiguous matches are retained as explicit evidence rather than guessed.

## Issue boundary

Forge Studio does not synchronize with remote issue providers. It does not query GitHub, Jira, GitLab, Azure DevOps, Linear, or another hosted tracker, and it does not validate whether a referenced issue exists, is open, belongs to the current repository, or has a particular title or status.

Forge Studio does not infer issue truth from an isolated number or hash token. A local source or commit reference is indexed only when an explicit contextual keyword is present. The resulting link is evidence that the repository text referenced the key, not proof that the code fully fixes or implements that issue.

## Git boundary

Commit-to-file relationships depend on the locally available Git history and the files reported by that commit. Shallow clones, rewritten history, unavailable commits, submodule history, ignored external repositories, or repositories without Git metadata reduce the available evidence without being silently replaced by guesses.

## Production boundary

A passing local release gate proves source implementation and direct automated tests in this source tree. It is not independent certification of semantic completeness for every codebase, language, issue convention, Git topology, operating system, or enterprise policy configuration. Authenticode, Apple notarization, hosted cloud conformance, marketplace approval, and independent comparative benchmarks still require external infrastructure or evidence.

## Local handoff boundary retained from 2.6.0

Forge Studio does not clone repositories as part of local handoff. It does not accept arbitrary filesystem paths from the HTTP request or VS Code command. Local handoff does not execute shell commands, and Forge Studio does not transfer tasks to cloud in this flow. The opened path must still originate from a server-produced managed-worktree bundle and pass the extension schema and receipt checks.
