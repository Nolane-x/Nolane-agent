# Development

## Prerequisites
- Node.js 22.13+
- Go toolchain for launcher/native helpers
- Git

## Setup
```bash
npm ci
npm run verify:version
npm run test:core
```

## Common commands
- `npm start` — source application
- `npm run dev:browser` — source browser development entry
- `npm run build:ui` — deterministic renderer build
- `npm run start:electron` — Electron development runtime (requires Electron toolchain installed)
- `npm run build:vscode` — VS Code extension build + validation
- `npm run test:go` — native Go tests
- `npm test` — full Node test plan

## Test discipline
Behavior changes should follow RED → GREEN → refactor. Tests should assert user/runtime behavior instead of implementation details where possible. CI is the canonical cross-platform gate; local success alone is not a platform claim.
