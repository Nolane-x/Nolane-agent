# Provider-real dogfood implementation plan

1. Specify candidate/profile contracts with tests before implementation.
2. Implement the stable 22-case profile and sequential hash-only candidate runner.
3. Add a production wrapper that resolves providers through the built-in registry and rejects unsafe providers before invocation.
4. Add candidate validation and atomic persistence.
5. Add a manual-only dedicated Windows self-hosted workflow with no provider secrets, argv-array invocation, short-lived single-artifact publication, and unconditional cleanup.
6. Document the service-account operating model and the independent verification boundary for `NOL-AUDIT-012`.
7. Run the repository CI and external evidence gates on the resulting commit; debug only from observed failures.
8. Keep `NOL-AUDIT-012` at `external_gate` until a real run and independent receipt exist.
