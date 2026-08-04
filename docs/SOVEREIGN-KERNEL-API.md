# Sovereign Kernel HTTP API

All routes use the existing Nolane authenticated HTTP boundary. Bodies are JSON. Receipts are SHA-256 values over canonical payloads.

## Create a durable thread

```http
POST /api/sovereign-kernel/threads
Content-Type: application/json

{
  "projectId": "project_...",
  "title": "Authentication hardening",
  "objective": "Audit and harden the authentication boundary.",
  "labels": ["security", "checkpoint-12"]
}
```

The response contains `revision` and `epoch`. Clients should preserve both when requesting guarded transitions or checkpoints.

## Compile context

```http
POST /api/sovereign-kernel/threads/:threadId/context
Content-Type: application/json

{
  "tokenBudget": 48000,
  "targetPaths": ["src/security/**"],
  "instructions": [{"content":"Do not expose credentials.","trust":"managed"}],
  "repository": [{"path":"src/security/policy.mjs","content":"..."}],
  "evidence": [],
  "memory": [],
  "transcript": []
}
```

The packet reports selected lanes, omissions, token estimate, budget, utilization and a receipt.

## Compile and execute a plan

```http
POST /api/sovereign-kernel/threads/:threadId/plans
Content-Type: application/json

{
  "maxConcurrency": 4,
  "tasks": [
    {"id":"scout","role":"scout","objective":"Map the boundary","ownedPaths":["src/security/**"]},
    {"id":"builder","role":"builder","objective":"Implement hardening","dependencies":["scout"],"ownedPaths":["src/security/**"]},
    {"id":"review","role":"reviewer","objective":"Adversarial review","dependencies":["builder"]}
  ]
}
```

```http
POST /api/sovereign-kernel/plans/:planId/execute
Content-Type: application/json

{
  "threadId": "thread_...",
  "contextReceiptSha256": "..."
}
```

Plans and context receipts survive process restart. Mutation lanes require real diff/test evidence; non-mutation lanes require outcome evidence.

## Capability lease

```http
POST /api/sovereign-kernel/threads/:threadId/capabilities
Content-Type: application/json

{
  "capability": "credential.read",
  "resource": "vault:release-signing-key",
  "scope": "once",
  "risk": "critical",
  "reason": "Sign the release manifest",
  "ttlMs": 300000,
  "constraints": {"maxUses": 1}
}
```

Sensitive leases can remain `pending` until a human decision. Authorization consumes use count and can transition a one-shot lease to `consumed`.

## Checkpoint and resume

A checkpoint captures thread references to plans, context and capability state. Resuming creates a new epoch so workers holding the old epoch cannot append stale results.
