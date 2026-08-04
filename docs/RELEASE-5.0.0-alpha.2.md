# Nolane Agent 5.0.0-alpha.2 release notes

Development alpha adding exact-source-ZIP clean-room certification to the release pipeline and promoting `NOL-AUDIT-003` only after product wiring.

## Release contract

- Full release matrix is mandatory.
- Source remains available outside ZIP in the working workspace.
- Source ZIP must contain NolaneNative 2.29.0 with the vendor-manifest SHA-256.
- Clean-room verification runs from the exact published source ZIP without `.git`.
- The 198-item Nolane acceptance registry remains honest: **77 verified, 121 not implemented**.
- The historical 1,150-item frontier audit is retained separately as a 4.0 capability-retention record.
