#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
DEST="${1:-$ROOT/release/NolaneAgent-${VERSION}-electron-windows-x64}"
LAUNCHER="$ROOT/.cache/NolaneAgent.exe"
PTY="$ROOT/.cache/NolanePty.exe"
CREDENTIAL="$ROOT/.cache/NolaneCredential.exe"
UPDATE_STAGE="$ROOT/release/NolaneAgent-${VERSION}-update-payload"
ELECTRON_MODE="bootstrap"
mkdir -p "$ROOT/.cache" "$ROOT/release"

(
  cd "$ROOT/launcher"
  GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -H=windowsgui" -o "$LAUNCHER" .
)
(
  cd "$ROOT/native/pty"
  GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$PTY" .
)
(
  cd "$ROOT/native/credential"
  GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$CREDENTIAL" .
)

SOURCE_ROOT="$ROOT" DESTINATION="$DEST" LAUNCHER_EXECUTABLE="$LAUNCHER" PTY_EXECUTABLE="$PTY" CREDENTIAL_EXECUTABLE="$CREDENTIAL" node --input-type=module <<'JS'
import { buildPortable } from './scripts/build-portable.mjs';
await buildPortable({
  sourceRoot: process.env.SOURCE_ROOT,
  destination: process.env.DESTINATION,
  nodeExecutable: null,
  launcherExecutable: process.env.LAUNCHER_EXECUTABLE,
  ptyExecutable: process.env.PTY_EXECUTABLE,
  credentialExecutable: process.env.CREDENTIAL_EXECUTABLE,
  platform: 'win32',
  electronRuntimeBundled: false,
});
JS

node "$ROOT/scripts/stage-update-payload.mjs" --portable "$DEST" --destination "$UPDATE_STAGE" --version "$VERSION"

python - "$DEST" "$UPDATE_STAGE" <<'PY'
from pathlib import Path
import zipfile, sys
portable = Path(sys.argv[1])
payload = Path(sys.argv[2])
portable_zip = portable.parent / (portable.name + '.zip')
payload_zip = payload.parent / (payload.name + '.zip')
for archive_path, root, wrapped in [(portable_zip, portable, True), (payload_zip, payload, False)]:
    archive_path.unlink(missing_ok=True)
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as archive:
        for item in sorted(root.rglob('*')):
            if item.is_file():
                name = item.relative_to(root.parent if wrapped else root)
                archive.write(item, name)
    print(archive_path)
PY
printf 'Nolane Agent Electron Windows mode: %s\n' "$ELECTRON_MODE"
printf 'Native helpers: %s, %s\n' "$PTY" "$CREDENTIAL"
printf 'Update payload: %s.zip\n' "$UPDATE_STAGE"
