# Forge Studio 4.0.0 — Local Frontier Completion

## Release scope

This release resolves all 59 requirements that were `partial` in Forge Studio 3.5.0. Exactly 53 move to `verified_source_test` through direct source, tests, deterministic measurement, and release gates. Six move to `external_gate` because their required production artifacts or independently attested comparison environment were not supplied: `31.2`, `33.1`, `33.2`, `33.3`, `33.4`, and `45.3`.

The implementation completes locally provable context/semantic intelligence, polyglot evidence, governed memory/resource/multi-agent collaboration, browser/security/product experience, and reproducible local benchmark contracts.

## Audit result

The 1,150-item audit reports:

- `verified_source_test`: 1,081
- `partial`: 0
- `external_gate`: 69
- `not_implemented`: 0

`partial: 0` does not mean all external conditions are satisfied. Every external condition remains listed in `docs/REMAINING-GAPS-4.0.0.md`.

## NolaneNative 2.29.0 direct bundling

The exact NolaneNative archive is bundled directly into the source, Windows portable, Electron Windows, and update payload artifacts. A standalone `ForgeStudio-LegacyExternalRuntime-2.29.0.zip` is also published. Packaging and reconstruction fail closed if the embedded archive differs from 67,431,284 bytes or SHA-256 `1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9`.

The previous carry-forward-only policy is no longer used by this release.
