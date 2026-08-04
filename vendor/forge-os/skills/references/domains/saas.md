# Saas Domain Pack Playbook

This reference is loaded on demand by ForgeOS skills. It does not replace the selected skill's contract.

## Pack boundary

- Lifecycle coverage: product-definition → ux-design → architecture → planning → implementation → verification → release-readiness
- Skills: `designing-saas-tenancy`, `designing-saas-onboarding`, `designing-saas-billing`, `enforcing-saas-quotas`, `testing-saas-entitlements`, `measuring-saas-activation`, `reducing-saas-churn`, `operating-saas-support`
- Source of truth: typed artifacts, confirmed decisions, current hashes, findings, and evidence—not conversational memory.

## Decision discipline

For every owned decision, record the problem, constraints, alternatives, selected option, rejected options, assumptions, verification method, expiry condition, downstream consumers, and invalidation targets.

## State coverage matrix

Review normal, empty, boundary, invalid, unauthorized, duplicated, reordered, delayed, concurrent, partial-failure, dependency-failure, retry, cancellation, recovery, migration, rollback, abuse, and observability behavior whenever applicable.

## Evidence hierarchy

1. Executable deterministic checks against the current artifact hash.
2. Independent review and adversarial cases.
3. Primary or authoritative external evidence with freshness metadata.
4. Structured analysis with explicit assumptions.
5. Narrative explanation only as supporting context.

## Cross-skill bridge

A producer publishes a typed handoff envelope. The router validates inputs before activating the consumer. Upstream changes invalidate only graph descendants. Reviewers do not modify worker output; they open findings. Gatekeepers return only pass, fail, or blocked with rule IDs and evidence.

## Token discipline

Load direct dependencies first. Retrieve references, source excerpts, code symbols, and historical decisions by stable ID on demand. Do not preload this entire pack or repeat unchanged artifacts.
