# Third-Party Notices

## ForgeOS

Nolane Agent vendors ForgeOS 0.6.1 under the MIT License. Its original license is preserved at `vendor/forge-os/LICENSE`.

## Historical clean-room research input

Earlier development reviewed an MIT-licensed upstream agent from Nous Research at commit `846b14ab01a84483d2c3dd429579173040474585` (Copyright (c) 2025 Nous Research). No upstream archive, runtime, API route, executable integration, model profile, adapter, or package is distributed by Nolane Agent. Nolane Agent claims ownership only of its independent Nolane Native implementation. Sanitized transformation accounting remains in `requirements/nolane-native-transformation-ledger.jsonl` for audit traceability.

## Wigolo

Wigolo 0.2.1 was inspected as research input for web-intelligence capabilities. Its source is AGPL-3.0-only and is not copied into Forge Studio. Nolane Web Intelligence is an independent clean-room implementation. The upstream license is preserved at `third_party/WIGOLO-LICENSE.txt` for audit traceability only.

## Monaco Editor

Nolane Agent can install the pinned `monaco-editor` package under the MIT License. The verified installer retains `LICENSE` and `ThirdPartyNotices.txt` from the package in the local asset directory.

## xterm.js

Nolane Agent can install the pinned `@xterm/xterm` and `@xterm/addon-fit` packages under the MIT License. The verified installer retains their license files in the local asset directory.

## Electron

Nolane Agent uses Electron 43.2.0 as the Windows desktop shell. The runtime is installed from a pinned upstream-compatible archive on first run and is accepted only after SHA-256 verification. Electron is distributed under the MIT License and includes Chromium, Node.js, and their respective third-party notices in the installed runtime directory.
## Playwright and Playwright CLI

Nolane Agent can install the pinned `@playwright/cli` 0.1.17 package and its managed Chromium runtime for governed browser automation. Playwright is distributed under the Apache License 2.0. The installer retains package license metadata in the managed runtime cache.
