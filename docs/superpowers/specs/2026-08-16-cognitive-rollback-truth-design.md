# Cognitive rollback truthfulness

## Problem

`CognitiveKernel.rollback(taskId, receiptId)` currently records a receipt named
`forge.cognitive-rollback.v1` without invoking a restoration mechanism or
verifying a restored state. This lets an intent appear indistinguishable from a
completed rollback.

## Chosen design

Keep the cognitive kernel side-effect-free by default. Its `rollback` method
accepts either the existing receipt-id string or a request object. Without an
injected executor it records a `forge.cognitive-rollback-request.v1` receipt
with `status: "requested"`; it never claims that state was restored.

An optional synchronous `rollbackExecutor` constructor dependency receives the
task id, target receipt id and rollback point. Its result is accepted only when
it supplies both a restored-state receipt hash and an independent
effect-verification receipt hash, then the kernel records `status: "executed"`.
An independently injected `rollbackVerifier` must inspect that execution and
return its own verification receipt before the kernel records `status:
"verified"`. Any missing proof remains `requested`, `executed`, or throws
before a verified state is emitted.

## Scope and invariants

- The kernel does not perform filesystem, worktree, memory or provider state
  mutation itself.
- Existing string callers remain valid and receive an explicit request receipt.
- An executed rollback has two non-empty 64-character SHA-256 receipt hashes:
  restoration evidence and readback evidence; a verified rollback additionally
  has a verifier-owned receipt hash.
- A verifier rejection remains `unverified` and records `resolvedAtMs`, never a
  field named `verifiedAtMs`.
- Tests demonstrate the old false-completion shape cannot be emitted by the
  default path, that executor output remains `executed` without a verifier,
  and that a verified result carries all three evidence links.

## Non-goals

- Wiring an executor to a particular workspace or provider runtime.
- Reversing a durable-memory write automatically.
- Changing mission-level `/rewind`, which has its own coordinator contract.
