# ForgeOS v0.6 Skill Intelligence

ForgeOS v0.6 treats a skill as a typed, sectioned, evaluated technique—not a large prompt file.

## Inventory

- 1,024 legacy typed outcome scaffolds;
- 128 deep Skill Contract v2 techniques;
- 32 L0 orchestration, context, trust, and learning techniques;
- 96 L1 cross-domain engineering techniques;
- 128 evaluator bindings;
- 33 stable procedural providers and 242 candidates;
- 1,024 reference-only knowledge mappings.

Outcome, technique, provider, evaluator, rule, hook, and agent role are separate identities and are never added together as one skill count.

## Contract v2

A technique defines precise triggers and anti-triggers, typed inputs/outputs, tools, invariants, a domain-specific procedure, fallback/stop conditions, verification, section budgets, compatible models, evaluator bindings, maturity, and inherited policy-profile hashes. Shared trust policy is inherited instead of repeated in every body.

## Section materialization

The main `SKILL.md` remains short. Procedure, decisions, verification, failure modes, examples, references, evaluators, and optional scripts are indexed separately with SHA-256 and token counts. The RoutePlan selects sections; the materializer verifies path, digest, maturity, tools, approvals, conflicts, and budget before loading them.

Section identity is canonical across LF and CRLF checkouts, so a platform line-ending conversion cannot silently invalidate an otherwise unchanged package. A mismatched canonical digest still fails materialization.

## External skill intake

`forge_skill_intake` imports exactly one bounded, immutable external bundle into quarantine. It requires an archive/snapshot pin, a single declared `SKILL.md` identity, content and package digests, a declared license, and a static risk scan. It rejects prompt/system override attempts, remote pipe-to-shell patterns, root-deletion requests, credential-read requests, malformed paths, oversized bundles, and duplicate tenant content before a provider record is written. Undeclared external writes and unknown licenses require review.

Intake neither executes nor downloads the submitted files and never auto-promotes them. A clean scan produces a **candidate** assessment but persists the provider in **quarantine** pending evaluation and human approval. The three examples under `examples/skill-intake-kit-2026-07-28/` are candidate-only source material from the locally inspected kit, not certified or active skills.

## Routing

The unified router performs direct technique-trigger retrieval and outcome-graph retrieval. Anti-triggers and hard policy execute before ranking. Measured utility is segmented by task/model context and cannot override quarantine, missing tools, stale source, or evidence requirements. The public benchmark currently reports Precision@1 93.75%, Precision@3 100%, Recall@6 100%, unsafe activation 0%, and deterministic replay 100% on the pinned regression corpus.

## Maturity boundary

The 66 newly compiled L1 packages and most L0 additions remain candidate. Schema validity and public fixtures do not justify stable status. Stable promotion requires RED baseline evidence, multiple cases/seeds, independent evaluation, confidence, materialization, and human review according to risk.

See [Skills](SKILLS.md), [Eval Lab v2](EVAL-LAB-V2.md), [Global Context Kernel](GLOBAL-CONTEXT-KERNEL.md), and [Claims Boundary](CLAIMS-BOUNDARY-V0.6.md).
