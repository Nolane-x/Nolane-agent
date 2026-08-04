# ForgeOS v0.6 Security Model

ForgeOS treats agent instructions, tools, skills, memory, MCP providers, hooks, and generated configuration as part of the attack surface. Authentication alone is not sufficient: every operation is evaluated against tenant, project, role, capability, evidence, and current revision.

## Trust boundaries

1. **Human/operator:** may approve risk-sensitive transitions according to role and trust domain.
2. **Agent/worker:** untrusted to self-report completion, quality, evidence, or human identity.
3. **Trusted executor/evaluator:** issues receipts derived from execution, not caller-supplied PASS fields.
4. **Federated provider:** quarantined until source pinning, license checks, scanning, evaluation, and approval succeed.
5. **External MCP/tool:** reachable only through allowlists, credential references, deadlines, and output bounds.
6. **Persistence:** SQLite WAL is the integrated single-node boundary; direct filesystem writers are outside it.
7. **Remote microVM provider:** untrusted until its HTTPS capability profile and request-bound Ed25519 receipts verify. A missing or unsafe provider denies high-risk execution rather than invoking the local broker.

The current runtime protects 128 deep kernel techniques and their rule, hook, tool, evidence, and provider surfaces.

## Agent Surface Security

The v0.6 scanner covers:

- prompt and instruction-boundary injection;
- system/project instruction files and skill packages;
- hook and package lifecycle scripts;
- MCP tool names, descriptions, permissions, and collisions;
- broad command/filesystem/network capability;
- secret and environment-variable references;
- memory and imported instincts;
- secret-to-egress permission paths;
- pipe-to-shell and hidden executable behavior.

The bundled adversarial corpus currently contains 20 deterministic cases and passes 20/20. This is a regression gate, not proof against all future attacks.

## Deterministic execution controls

Execution graphs separate mechanical constraints from model reasoning. Scope and coverage are recorded deterministically. Anchors bind findings to file hashes and positions. Reflection cannot suppress a deterministic failure. Coverage completion requires a current fenced receipt for every work unit.

The local process broker provides no-shell argv execution, command and environment allowlists, workspace realpath containment, timeout/process-group termination, bounded stdout/stderr, and content-addressed receipts. High-risk third-party scripts use the optional remote microVM control-plane boundary only when it is configured and ready. Its receipts must explicitly bind the request, provider, output digests, and `microvm` / deny-by-default network / none-by-default secrets evidence. The adapter has no local fallback. Provider host integrity, guest isolation, and availability require separate operational evidence; see [Remote MicroVM Sandbox](REMOTE-MICROVM-SANDBOX.md).

## Evidence and approvals

Callers cannot submit a passing evidence record. Trusted providers derive status and digest from actual execution. Approvals are one-time, expiring, principal-bound, action-payload-bound, and revision-bound. Critical findings require trusted proof and an independent authorized closer.

## Federation security

Popularity is never a trust proof. External providers are pinned to immutable revisions and enter quarantine. `forge_skill_intake` accepts only one bounded immutable bundle at a time, canonicalizes line endings, requires a `SKILL.md` identity, records an archive digest, detects duplicates before persistence, and scans prompt override, remote-pipe, root-deletion, credential-read, and undeclared external-write patterns. It never executes or fetches a submitted bundle, and even a clean result remains quarantined. Promotion requires current scans, trusted evaluation receipts, tenant policy, and human authorization. Materialization verifies provider digest, section digest, path containment, token budget, required tools, conflicts, and approvals before reading content.

## Known limitations

v0.6 does not claim a universal microVM sandbox, managed PKI/transparency service, complete organization SCIM, full PostgreSQL HA, or immunity to malicious operators with control over the entire host. See [Agent Surface Security](AGENT-SURFACE-SECURITY.md), [Production](PRODUCTION.md), and [Claims Boundary](CLAIMS-BOUNDARY-V0.6.md).
