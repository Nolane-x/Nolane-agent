# Procedure

1. Read the confirmed product definition, domain context, assurance profile, and active findings.
2. Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.
3. Choose tenancy model from isolation, cost, scale, compliance, and migration requirements.
4. Define tenant context propagation through authentication, authorization, storage, queues, caches, logs, and background jobs.
5. Make every tenant-scoped query and side effect structurally require tenant identity.
6. Plan provisioning, suspension, deletion, export, backup, restore, and tenant migration.
7. Create cross-tenant negative tests and operational detection signals.
8. Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.
9. Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.
10. Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.
11. Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.
