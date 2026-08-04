# Nolane Agent examples

These examples describe supported workflows without claiming that a trained Nolane model or competitor-level benchmark exists.

## Repository explanation

```text
Ask: Explain the provider fallback path and cite the files and tests that support the explanation.
```

Expected product behavior: repository retrieval, source-linked evidence, and a clearly marked uncertainty state when indexing is incomplete.

## Bounded code change

```text
Build: Add deterministic retry tests without changing the public API. Work in isolation and stop if the intended scope expands.
```

Expected product behavior: a plan or direct bounded edit, isolated changes, targeted and full verification, then Review & Ship.

## Security verification

```text
Verify: Check whether untrusted repository instructions can reach final provider messages. Do not alter the verifier or hidden fixtures.
```

Expected product behavior: content-ingress screening, independent evidence, a non-claim when the environment cannot reproduce a provider-real run, and a retained rollback point.

## Small-model laboratory

```text
Evaluate: Compare two policy candidates on a held-out cohort with matched compute. Keep claimAllowed=false unless an independent promotion gate passes.
```

Expected product behavior: typed state/action/effect receipts, held-out separation, total-system cost accounting, and no conversion of fixture results into marketing claims.
