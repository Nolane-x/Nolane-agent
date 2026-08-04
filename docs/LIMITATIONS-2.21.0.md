# Forge Studio 2.21.0 — limitations

## Repository Intelligence Fabric boundary

Forge Studio 2.21.0 does not include or operate a production ONNX code-embedding model or ONNX runtime in Core. The ONNX path is a lazy verified contract; the release measurement uses a deterministic injected measurement adapter and is not a production neural model. Requirement 31.2 therefore remains partial.

The feature-hash provider remains an explicit degraded fallback. A successful fallback query proves bounded deterministic behavior, not neural semantic understanding. The provider registry reports this state rather than presenting fallback vectors as an operated code-embedding model.

Two-stage retrieval limits semantic reranking to a bounded candidate set selected by lexical, symbol, import/graph, path, and test evidence. This reduces work but does not prove complete recall, answer accuracy, or retained-patch improvement on real repositories.

Chunk Merkle reuse and branch fingerprints invalidate known changed chunks and reject known provenance mismatches. They cannot detect unsaved editor state or external changes that are never reported to Forge Studio.

The Repository Digital Twin contains cited structural relations. Runtime behavior is recorded as `runtime-observation-unavailable` unless an operated trace supplies evidence; Forge Studio does not infer or invent runtime edges from names. Calls, references, types, data flow, database schema, public APIs, architecture domains, and polyglot depth remain incomplete where the audit says partial or not implemented.

The deterministic measurement adapter and fixture are synthetic release evidence. Forge Studio 2.21.0 does not claim comparative superiority or that it outperforms Cursor, Codex, Claude Code, Copilot, Devin, or another agent. It is not an independent real-repository benchmark.

The item-level source of truth is `docs/feature-audit-2.21.0.json`. The incomplete and externally gated list is `docs/REMAINING-GAPS-2.21.0.md`.

## Decision Efficiency Loop and Context Engine V3 boundary

Forge Studio 2.21.0 does not claim comparative superiority over Cursor, Codex, Claude Code, Copilot, Devin, or another coding agent. The deterministic local fixture proves internal contracts and cost accounting; it is not an independent real-repository benchmark.

Decision-efficiency observations run in shadow mode and do not change provider routing automatically. `contextTokensActuallyUseful` is an attributed observation tied to verification metadata; it does not prove causal usefulness without future context-ablation replay.

The tokenizer adapter uses a real provider or harness tokenizer only when one is registered. Missing tokenizers use an explicit degraded deterministic fallback; Forge Studio does not claim universal model-tokenizer parity.

Context Engine V3 does not claim a learned context policy, context-ablation learning, ONNX code embeddings, or semantic retrieval superiority in this release. Utility and trust values are bounded policy inputs, not learned truth.

A criterion is counted only when its source-hash-bound receipt passes validation. This proves the recorded verifier result, not that every user requirement was perfectly decomposed into criteria.

The item-level source of truth is `docs/feature-audit-2.21.0.json`. The incomplete and externally gated list is `docs/REMAINING-GAPS-2.21.0.md`.

# Forge Studio 2.21.0 — remaining limits

## Adaptive Work Fabric boundary

Runtime leases govern logical provider completions and browser actions. They do not make one-shot third-party CLI adapters persistent, and they do not claim that Codex, Claude, Gemini or another provider reuses one operating-system process. True persistent provider hosts require a provider protocol that supports multiplexed logical sessions and separate process-lifecycle evidence.

A logical lease or session does not certify operating-system process-tree containment, CPU/RAM accounting, kernel isolation or cleanup for every child process. Forge Studio records admission, attribution and release; native containment remains bounded by the configured OS/container backend and its platform evidence.

The repository scheduler coalesces equivalent active/queued generations and cancels stale queued work. It does not make incremental indexing fully polyglot, cannot cancel a runner that ignores its abort signal, and does not prove that lexical, semantic or graph evidence is semantically complete. JavaScript/TypeScript remain the deepest local AST path; managed Tree-sitter and language-runtime operation remain external where documented.

