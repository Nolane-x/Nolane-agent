# Nolane Agent GitHub Release Runbook

## What the pipeline produces

A tag matching `v<package.json version>` starts `.github/workflows/release.yml` on a Windows runner. The workflow reruns the full release matrix, builds native helpers, creates an x64 NSIS installer, produces update metadata, signs the Nolane update manifest with Ed25519, creates SHA-256 checksums, generates GitHub build provenance, publishes a GitHub Release, and updates the signed per-channel feed on the `update-feed` branch.

## Required repository settings

Create the Actions secret `NOLANE_UPDATE_PRIVATE_KEY_B64`. It must contain the base64 encoding of the Ed25519 private key matching the public key distributed with the app. The workflow fails closed when this secret is missing.

Windows Authenticode signing is strongly recommended. Add `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` as Actions secrets. Never commit the certificate, private update key, or passwords. Set the repository variable `NOLANE_WINDOWS_PUBLISHER` to the exact certificate publisher when signature verification is enabled.

## First-time update key setup

Run this only on an offline or trusted maintainer machine:

```bash
node scripts/update-release-tools.mjs generate-keys \
  --output ./private-release-keys \
  --name nolane-agent-update
```

Commit only the public key after reviewing its fingerprint. Store the private key outside the repository and add its base64 encoding to GitHub Actions secrets.

## Publishing

1. Update all release identity surfaces and run the full release matrix locally.
2. Commit a clean tree.
3. Create a signed or protected tag matching the package version, for example `v5.0.0-beta.1`.
4. Push the tag.
5. Review the Actions run, artifact attestation, checksums, release assets, and signed channel manifest.
6. Install the release on a disposable Windows machine before promoting it broadly.

The app does not trust GitHub alone. It verifies the Nolane Ed25519 signature, repository, tag, commit, exact asset name, byte count, SHA-256 digest, and Windows PE header before staging an installer.
