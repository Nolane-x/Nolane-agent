# Nolane Agent 0.0.0 — Known Limitations

Nolane Agent 0.0.0 is a release identity and packaging contract, not a claim that every external environment has been proven. The current item-level source of truth is `docs/feature-audit-0.0.0.json`. The exhaustive current report is `docs/REMAINING-GAPS-0.0.0.md`.

## External evidence remains required

The Master Acceptance Ledger records 1,460 canonical items: 1,372 verified and 88 external gates. The native-core conformance receipt records 115 contracts: 100 verified and 15 external contracts. Those gates remain explicit until their designated environment produces replayable evidence.

Examples include provider-real sessions with the user’s own credentials, independent accessibility testing, hardware-dependent performance, complete operating-system journeys, and an installed application replaying an actual published update. CI source checks and mocked/provider-free tests do not substitute for those environments.

## Release prerequisites

The release workflow fails closed when mandatory signing or update secrets are absent. macOS artifacts require configured signing credentials. A GitHub Release must exist before packaged applications can download it. A version change alone never creates a release or an update feed.

## Non-claims

`completeParityClaimAllowed=false`

`superiorityClaimAllowed=false`
