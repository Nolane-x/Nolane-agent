import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('CI workflow runs product validation without publishing or release secrets', async () => {
  const source = await read('.github/workflows/ci.yml');
  assert.match(source, /pull_request:/);
  assert.match(source, /push:/);
  assert.match(source, /npm (?:run validate|test)/);
  assert.match(source, /npm run test:go/);
  assert.match(source, /npm run build:vscode/);
  assert.doesNotMatch(source, /NOLANE_UPDATE_PRIVATE_KEY|WIN_CSC|gh release create/);
});

test('release workflow builds a Windows NSIS installer, signs Nolane manifest, attests artifacts, and publishes GitHub Release assets', async () => {
  const source = await read('.github/workflows/release.yml');
  assert.match(source, /tags:\s*\n\s*- ['"]v\*['"]/);
  assert.match(source, /runs-on: windows-latest/);
  assert.match(source, /contents: write/);
  assert.match(source, /id-token: write/);
  assert.match(source, /attestations: write/);
  assert.match(source, /electron-builder@26\.15\.3/);
  assert.match(source, /npm run build:electron:installer/);
  assert.match(source, /NOLANE_UPDATE_PRIVATE_KEY_B64/);
  assert.match(source, /nolane\.agent\.update\.v2/);
  assert.match(source, /--package-kind nsis/);
  assert.match(source, /actions\/attest@v4/);
  assert.match(source, /gh release create/);
  assert.match(source, /SHA256SUMS/);
  assert.match(source, /WIN_CSC_LINK/);
  assert.match(source, /npm run release:matrix/);
  assert.match(source, /release\/matrix-\$\{\{ steps\.update_trust\.outputs\.version \}\}\/full-release-matrix\.md/);
  assert.match(source, /release\/matrix-\$\{\{ steps\.update_trust\.outputs\.version \}\}\/full-release-matrix\.json/);
  assert.match(source, /matrixMd|full-release-matrix\.md/);
  assert.doesNotMatch(source, /nolane_native-agent|NolaneNative/);
});

test('release workflow verifies tag/version coherence and fails closed without the update signing key', async () => {
  const [workflow, verifier] = await Promise.all([read('.github/workflows/release.yml'), read('scripts/verify-release-tag.mjs')]);
  assert.match(workflow, /verify-release-tag\.mjs/);
  assert.match(workflow, /if \(-not \$env:NOLANE_UPDATE_PRIVATE_KEY_B64\)/);
  assert.match(verifier, /package\.json/);
  assert.match(verifier, /v\$\{version\}/);
  assert.match(verifier, /GITHUB_SHA/);
});

test('Dependabot keeps GitHub Actions and npm release tooling current', async () => {
  const source = await read('.github/dependabot.yml');
  assert.match(source, /package-ecosystem: "github-actions"/);
  assert.match(source, /package-ecosystem: "npm"/);
});
