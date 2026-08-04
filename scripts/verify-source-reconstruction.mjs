import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { resolveSourceReconstructionPlan } from '../src/release/source-reconstruction.mjs';
import { loadReleaseNaming, releaseArtifactNames } from '../src/release/release-naming.mjs';

const execFileAsync = promisify(execFile);
const root = path.resolve(process.argv[2] ?? '.');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = String(process.argv[3] ?? metadata.version);
const naming = await loadReleaseNaming({ rootDirectory: root });
const names = releaseArtifactNames(naming, version);
const plan = await resolveSourceReconstructionPlan({ rootDirectory: root, version });
const temporary = await mkdtemp(path.join(os.tmpdir(), 'nolane-source-reconstruct-'));
try {
  const python = process.env.NOLANE_AGENT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  await execFileAsync(python, ['-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', plan.archivePath, temporary], { timeout: 5 * 60_000, windowsHide: true });
  const extracted = path.join(temporary, names.sourceRoot);
  const verificationProgram = [
    "import { verifyForgeOsVendor } from './src/release/source-reconstruction.mjs'",
    "import { verifyNolaneRuntimePurity } from './scripts/lib/nolane-runtime-purity-verifier.mjs'",
    "const v=await verifyForgeOsVendor(process.cwd()); if(v.status!=='pass') process.exit(2)",
    "const h=await verifyNolaneRuntimePurity({rootDirectory:process.cwd()}); if(h.status!=='pass'||h.archivePresent||h.runtimeModulesPresent) process.exit(3)",
    "await import('./vendor/forge-os/src/core/canonical-json.mjs')",
    "await import('./vendor/forge-os/src/core/orchestrator.mjs')",
  ].join(';');
  await execFileAsync(process.execPath, ['--input-type=module', '-e', verificationProgram], { cwd: extracted, timeout: 3 * 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  await execFileAsync(process.execPath, ['--test', '--test-reporter=spec', 'tests/source-reconstruction.test.mjs', 'tests/nolane-runtime-purity.test.mjs', 'tests/adaptive-provider-router.test.mjs'], { cwd: extracted, timeout: 5 * 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  await execFileAsync('npm', ['run', 'build:vscode'], { cwd: extracted, timeout: 5 * 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  process.stdout.write(`${JSON.stringify({ status: 'pass', version, archive: path.basename(plan.archivePath), nolane_nativeBundled: false, archiveReadInCurrentRun: true })}\n`);
} finally { await rm(temporary, { recursive: true, force: true }); }
