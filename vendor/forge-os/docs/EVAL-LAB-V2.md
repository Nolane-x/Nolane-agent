# Eval Lab v2

Eval Lab v2 prevents a skill producer from deciding whether its own skill is good enough to promote.

## Evaluation order

1. Deterministic executable checks.
2. Domain-specific analyzers where available.
3. Independent semantic judges.
4. Human/domain review for critical techniques.

An executable failure is a blocker regardless of an aggregate semantic score. Producer output may contain text and usage data, but self-reported `quality`, `passRate`, or completion claims are not promotion metrics.

## Independent judges

A judge has a declared trust domain. The author and primary judge cannot share the same trust domain for accepted evaluation. Multiple judges produce rubric items, bounded uncertainty, and evidence spans. The release artifact stores aggregate evidence and corpus hashes; hidden prompts are not published.

## Maturity

ForgeOS distinguishes experimental, candidate, validated, stable, certified, deprecated, and quarantined states. Maturity depends on Skill Depth, public and holdout cases, model-family coverage, confidence lower bound, critical failures, human review, and production evidence.

The 29 new L0 packages remain candidate. Their existence, schema validity, and public evaluator fixtures do not justify stable status. Three L0 techniques preserve stable status because they migrate already-tested v0.4 behavior, but they still require expanded v0.5 holdout evidence before certification.

## Skill-TDD

Every new or changed technique should start with a failing behavioral baseline. The failure and rationalization are recorded; a minimal skill is written; the same matrix is rerun; new loopholes are added as regression cases. The current release provides the runtime and package format for this workflow. It does not claim that 1,024 deep techniques have completed it.
