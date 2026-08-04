# NolaneNative Core Parity Audit

Source snapshot: **Nous Research MIT-licensed upstream agent audit snapshot 0.19.0**

Tree SHA-256: `3d3d97032f56e200b5a323398fc8e7b7fbfe644fe119f908c1bd2922624669e2`

## Truth reset

- NolaneNative executable source and archive remain absent from Nolane production packages.
- Beta.1 retirement proved package/runtime absence, not complete behavioral parity.
- This inventory is behavioral provenance only; no upstream implementation is copied into Nolane.
- File existence is not accepted as capability evidence.

## Inventory totals

- Files inspected: **7,617**
- Core entries: **5,158**
- Explicit exclusions: **2,459**
- Contract candidates: **2,110**
- Unmapped core paths: **0**

## Domain distribution

| Domain | Entries | Source/config | Tests | Bytes |
|---|---:|---:|---:|---:|
| agent-kernel | 504 | 30 | 474 | 8444279 |
| prompt-context | 15 | 15 | 0 | 795191 |
| provider-fabric | 97 | 88 | 7 | 1231128 |
| tool-execution | 456 | 101 | 354 | 9354496 |
| repository-files | 22 | 22 | 0 | 606069 |
| browser-computer-use | 58 | 46 | 12 | 447519 |
| sessions | 201 | 87 | 113 | 3585005 |
| memory-learning | 62 | 43 | 11 | 1299125 |
| skills | 19 | 0 | 19 | 237390 |
| plugin-system | 112 | 12 | 93 | 4373253 |
| mcp | 12 | 1 | 11 | 215290 |
| scheduler | 52 | 16 | 36 | 1078706 |
| multi-agent | 43 | 8 | 34 | 993619 |
| gateway-integrations | 799 | 216 | 579 | 17914532 |
| acp-api | 45 | 27 | 18 | 826893 |
| media-voice | 94 | 79 | 11 | 1585103 |
| observability-operations | 580 | 20 | 557 | 8045941 |
| security | 133 | 54 | 76 | 2112418 |
| product-surfaces | 1662 | 1106 | 502 | 27142367 |
| configuration | 192 | 139 | 42 | 6129632 |

## Acceptance interpretation

An inventory contract begins as `inventory_only`. It becomes `verified` only when the Master Acceptance Ledger links it to a Nolane-native production entrypoint, a direct conformance test, a negative test, and fresh evidence hashes. Provider, messaging, Windows, browser, and independent-evaluation behavior remains an external gate until a real receipt exists.

## Exclusion policy

Translations, marketing websites, contributor metadata, optional skill payloads, generated datasets, and standalone assets are not ported file-for-file. Their useful behavior is represented through Nolane-owned engines and contracts; required license attribution remains preserved.


## Beta.6 conformance update

- Behavioral contracts: **75**
- Locally verified contracts: **52**
- External-certification contracts: **23**
- Pinned upstream paths: **2,110**
- Locally verified upstream paths: **413**
- Unmapped paths: **0**

Beta.6 adds MCP OAuth, browser supervision, async delegation, PTY session/retry, gateway recovery and local media/playback contracts. Provider-real, platform, Windows and independent GUI receipts remain external. `completeParityClaimAllowed=false` and `superiorityClaimAllowed=false`.
