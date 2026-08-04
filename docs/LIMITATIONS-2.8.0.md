# Forge Studio 2.8.0 — remaining limits

The item-level source of truth is `docs/feature-audit-2.8.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.8.0.md`.

## Parser and language boundary

AST Query/Patch do not use Tree-sitter. They remain backed by the vendored TypeScript compiler and are limited to JavaScript, TypeScript, JSX, and TSX syntax.

The code-relationship index does not use Tree-sitter; it remains backed by the vendored TypeScript compiler and limited to JavaScript, TypeScript, JSX, and TSX syntax.

A separate Tree-sitter CLI integration contract exists, but Tree-sitter is an external runtime gate in this release. A production claim requires the expected CLI and language grammar runtime to be installed, version-verified, exercised on the target platform, and bound to raw parse evidence. The Linux release runner used here does not provide that operated runtime, so the audit does not classify Tree-sitter as production-verified or `verified_source_test`.

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


## Integrated Browser boundary

The Integrated Browser is a controlled interface over Forge Studio browser sessions, not an unrestricted embedded web browser. It accepts HTTP and HTTPS URLs only, rejects URLs containing user information, treats page content as untrusted data, and does not expose cookie, authorization-header, password-manager, download-execution, or arbitrary local-file navigation controls.

## Secrets Manager boundary

The Secrets Manager displays credential metadata only. It does not reveal, export, copy back, or resolve stored plaintext through the UI. On Windows, durable operating-system storage still requires the native credential helper. Other platforms in the current local application use the documented session-memory backend unless another configured secret provider is operated.

## Native sandbox runtime boundary

Podman support requires an installed and operable rootless Podman runtime. The source contract and tests do not prove a daemon, image, kernel namespace, SELinux/AppArmor, seccomp, or mount policy on a production host.

Windows Job Objects require a Windows runner and the bounded Forge Job Object native helper. Source and protocol tests on Linux do not prove Windows kernel enforcement.

The macOS sandbox contract requires a macOS runner where `/usr/bin/sandbox-exec` is present and allowed. Linux tests do not prove macOS policy enforcement, and Apple platform availability or deprecation behavior must be checked on the target release runner.

These four native/runtime items remain `external_gate`. They are not `not_implemented`, but they are also not claimed as production-verified by the Linux release matrix.
