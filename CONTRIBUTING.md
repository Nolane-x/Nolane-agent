# Contributing to Nolane Agent

## Development flow
1. Create a focused branch from `main`.
2. Add or update a failing regression test before behavior changes.
3. Keep execution and release claims evidence-bounded.
4. Run `npm run validate` and the subsystem-specific checks you changed.
5. Open a pull request with the problem, design, test evidence and risk notes.

## Required checks
- `npm run verify:version`
- `npm run test:core`
- `npm run test:release`
- `npm test` for broad runtime changes
- `npm run test:go` for native changes
- `npm run build:vscode` for extension changes
- `npm run build:ui && npm run verify:ui` for renderer changes

Do not commit credentials, private signing keys, generated release directories, local databases or machine-specific state.
