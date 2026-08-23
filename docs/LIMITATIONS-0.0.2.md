# Nolane Agent 0.0.2 — Known Limitations

Nolane Agent 0.0.2 is a desktop reliability patch. The current item-level source of truth is `docs/feature-audit-0.0.2.json`; the exhaustive open-work report is `docs/REMAINING-GAPS-0.0.2.md`.

## External evidence remains required

External gates still require their specified provider credentials, independent accessibility review, real hardware/platform journeys, or public-release replay. Source tests and UI fixtures do not close those claims.

## Release prerequisites

GitHub Actions is the only release packaging environment and publishes Windows NSIS, macOS DMG and ZIP, and Linux AppImage and DEB. The workflow permits unsigned artifacts: Windows can show **Unknown Publisher**, and macOS Gatekeeper can require an explicit confirmation. A GitHub Release must exist before `electron-updater` can offer **Download update** and **Update and restart**.

## Non-claims

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
