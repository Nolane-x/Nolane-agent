# Nolane Agent 0.0.0 update configuration

Packaged Nolane Agent releases use `electron-updater` with GitHub Releases metadata on Windows, macOS, and Linux. The build publishes the platform metadata (`latest.yml`, `latest-mac.yml`, and `latest-linux.yml`) alongside the installer artifacts, and the updater checks downloaded packages against that metadata.

`config/update.json` intentionally disables the older custom signed-feed runtime. It contains no private key and is not an input to GitHub release publishing. This keeps an unsigned 0.0.0 release buildable without `NOLANE_UPDATE_PRIVATE_KEY_B64`, Windows certificates, or macOS certificates.

If Nolane later adopts code signing, certificate material belongs only in GitHub Actions secrets. Never commit private keys, certificates, or passwords.