Dynamic graph reconciliation does not prove semantic correctness of task decomposition, ownership declarations, generated patches or merges. Exact/prefix path and exact symbol ownership serialize known collisions, but undeclared dynamic dependencies, generated files, runtime metaprogramming and semantic conflicts can remain. Completed handoffs cannot be revised or revoked through the reconciler.

Uncertainty and information-gain thresholds are bounded scheduling policies, not calibrated scientific confidence. A stopped job may still have been useful, and an admitted job may still be wrong. Retry limits prevent unbounded loops but cannot distinguish every transient failure from a permanent one.

The synthetic measurement in `docs/adaptive-work-fabric-measurement-2.21.0.json` exercises local in-memory runners. It does not invoke or benchmark external model providers, Playwright browsers, hosted workers, network services or production repositories.

Linux source evidence does not certify Windows production behavior, WSL, Windows Job Objects, PowerShell/CMD cleanup, Electron GPU behavior, macOS sandboxing, cloud sandboxes, hosted pull requests, CI repair, marketplace approval or independent comparative superiority.

## Retained boundaries from 2.16.0

## Adaptive microkernel boundary

Enterprise and cloud modules are activated on demand, but this release does not make every service unloadable. Mission, project, policy, tool, evidence, provider routing and other essential local services still compose in the core process.

The governor uses system available memory together with process RSS and event-loop delay. Operating systems may report reclaimable cache, compressed memory or container limits differently, so thresholds reduce risk but do not guarantee that the host can never enter memory pressure.

The legacy external runtime was historically distributed as an optional compatibility pack. Core startup and ordinary coding work remain available without it; Legacy external compatibility capabilities return a bounded `NOLANE_NATIVE_PACK_NOT_INSTALLED` error until a pack matching the pinned byte count and SHA-256 is installed. The pack split reduces Core distribution size but does not reduce memory after the legacy external compatibility runtime is intentionally started.

Source and Linux tests do not certify Windows production behavior for WSL, PowerShell, CMD, Job Objects, Electron GPU fallback or operating-system memory reporting. Those claims still require the relevant platform runners and raw receipts.

The UI reduced-effects policy disables animation and blur under Lite or pressure states, but it cannot prove every Chromium/GPU driver combination will maintain a target frame time. Advanced centers still exist and the navigation information architecture remains a future simplification target.

The item-level source of truth is `docs/feature-audit-2.21.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.21.0.md`.


## Mission Completion & Runtime Readiness boundary

Architecture-stage evidence proves that the local source tree contains a coherent core, version-matched IDE extension, desktop multi-agent surface, and a cloud integration contract in that order. It is source evidence, not independent certification of every platform, marketplace package, desktop installer, or operated cloud environment.
Source evidence is not platform certification and does not certify Windows, macOS, Linux distributions, IDE marketplaces, or desktop installers.

The cloud stage is eligibility after the local stages only. Forge Studio 2.21.0 does not claim that a cloud agent, cloud sandbox, hosted control plane, or remote worker was operated by this local release matrix.

The local pull-request review phase reviews local Git evidence and collision receipts only. It does not create, update, merge, or review a hosted pull request on GitHub, GitLab, Bitbucket, or another remote provider.

Docker preflight does not create or run a container. It checks daemon availability, project-contained mount policy, sensitive destinations, and known Docker, Podman, SSH-agent, and credential socket escape paths. An available daemon is not proof of complete container isolation.

Task resource envelopes bound turns, tool calls, estimated tokens, and elapsed time in the agent runtime. They do not replace operating-system CPU, RAM, disk, process, file-descriptor, namespace, or container enforcement where those remain external gates.

## Local Operations & Human Control boundary

The Cost view reports recorded usage and cost values from Forge Studio's mission-state ledger only. It is not a provider invoice, billing reconciliation, or guarantee that an external provider charged the same amount.

The Call Graph view requires a configured and responsive language server. It can return an explicit unavailable result for unsupported languages, missing servers, stale indexes, or symbols without call-hierarchy support; Forge Studio does not invent graph edges.

