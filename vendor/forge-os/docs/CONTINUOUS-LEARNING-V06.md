# Continuous Learning v0.6

ForgeOS learns through quarantine rather than directly editing stable skills.

```text
trusted receipts
→ observed instinct
→ scoped storage + TTL
→ compatible cluster
→ candidate evolution
→ independent evaluation
→ human promotion or rollback
```

## Instinct invariants

An instinct must have:

- tenant scope;
- optional project and harness scope;
- source receipt hashes;
- confidence in `[0,1]`;
- trust domain;
- expiry;
- observed maturity assigned by the store.

The caller cannot create a stable instinct. Retrieval filters expired records and scopes by tenant, project, and harness.

## Clustering

Clustering is deterministic and refuses to merge observations across tenants, incompatible outcomes, or incompatible trust domains. Similar wording alone is not sufficient for promotion.

## Evolution

The Evolution Lab creates a candidate proposal linked to the base skill digest and instinct-cluster digest. Promotion requires:

- a positive trusted evaluation receipt;
- a lower confidence bound above zero;
- an evaluator with the `skill-evaluator` role;
- a human `skill-promoter`;
- separated trust domains.

Rollback restores the previous version while retaining the promotion and rollback provenance.
