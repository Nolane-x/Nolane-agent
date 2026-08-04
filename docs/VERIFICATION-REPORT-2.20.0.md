# Forge Studio 2.20.0 verification contract

The release is accepted only when the Full Release Matrix passes on a clean commit. The new required gates verify:

- criterion weighting and source-hash-bound verification;
- privacy-safe Decision Receipts;
- Token Yield, Memory Yield, and Edit Yield from verified value;
- Evidence Card provenance and freshness;
- marginal-utility context selection, near-duplicate suppression, and counter-evidence;
- provider tokenizer use with explicit degraded fallback;
- bounded context escalation;
- one Decision Plane facade and unchanged `src/app.mjs` composition budgets;
- the honest 1,150-item audit and explicit non-claims.

The deterministic fixture is internal release evidence, not an independent comparison against other agents.