A retained sandbox remains subject to CPU, memory, process, disk, violation, and watchdog enforcement and expires after a bounded TTL. Retention does not disable resource enforcement, grant new capabilities, or make process cleanup infallible.

The controlled cache is project-, principal-, and namespace-scoped and is not for secrets. Plaintext credentials and secret-like keys are denied; cache receipts contain metadata and hashes rather than permission to treat cached content as trusted.

Editing a command creates a new fingerprint and invalidates any prior approval. The edited candidate requires a fresh command-governance and capability decision before execution; Forge Studio does not carry approval from the previous command.

Image content is served only for project-contained supported image files through an authenticated endpoint. Repository-derived Git and call-graph text is rendered as sanitized plain text; sanitization is a bounded projection and not proof that arbitrary content is harmless.


## Planning evidence boundary

Planning evidence uses local repository metadata and deterministic ranking only. The scope estimate is heuristic and does not guarantee a perfect or complete change boundary. Missing dynamic files, generated files, unsupported repositories, stale indexes, or ambiguous objectives may reduce confidence.

Subagent recommendations are planning metadata only; Forge Studio does not spawn subagents merely because a step recommends one. Actual subagent execution still requires the existing agent-mode, capability, task, and runtime governance.

Related test, configuration, documentation, and source retrieval uses local repository evidence only. This flow does not call external search services, hosted issue trackers, cloud code indexes, or private remote repositories. A summary counts and ranks evidence; it does not prove semantic relevance.

A structured `PLANNING_INPUT_REQUIRED` error indicates that the planner needs a more specific outcome. It does not guarantee that every missing requirement can be detected automatically.

The item-level source of truth is `docs/feature-audit-2.21.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-2.21.0.md`.

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
## Git completion and conflict boundary

Forge Studio does not push branches or create pull requests through Git Completion Governance. Remote metadata is read for evidence only. Remote push, hosted pull-request creation, provider credentials, and hosted CI operation remain separate external gates.

Forge Studio does not accept raw Git argv, shell commands, a repository root, or a workspace root through the Git governance HTTP endpoints. All Git mutations remain task-, project-, principal-, and path-bound.

Forge Studio does not automatically resolve semantic conflicts. A conflict-resolution receipt proves that a previously recorded textual merge conflict is absent in a fresh non-mutating `git merge-tree` projection, the involved worktrees are clean, related diffs are accepted, and supplied tests passed. It does not prove that the chosen behavior is semantically correct.

A clean textual merge does not prove correctness. Build, test, security, product, performance, platform, and human-review risks may remain and must be recorded as test receipts or residual-risk evidence. Forge Studio does not force-push or rewrite history through this flow.



## Atomic patch transaction boundaries

`fs.patchSet` is an all-or-rollback Forge transaction; it does not claim a multi-file filesystem atomic primitive. It supports existing regular UTF-8 files only, while create, delete, and rename remain separate tools. The formatter runs on transaction temp files only and receives one exact `{file}` argument per touched file; Forge does not invoke a whole-project formatter through this tool. No generated-code override is supported, and protected comments cannot be bypassed through the patch-set API. Rollback is best-effort when the underlying filesystem itself becomes unavailable; any rollback failure is surfaced instead of hidden.


## Command execution governance boundaries

Non-interactive ToolBroker and managed-process execution use an executable plus validated argv with `shell: false`; Forge Studio does not claim support for arbitrary free-form shell strings through these paths. Shell-specific quoting is an audit preview and is not reused as an execution string.

PowerShell, CMD, and WSL have source contracts and direct automated tests in this Linux-built source tree. This is not Windows production certification. A production Windows claim still requires a Windows runner, the intended PTY/native host, real PowerShell and CMD binaries, WSL distribution evidence where applicable, and raw process/cleanup receipts.

Approval bundles group only identical, noncritical pending requests by fingerprint. They do not grant a capability, widen a path/domain/argument scope, convert denial to allowance, or bypass a required human decision. Critical and `always` approval requests are never bundled.

