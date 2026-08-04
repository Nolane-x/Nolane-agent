# Verification

- Can malformed, stale, duplicated, reordered, or unauthorized input reach a side effect?
- Can partial failure leave durable corruption or cost?
- Do tests kill plausible mutations in critical branches?
- Can logs or errors disclose secrets?

Required evidence:
- annotated diff
- data-flow map
- finding ledger
- closure evidence
