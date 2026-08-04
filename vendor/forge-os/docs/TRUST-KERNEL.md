# ForgeOS Trust Kernel

The Trust Kernel is the small set of runtime invariants that every skill, protocol, UI, and release operation must pass through. It exists to prevent a persuasive agent response from being mistaken for a verified state transition.

## Kernel invariants

1. **No successful writer disappears.** A process must own the current lease token and fencing sequence at commit time.
2. **No caller can declare proof.** A caller requests verification; an allowlisted provider executes the method and issues the receipt.
3. **No gate outlives its semantic inputs.** Gate evaluations bind semantic revision, policy version, artifact envelope hashes, and evidence receipts.
4. **No artifact can hide lifecycle tampering.** Content and lifecycle envelope use separate canonical hashes.
5. **No worker approves itself.** Assurance policy controls producer, reviewer, verifier, evidence issuer, and finding closer independence.
6. **No public tool outruns its contract.** Inputs and outputs are validated at the transport boundary before a successful public result is returned.
7. **No task continues after losing authority.** Skill and A2A workers use leases, heartbeat, fencing, cancellation, and retry budgets.
8. **No release report floats free of its source content.** Verification binds the canonical source manifest actually executed and archive subjects actually distributed.

## Fenced local storage

The built-in backend uses token-owned lease records with heartbeat and fencing values. Commit and release operations re-read the lease and reject stale owners. Project state uses revision/CAS, durable atomic writes, verified snapshots, and a hash-chained audit.

This backend is intended for local and single-node deployments. It cannot protect against arbitrary direct filesystem writers and it is not a consensus system. The storage interface is designed so a transactional SQL implementation can replace it without changing project, proof, or protocol contracts.

## Trusted evidence

Evidence moves through this flow:

```text
principal requests verification
  → policy selects allowed provider and method
  → provider executes against an immutable subject
  → output bytes are stored and hashed
  → server issues a signed-shaped receipt record
  → gate verifies issuer, method, subject, freshness, independence and status
```

The built-in release does not claim a managed cryptographic trust service. Provider identities and receipt integrity are enforced within the local control plane; external high-assurance deployments should add isolated executors, key management, remote attestations, and an append-only transparency store.

## Artifact envelope

An artifact key is `(type, slot, version)`. Its `contentHash` covers the domain payload and declared dependencies. Its `envelopeHash` covers immutable lifecycle/provenance fields, including producer, review, verification, state, evidence, lineage, and exact dependency hashes.

State changes pass through one lifecycle reducer. Assurance policies can require review before verification, independent trust domains, evidence issuer constraints, and specific artifact states at each gate.

## Approval capabilities

Human-sensitive actions use one-time capabilities bound to:

- authenticated human principal;
- project ID and current semantic snapshot;
- canonical action name and argument digest;
- policy version;
- expiry and consumption state.

The current implementation remains local and does not provide organization-wide identity federation, hardware-backed keys, or delegated administration.

## Execution trust cells

Skill runs freeze a contract hash, context-pack hash, inputs, tools, output slots, assurance, and worker lease. Completion is inspected by a trusted provider. Eval runs similarly bind corpus, seeds, executor, source, raw case results, and promotion decision.

A2A tasks use the same authority model: ownership, expected revision, lease token, fencing sequence, heartbeat, legal reducer, cancellation, retry budget, and persisted history.

## Release trust

The verifier is archive-first:

- `.git` is optional;
- canonical source content is hashed into a manifest (text line endings normalized; binary bytes exact);
- generated evidence is written outside the source tree;
- independent checks continue after a failure;
- release archives are extracted, installed, and reverified;
- CycloneDX SBOM and in-toto/SLSA-style provenance can be generated;
- provenance can be signed with a detached Ed25519 key.

The project ships signing tooling, not a managed PKI. Users must establish their own key custody and trusted public-key distribution.
