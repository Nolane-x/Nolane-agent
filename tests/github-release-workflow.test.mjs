import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('CI workflow runs product validation without publishing or release secrets', async () => {
  const source = await read('.github/workflows/ci.yml');
  assert.match(source, /pull_request:/);
  assert.doesNotMatch(source, /pull_request:\s*\n\s+paths-ignore:/);
  assert.doesNotMatch(source, /paths-ignore:\s*\n[\s\S]*'docs\/\*\*'/);
  assert.doesNotMatch(source, /paths-ignore:\s*\n[\s\S]*'checkpoints\/\*\*'/);
  assert.match(source, /push:/);
  assert.match(source, /branches:\s*\[main, master, "release\/\*\*", "feature\/\*\*", "codex\/external-gate-evidence"\]/);
  assert.equal([...source.matchAll(/if:\s*\$\{\{\s*github\.event_name != 'pull_request' \|\| github\.head_ref != github\.event\.repository\.default_branch\s*\}\}/g)].length, 2);
  assert.match(source, /npm (?:run validate|test)/);
  assert.match(source, /npm run test:go/);
  assert.match(source, /npm run build:vscode/);
  assert.doesNotMatch(source, /NOLANE_UPDATE_PRIVATE_KEY|WIN_CSC|gh release create/);
});

test('release workflow and 0.0.0 release documents require signed native artifacts on every supported platform', async () => {
  const [source, packageJson, builderConfig, readme, releaseNotes, limitations] = await Promise.all([
    read('.github/workflows/release.yml'),
    read('package.json'),
    read('electron-builder.config.cjs'),
    read('README.md'),
    read('docs/RELEASE-0.0.0.md'),
    read('docs/LIMITATIONS-0.0.0.md')
  ]);
  assert.match(source, /tags:\s*\n\s*- ['"]v\*['"]/);
  assert.match(source, /runs-on: windows-latest/);
  assert.match(source, /macos-release:/);
  assert.match(source, /runs-on: macos-latest/);
  assert.match(source, /linux-release:/);
  assert.match(source, /runs-on: ubuntu-latest/);
  assert.match(source, /contents: write/);
  assert.match(source, /id-token: write/);
  assert.match(source, /attestations: write/);
  assert.match(source, /electron-builder@26\.15\.3/);
  assert.match(source, /npm run build:electron:installer/);
  assert.match(source, /NOLANE_ELECTRON_TARGET: mac/);
  assert.match(source, /NOLANE_ELECTRON_TARGET: linux/);
  assert.match(source, /NolaneAgent-\*\.dmg/);
  assert.match(source, /NolaneAgent-\*\.AppImage/);
  assert.match(source, /NolaneAgent-\*\.deb/);
  assert.match(source, /latest-mac\.yml/);
  assert.match(source, /latest-linux\.yml/);
  assert.match(source, /Require macOS signing credentials/);
  assert.match(source, /MAC_CSC_LINK is required/);
  assert.match(source, /Require Windows signing credentials/);
  assert.match(source, /WIN_CSC_LINK is required for Windows GitHub Releases auto-update/);
  assert.match(source, /WIN_CSC_KEY_PASSWORD is required for Windows GitHub Releases auto-update/);
  assert.match(source, /actions\/download-artifact@v8/);
  assert.match(source, /digest-mismatch: error/);
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
  assert.match(packageJson, /"electron-updater"\s*:\s*"6\.8\.9"/);
  assert.match(builderConfig, /provider: 'github'/);
  assert.match(readme, /Windows.*fail(?:s)? closed.*signing credentials/i);
  assert.match(releaseNotes, /Windows.*required.*signing credentials/i);
  assert.match(limitations, /Windows.*signing credentials/i);
});

test('release workflow verifies tag/version coherence and fails closed without the update signing key', async () => {
  const [workflow, verifier] = await Promise.all([read('.github/workflows/release.yml'), read('scripts/verify-release-tag.mjs')]);
  assert.match(workflow, /verify-release-tag\.mjs/);
  assert.match(workflow, /if \(-not \$env:NOLANE_UPDATE_PRIVATE_KEY_B64\)/);
  assert.match(verifier, /package\.json/);
  assert.match(verifier, /v\$\{version\}/);
  assert.match(verifier, /GITHUB_SHA/);
});

test('release workflow gates every platform build on exact-head candidate evidence', async () => {
  const [workflow, packageJson] = await Promise.all([
    read('.github/workflows/release.yml'),
    read('package.json')
  ]);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /candidate-gate:/);
  assert.match(workflow, /id: candidate_identity/);
  assert.match(workflow, /source_sha=\$\(git rev-parse HEAD\)/);
  assert.match(workflow, /npm run verify:release-candidate/);
  assert.match(workflow, /external-gate-certification-candidate/);
  assert.match(workflow, /macos-release:\s*\n\s+needs: candidate-gate/);
  assert.match(workflow, /linux-release:\s*\n\s+needs: candidate-gate/);
  assert.match(workflow, /windows-release:\s*\n\s+needs: \[candidate-gate, macos-release, linux-release\]/);
  assert.match(workflow, /GITHUB_SHA: \$\{\{ needs\.candidate-gate\.outputs\.source_sha \}\}/);
  assert.match(packageJson, /"verify:release-candidate"\s*:/);
});

test('Dependabot keeps GitHub Actions and npm release tooling current', async () => {
  const source = await read('.github/dependabot.yml');
  assert.match(source, /package-ecosystem: "github-actions"/);
  assert.match(source, /package-ecosystem: "npm"/);
});
