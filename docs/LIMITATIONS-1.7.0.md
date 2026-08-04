# Forge Studio 1.7.0 — remaining limits

Date: 2026-07-29

The complete item-level source of truth is `feature-audit-1.7.0.json`. The exhaustive open-item report is `REMAINING-GAPS-1.7.0.md`.

## Repository discovery boundary

- Discovery is evidence-based static inspection. It does not execute untrusted project scripts to infer behavior.
- Framework and architecture findings are bounded heuristics with cited source evidence, not an omniscient architecture oracle.
- Environment values, credential files, private keys, and local absolute paths are excluded.
- Unknown findings remain explicitly unknown rather than being guessed.

## Remaining local gaps

The exact list, current evidence, reason, and completion condition for every open requirement is maintained in `REMAINING-GAPS-1.7.0.md`. Major remaining families include advanced AST/tree-sitter intelligence, native isolation parity across operating systems, complete hosted-provider workflows, and several specialized administration surfaces.

## External gates

Authenticode, Apple notarization, live native validation on every supported OS, production multi-tenant cloud conformance, enterprise IdP/SCIM conformance, public marketplace approval, hosted-provider integration evidence, and independently operated comparative benchmarks remain external gates.
