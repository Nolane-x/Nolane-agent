# Forge Studio 2.16.0 verification contract

The release is accepted only when the required Full Release Matrix passes on a clean commit. The dedicated `adaptive-microkernel` gate verifies:

- Lite defaults and automatic profile selection;
- system-wide memory sampling and emergency policy;
- the runtime module lifecycle and absence of eager enterprise/cloud implementation imports;
- lazy enterprise/cloud database creation through real app startup tests;
- event publication after SQLite commit and removal of 250 ms SSE polling;
- runtime-driven UI effects and terminal frame budgets;
- NolaneNative missing-pack behavior, external pack verification and release separation;
- source complexity budgets for `src/app.mjs`;
- unchanged item-level audit counts and explicit limitations.

The Node suite, runtime smoke, SDK tests, ForgeOS validation, Windows packaging, fresh Core-source reconstruction with the optional NolaneNative pack, and archive-integrity gates remain required. A Linux source result does not replace Windows, macOS, hosted CI, cloud, marketplace or independent certification evidence.
