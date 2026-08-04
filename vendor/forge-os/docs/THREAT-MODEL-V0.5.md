# ForgeOS v0.5 Threat Model

## Protected assets

ForgeOS protects tenant project state, Skill Contract v2 packages, capability mappings, provider digests, RoutePlans, ContextPacks, evaluator receipts, approvals, evidence, source references, tool credentials, and release provenance.

## Trust boundaries

- User, model, worker, provider publisher, evaluator, reviewer, promoter, release signer, MCP server, identity provider, policy decision point, storage backend, and source registry are separate principals or trust domains.
- Materialized skill text and external knowledge are untrusted inputs even after parsing. Stable status means the recorded scans and evaluations passed; it does not make natural-language content intrinsically safe.
- A RoutePlan is an immutable decision artifact, not permission to bypass project ACL, provider status, tool policy, or current evidence freshness.
- Context omission is safe only when the omission manifest preserves source identity, hash, reason, and explicit retrieval path.

## Principal threats and controls

### Skill/package substitution

Controls: immutable provider and section digests, real-path containment, signed or pinned source coordinates where available, mapping evidence, freshness, quarantine, and materialization-time revalidation.

### Prompt injection and rule smuggling

Controls: federation scanner, section allowlists, provider trust state, explicit policy profiles, deterministic scope/rule stages, brokered tools, and adversarial release corpus. These controls reduce risk but cannot prove arbitrary natural language harmless.

### Semantic misrouting

Controls: trigger and anti-trigger retrieval, explicit outcome mappings, hard tool/trust/maturity filters, segmented utility, exclusion reasons, deterministic RoutePlan hashes, and public precision/recall benchmark. The current corpus is bounded and may not represent every language or domain.

### Context overflow or silent information loss

Controls: one global budget, required-item failure, category budgets, output and safety reserves, section-level loading, token registry, omission manifest, artifact deltas, memory freshness, raw tool-output receipts, and stale Semantic ABI hash rejection.

### Evaluator self-attestation

Controls: producers return raw output only; deterministic checks generate objective metrics; independent judges handle semantic rubric items; executable failures veto aggregate scores; holdout prompts are represented by pinned hashes; trusted EvalRun records control maturity.

### Deterministic pipeline bypass

Controls: coverage ledger, work-unit completeness, rule-resolution receipts, anchored findings, reflection constraints, tool allowlists, and stop conditions. Agent reasoning cannot mark deterministic failures as resolved without new evidence.

### Cross-tenant data exposure

Controls inherited from the Trust Kernel include project ACL, tenant-scoped federation records, OIDC/API-key principals, fail-closed policy decisions, and common authorization across HTTP, MCP, A2A, and Studio.

### Supply-chain and release tampering

Controls: clean-source verification, generated-byte stability, archive-first acceptance, file manifest, SBOM, detached release provenance, public verification key, and reproducible command receipts.

## Residual risk

Token estimation has not yet been calibrated to the published p95 target across all provider model versions. Semantic ABI dependency graphs remain partial. External knowledge can become stale or disappear. The built-in SQLite profile is single-node. External code still requires an operator-provided sandbox. PostgreSQL lifecycle parity and multi-node sessions are incomplete. Model behavior remains probabilistic even when scope and evidence are deterministic.

See [Claims Boundary v0.5](CLAIMS-BOUNDARY-V0.5.md) and [Self-Audit v0.5](SELF-AUDIT-V0.5.md).
