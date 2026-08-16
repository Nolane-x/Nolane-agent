# Configuration

Canonical product and release identity live in `config/product-identity.json` and `config/release-identity.json`.

Update configuration is represented by `config/update.json`. In 0.0.0 it is intentionally disabled. Enabling updates requires a verified feed, public key and platform-specific release evidence; changing a boolean without those inputs is not sufficient.

Model families and profiles live under `config/model-families.json`, `config/model-profiles/` and `config/model-management/`.

Environment variables use the `NOLANE_AGENT_` prefix for product-level settings. Secrets and provider credentials should be supplied through secret/environment integrations rather than committed configuration.
