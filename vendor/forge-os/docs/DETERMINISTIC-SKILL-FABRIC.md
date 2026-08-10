# Deterministic Skill Fabric

A skill is not only prose. ForgeOS v0.5 models it as a hybrid program in which deterministic stages protect coverage and evidence while an agent performs contextual reasoning.

## Deterministic stages

The current fabric provides:

- scope compilation from include/exclude policy;
- related-file work-unit bundling;
- coverage-ledger tracking;
- rule selection by file, task, and artifact properties;
- finding anchoring to file, content hash, and line range;
- evidence validation;
- reflection that cannot suppress deterministic failures.

A completion claim is invalid while any required work unit is unprocessed. A changed file hash invalidates an old anchor. Reflection may classify an agent finding as a false positive, but executable failures and missing coverage remain blockers.

## Agent stages

The agent receives a bounded investigation problem: the selected work unit, matching rules, necessary technique sections, relevant artifacts, and stop conditions. It may generate hypotheses and apply domain judgment, but it does not decide the deterministic scope or forge coverage evidence.

## Why the separation matters

Large language models are strong at contextual interpretation but unreliable at exhaustive bookkeeping. File coverage, exact ranges, hashes, command exit status, and required-rule selection should be deterministic whenever possible. The result is both cheaper and more auditable than asking one prompt to remember every obligation.

## Current boundary

v0.5 supplies the deterministic fabric primitives and tests them independently. It does not yet ship a universal sandbox or a domain-specific hard pipeline for all 62 techniques. The 32 L0 packages declare hybrid stages; broader deterministic programs are a v0.6 expansion and must be developed through technique-specific RED–GREEN evaluation rather than generated boilerplate.
