# Security Policy

## Supported version

Security fixes are applied to the latest `0.1.x` release line while the project is pre-1.0.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose secrets, corrupt projects, bypass confirmations, escape a sandbox, or enable cross-tenant access. Use the repository's private security advisory channel after publication.

Include the affected version, reproduction steps, impact, prerequisites, and the smallest safe proof of concept. Do not include real credentials or personal data.

## Scope

The public protocol layer, project store, artifact graph, adapter manifests, generated skills, dashboard rendering, and release tooling are in scope. Third-party model providers and external agent hosts remain under their own security policies.

See `docs/SECURITY-MODEL.md` for trust boundaries and residual risks.

## Deployment boundary

The default command is a local-development configuration. Remote deployments must use HTTPS, set a strong `FORGEOS_API_KEY`, configure an exact allowed origin, and add trusted-edge rate limiting, request logging, and secret management. The built-in bearer key is a minimal project boundary, not a complete identity or tenant-management system.
