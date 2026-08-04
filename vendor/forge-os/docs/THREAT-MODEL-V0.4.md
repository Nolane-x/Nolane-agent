# ForgeOS v0.4 Threat Model

ForgeOS assumes agents, imported skills, external knowledge links, MCP servers, network responses, and user-supplied artifacts may be malicious or incorrect. The trust boundary is enforced through immutable source coordinates, tenant scope, quarantine, security scanning, evaluation receipts, human approval, bounded materialization, tool allowlists, project ACLs, trusted evidence providers, and evidence-gated release policies.

## Protected assets

Protected assets include project state, tenant boundaries, credentials, approval capabilities, evidence payloads, artifact provenance, provider lifecycle state, evaluation receipts, release artifacts, and audit history.

## Primary threats

- Prompt or instruction injection inside imported skill text.
- Path traversal, hidden executables, archive abuse, and pipe-to-shell instructions.
- Credential disclosure through provider files, MCP arguments, logs, metrics, or evidence.
- Provider substitution, mutable branches, stale scans, digest mismatch, and dependency confusion.
- License ambiguity or unauthorized content copying.
- Tenant crossover through shared provider IDs or project access.
- MCP private-network access, dangerous write tools, oversized output, hanging sessions, and malicious schemas.
- Worker self-attestation, synthetic evaluation metrics, stale gates, or approval replay.
- Storage races, stale leases, task theft, and direct filesystem writers outside the consistency boundary.
- Supply-chain tampering between source verification and release archive publication.

## Enforced controls

Imports are pinned, bounded, quarantined, scanned, and never auto-promoted. Provider and bundle digests are rechecked at materialization. External providers are tenant scoped. MCP credentials use references; write tools need human authorization. Evidence `PASS` receipts are issued by trusted executors from actual output bytes. Artifacts protect both content and lifecycle envelopes. Gate evaluations bind semantic revision and canonical input digest. Release archives are extracted and retested without Git, with SBOM and provenance output.

## Residual risks

ForgeOS does not yet sandbox arbitrary third-party scripts in a built-in VM/container runtime. SQLite is single-node; multi-node consensus is outside its boundary. External reference content can change or disappear. Semantic deduplication cannot prove two expert methods are equivalent. OIDC, PDP, MCP, and source registries can be unavailable or compromised. Managed PKI, transparency logging, SCIM, organization provisioning, A2A streaming, and full PostgreSQL lifecycle integration remain open.

A release must report these residual risks rather than converting them into a universal “production safe” claim.
