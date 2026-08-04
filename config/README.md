# Signed GitHub update configuration

Nolane Agent uses a dual trust model. GitHub hosts release assets and the per-channel feed, but the app accepts an update only after validating the Nolane Ed25519 signature, repository, tag, commit, installer name, byte count, SHA-256 digest, and Windows PE header.

Generate the key pair on a trusted maintainer machine:

```bash
node scripts/update-release-tools.mjs generate-keys --output ./private-release-keys --name nolane-agent-update
```

Never commit the private key. Store its base64 encoding in the GitHub Actions secret `NOLANE_UPDATE_PRIVATE_KEY_B64`. The release workflow derives and packages only the public key:

```bash
node scripts/prepare-update-trust.mjs \
  --private-key ./private-release-keys/nolane-agent-update-private.pem \
  --output ./config \
  --repository owner/repository \
  --channel beta
```

The generated `config/update.json` points to the signed channel feed on the `update-feed` branch. The private key is never copied into the application, source package, release assets, or update feed.
