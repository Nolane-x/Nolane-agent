# ForgeOS v0.7 Trust-Boundary Upgrade

## Status

Approved by the repository owner on 2026-07-28 for autonomous implementation. This is a bounded v0.7 foundation release, not a claim that every AI-agent problem has been solved.

## Problem

Three release boundaries are weaker than the surrounding product claims:

1. The A2A and evaluation file stores attempt to sync a directory after an atomic rename. Windows reports `EPERM`, so every A2A write fails even though the project store already handles this platform limitation.
2. The local process broker is intentionally not a microVM. It must not be presented as one, but ForgeOS currently has no capability-honest route to an external isolated executor.
3. Federation can import and scan providers, but lacks a strict, reusable intake record for a local immutable skill bundle. The supplied intake kit has useful policy and three MIT seed procedures, but its 72-source catalog is discovery data, not proof that third-party skills are safe or production-ready.

## Options considered

### A. Advertise the process broker as a sandbox

Smallest change, but rejected: process allowlisting is not a microVM and cannot honestly promise kernel or network isolation.

### B. Build Firecracker directly into the Node control plane

Rejected for this release: Firecracker requires a Linux/KVM host, kernel and rootfs lifecycle, host networking policy, and operations evidence. Implementing an untested local imitation on Windows would create a false feature.

### C. Capability-honest external microVM boundary plus strict skill intake

Selected. ForgeOS verifies a signed, request-bound receipt from an operator-configured Linux microVM provider. When no provider is configured, unhealthy, or cannot prove the required isolation profile, high-risk execution is unavailable and never falls back to the local broker. This pairs the missing execution boundary with a quarantine-first intake pipeline.

## Architecture

### 1. Portable durable writes

Create one storage helper for JSON atomic replacement:

```text
write temp file -> sync writable temp file -> rename -> attempt directory sync
                                              -> return durability receipt
```

The helper fails closed for write, file-sync, and rename errors. A directory-sync error that the OS documents as unsupported (`EPERM`, `EINVAL`, or `EISDIR`) does not discard a successful atomic replacement; it is reported as `directorySync: "unsupported"`. Other directory-sync errors still fail. A2A and `EvalRunStore` use this helper, eliminating the duplicate Windows-incompatible implementation.

### 2. External microVM control-plane adapter

Add a `RemoteMicroVmSandbox` adapter with two operations:

- `probe()` reads a provider capability document and returns `ready`, `unavailable`, or `misconfigured` with no optimistic fallback.
- `run(request)` sends a bounded, canonical request only after a successful probe. It verifies the returned Ed25519-signed receipt against an operator-pinned public key and checks the request digest, output digests, status, timeout, and declared isolation profile.

The required profile is explicit: `executionKind: "microvm"`, `network: "deny-by-default"`, and `secrets: "none-by-default"`. The adapter is transport-injectable for deterministic tests, but production configuration requires HTTPS, a pinned public key, and an endpoint. A receipt proves that the configured provider attested to the requested profile; it does not prove the provider operator is universally trustworthy.

The local `BrokeredProcessRunner` remains a separate, low-risk allowlisted-process mechanism. It is never used as a fallback for `RemoteMicroVmSandbox` and all user-facing status indicates which boundary is active.

### 3. Quarantine-first skill intake

Add a pure-data `SkillIntake` pipeline on top of federation provider records. It accepts an immutable source snapshot and a bounded set of text files; it does not fetch, install, or execute code. It:

- validates paths, file count, individual and aggregate byte limits, one skill root, manifest metadata, and source digest;
- uses the existing scanner plus intake-specific checks for instruction override, secrets, remote shell piping, unsafe metadata targets, destructive commands, undeclared external writes, and insufficient provenance;
- computes canonical package and content digests, license mode, requested capability envelope, token estimate, and a decision of `candidate`, `review`, `quarantined`, or `duplicate`;
- makes `candidate` the highest automatic state. Existing independent scan, paired evaluation, freshness, human approval, and promotion gates remain required for `stable`.

The three MIT seed procedures from the supplied archive are imported as candidate providers only after their bytes, archive SHA-256, and scanner result are recorded. The archive's 72-source list is retained as discovery metadata, not automatically synchronized, copied, or promoted.

## Data flow

```text
immutable skill snapshot
  -> bounded parser and scanner
  -> quarantined federation provider
  -> independent scan and evaluation receipts
  -> human-approved candidate/stable transition

high-risk execution request
  -> remote-microVM probe
  -> bounded request with canonical digest
  -> signed, request-bound execution receipt
  -> trusted evidence or explicit failure
```

## Failure handling

- Unsupported directory sync is visible in a receipt; failed file sync, rename, integrity validation, HTTPS configuration, signature verification, request mismatch, or missing isolation field fails the operation.
- The sandbox adapter refuses plaintext production endpoints, unpinned keys, stale/mismatched receipts, over-limit output, and any unavailable provider. It never runs the request locally.
- Intake fails closed for malformed or oversized input; it stores no executable content and never converts an automatic intake result to `stable`.
- No claim is changed to say that ForgeOS has a universal microVM, a production Firecracker deployment, or certified third-party skills. A live Linux provider attestation and operations evidence are required before such claims can change.

## Verification

1. Regression tests reproduce A2A and EvalRun writes on a filesystem where directory sync is unsupported and confirm atomic persistence plus a truthful receipt.
2. Sandbox tests cover ready/unavailable/misconfigured states, HTTPS/key validation, signed success, tampered signature, request mismatch, unsafe capability profile, output limit, and the absence of local fallback.
3. Intake tests cover the three recorded seed skills, malformed paths, hostile prompts, remote pipes, secrets, unknown license, duplicates, byte limits, and the fact that accepted intake is only candidate state.
4. Run the complete Node suite, syntax/JSON/docs/skill/adapter validators, release verification, and a real server/CLI smoke test. Production microVM readiness remains blocked unless a configured Linux provider returns a verified live receipt.

## Non-goals

- Shipping or claiming a Firecracker host, kernel image, root filesystem, cloud PKI, or network policy that cannot be exercised in this Windows workspace.
- Bulk-importing, executing, or promoting the kit's external source list.
- Changing unrelated catalog counts or labeling unmeasured skills as certified.
