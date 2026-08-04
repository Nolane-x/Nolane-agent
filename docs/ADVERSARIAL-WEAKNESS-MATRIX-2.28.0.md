# Forge Studio 2.28.0 — Adversarial Weakness Matrix

| Area | Implemented evidence | Remaining weakness |
|---|---|---|
| Taint/data flow | Typed shortest paths, sink-specific sanitizers, source hashes and ambiguity findings | Not a complete whole-program interprocedural proof for every language/runtime |
| Injection | Shell, SQL, path, template, dynamic-code and prompt contexts | Framework-specific encoders and browser visual deception remain incomplete |
| Prompt quarantine | Fingerprint, findings and metadata-only projection | Detection remains rule/evidence based and can have false positives/negatives |
| Supply chain | Vulnerability, license, abandonment, malicious signal, SBOM/provenance and integrity quarantine | Online advisory freshness and every ecosystem signature scheme require external data/tools |
| Secrets | Boundary-wide exfiltration block and mission-scoped expiring/revocable tokens | Hardware-backed secret custody and every hosted provider boundary remain external |
| Audit | Canonical hash chain detects modification, deletion and reordering | Independent transparency log anchoring is not certified |
| Sandbox | Traversal, symlink/junction/mount, child/env/socket/credential escape fixtures | Direct destructive host escape tests and full macOS/Windows/Linux certification are absent |
| Failure recovery | Network/resource/process/database/disk/file-race adapters with checkpoint recovery | Direct OS-level chaos injection is not certified |
| Benchmark comparability | Exact model/machine/runtime/budget/permission contracts | Competitor binaries may expose capabilities that cannot be perfectly normalized |
| Contamination | Case fingerprints, split metadata and disclosure completeness | Absence of contamination cannot be proven from local evidence alone |
| Statistics | Common-task threshold, variance, Wilson intervals, keep rate and resource metrics | Small or unrepresentative suites can still mislead |
| Attestation | Exact run digest, systems, claimant and signature binding | No trusted external operator attestation is included in this release |
| Comparative claim | Fake provider and benchmark-specific behavior lock the claim | No real Codex/Claude/Cursor/Copilot comparative run is present |
