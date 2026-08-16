# Security Policy

## Reporting a vulnerability
Please use GitHub's private vulnerability reporting/security advisory flow for Nolane-x/Nolane-agent. Do not publish exploit details in a public issue before a fix is available.

Include the affected version/commit, attack preconditions, impact, reproduction steps and any proposed mitigation.

## Security model
Nolane Agent treats model output and external content as untrusted input. Tools are mediated by explicit policy, workspace boundaries and receipts. Credentials should remain in platform credential stores or environment-backed secret providers; they must not be written into project state or release artifacts.

## Release trust
The 0.0.0 release does not make a signing or notarization claim unless GitHub release evidence explicitly proves it. SHA-256 checksums and release manifests provide integrity metadata; they are not a substitute for platform signing.

## Agent Skills supply chain
Agent Skills are treated as untrusted declarative guidance. Discovery records provenance and content integrity, and loading is constrained by explicit capabilities granted by the host. A skill package cannot silently expand its own authority.

Nolane Agent **does not execute bundled scripts merely because they are present in a skill package**. Executable behavior must cross the normal governed tool or runtime boundary. Local and third-party skills remain subject to the same workspace, permission and evidence rules as model output.
