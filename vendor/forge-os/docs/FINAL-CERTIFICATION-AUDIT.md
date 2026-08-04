# ForgeOS v0.6.1 Final Skill Certification Audit

This audit separates **catalog routing state** from **formal maturity evidence**. It applies the maturity and coverage thresholds in the Skill Intelligence Revision 2 blueprint; it does not promote a skill because its manifest says `stable`.

## Executive result

| Measure | Result |
|---|---:|
| Technique contracts in the v2 catalog | 128 |
| Catalog-declared candidate | 95 |
| Catalog-declared stable channel | 33 |
| Catalog-declared certified | 0 |
| Package-bound RED baselines | 98 |
| Technique packages with evaluator bindings | 128 |
| Evidence-qualified stable | **0** |
| Evidence-qualified certified | **0** |
| L0 techniques meeting the 50-scenario threshold | **0 / 32** |
| Packaged hidden-holdout run receipts | 0 |
| Packaged paired multi-model run receipts | 0 |
| Packaged independent certification receipts | 0 |
| Packaged production/expiry receipts | 0 |
| Paired runs proven for the 1,024-skill claim | 0 / 10,000 |

The 33 entries in the stable routing channel remain available for backward-compatible routing and materialization. That channel is **not** equivalent to formal stable certification under Revision 2.

## Why formal stable is not granted

Revision 2 requires stable skills to have holdout evidence, a positive confidence lower bound, no critical regression, transfer coverage, and successful materialization. It requires at least 20 scenarios for each stable skill. Every current declared-stable package is below that threshold: three L0 packages expose two public scenarios; the remaining stable-channel packages expose no package-local scenario corpus.

Declared model compatibility is metadata, not evidence that paired runs occurred. Evaluator IDs and reviewer-role fields are contracts, not signed evaluation or review receipts.

## Why formal certified is not granted

Certified maturity additionally requires independent maintainer review, production evidence, and an expiry/revalidation policy. None of the 128 technique packages contains a package-bound certification receipt satisfying all of those obligations.

## Kernel finding

All 32 L0 techniques expose two public cases. Revision 2 requires at least 50 scenarios per L0 skill, including pressure and recovery cases. Therefore no L0 technique is formally certified by this release.

## Release behavior

ForgeOS v0.6.1 adds a machine-readable claims gate:

```bash
npm run skills:certification-audit
```

The gate is executed by CI, source release verification, and archive acceptance. It permits a runtime-hardening release only while the unsupported claims remain explicitly `false`.

The machine-readable report is emitted as `skill-certification-audit.json` and content-addressed with SHA-256.

## Claims allowed

- ForgeOS contains 128 v2 technique contracts and evaluator bindings.
- Thirty-three providers remain in the declared stable routing channel.
- All 33 stable-channel providers materialize under the current context benchmark.
- The runtime, protocol, trust, and release invariants listed in the verification report passed.

## Claims blocked

- All 128 kernel techniques are stable or certified.
- The 1,024 outcome scaffolds are production-grade procedural skills.
- 10,000 paired evaluation runs have been completed.
- A stable/certified maturity claim can be inferred from a manifest label alone.

## Required evidence to remove the blocker

For each relevant technique, publish immutable EvalRun receipts containing the same case/seed matrix, actual model/version and usage, deterministic checker results, independent semantic judgments, confidence bounds, transfer cases, and current provider digest. L0 skills additionally need at least 50 scenarios. Certification then requires independent maintainer/domain review, production evidence, and an expiry/revalidation receipt.
