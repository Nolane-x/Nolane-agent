# Releases

## Version policy
The canonical release line starts at `0.0.0`. Until intentionally changed, every product upgrade increments only the patch component: `0.0.1`, `0.0.2`, …

Git tags are exactly `v0.0.N` and must match every versioned source surface.

## Release pipeline
1. Merge an exact, green commit to `main`.
2. Create immutable tag `v0.0.N` at that commit.
3. The release workflow revalidates identity/release contracts.
4. Native platform runners build Windows NSIS, macOS DMG/ZIP and Linux AppImage/DEB packages.
5. Source and VS Code artifacts are collected.
6. `RELEASE-MANIFEST.json` records commit, version, artifact hashes and bounded platform trust state.
7. `SHA256SUMS` is generated over published assets.
8. GitHub Release publishes the exact assets and provenance/attestations where supported.

## Trust boundaries
Unsigned artifacts may still be published as development-grade binaries, but the release notes and manifest must not describe them as signed or notarized. Update handoff remains disabled unless its trust chain is separately verified.