The risk classifier is a bounded static/token classifier over normalized executable and argv data. It reduces ambiguity but cannot prove semantic harmlessness for every script, interpreter, database dialect, downloaded payload, or operating-system utility. Unknown or ambiguous high-impact actions remain subject to capability and approval policy.

Managed-process cleanup uses owned positive PIDs and process-group termination where the operating system supports it. Cleanup is best-effort if the operating system, process table, or host becomes unavailable; failures are surfaced and are not represented as successful cleanup.

Plaintext secret detection stores finding type, source, and fingerprint rather than the secret value in command-governance receipts. This does not replace operating-system secret storage, short-lived credentials, remote-provider controls, or post-compromise rotation.

## Evidence Context Runtime boundaries

- The runtime is local-only and adds no new remote service or network dependency.
- It does not persist chain-of-thought or hidden reasoning. It stores public evidence, decisions, summaries, receipts, and source references only.
- Hybrid retrieval is not vector-only: it fuses lexical, semantic, structural, runtime, and historical sources.
- Context-aware recovery produces recommendations and does not execute rollback, delegation, dangerous actions, or hypothesis changes by itself.
- Legacy subagent output remains compatible. Structured results are evidence-validated only when a profile or runner supplies them.
- A retrieval score is relevance evidence, not proof that a claim is correct. Counter-evidence and runtime validation remain necessary.
- Context leases invalidate known source relationships; they cannot detect external changes that are never reported to Forge Studio.


## Adaptive Harness Lab boundary

Forge Studio 2.21.0 selects immutable public harness profiles by provider family and composes bounded provider-specific instructions and tool ordering. A provider-specific harness does not guarantee better model quality, semantic correctness, or benchmark superiority for every repository or task.

The runtime does not autonomously mutate or promote a harness from online production feedback. Production telemetry alone does not promote a candidate. Promotion requires an explicit operator action bound to a passing local replay report for the same profile family and exact candidate SHA-256; rollback restores only the previously active profile identity.

Harness failure telemetry accepts only bounded identifiers, task kind, failure class, retryability, fingerprints, timestamps and evidence receipts. It rejects raw prompts, model output, environment data and unknown fields; it does not persist chain-of-thought or hidden reasoning.

This release does not attribute or certify provider/browser child process-tree CPU, RSS or file-descriptor cost per mission. Process-tree accounting remains a later evidence-driven release slice.

This release does not implement or certify full browser journey verification. DOM, accessibility, network, console, screenshot and video repair/replay receipts remain incomplete.

## Mission Resource Fabric boundary

Forge Studio 2.21.0 attributes sampled process-tree CPU, RSS, process count and file descriptors to missions where the operated platform driver exposes those measurements. It does not certify process-tree accounting on every production operating system; Windows and macOS still require target-platform runners and raw receipts, and operating-system accounting may differ for compressed or shared memory.

Logical provider sessions are reused only when the provider protocol explicitly exposes session operations. Forge Studio does not claim that a one-shot CLI is persistent, multiplexed, or process-reused merely because its calls pass through the session host. Under pressure, brownout or emergency states, reusable idle sessions can be evicted and new calls can deliberately fall back to one-shot execution.

Browser journey receipts record bounded DOM, accessibility, console, network, assertion and artifact evidence. A screenshot or video does not prove visual correctness, product correctness or user-perceived quality, and the recorder does not infer visual correctness from image bytes. Complete Playwright operation still depends on an installed and operable browser runtime on the target platform.

The hosted lifecycle remains fail-closed without an operated provider adapter and credential. It does not automatically merge pull requests; a human merge decision is required after local verification, branch creation, pull-request creation and passing CI. External provider availability, permissions, policies and service behavior remain external gates.

Harness canary assignment is deterministic and can automatically disable a regressing candidate, but a canary does not autonomously promote a harness profile. Production canary evidence does not promote a candidate without the existing replay, governance and explicit promotion controls.

The synthetic Mission Resource Fabric measurement does not establish independent comparative superiority over Cursor, Claude Code, GitHub Copilot, Devin or another agent. It verifies bounded source behavior in this release tree only.
