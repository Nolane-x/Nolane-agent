import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { runFullReleaseMatrix } from '../src/release/full-release-matrix.mjs';

const execFileAsync = promisify(execFile);
const root = path.resolve('.');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root, timeout: 30_000, windowsHide: true });
const report = await runFullReleaseMatrix({
  rootDirectory: root,
  outputDirectory: `release/matrix-${metadata.version}`,
  version: metadata.version,
  commit: stdout.trim(),
  onGateStart: (gate) => process.stderr.write(`[release-matrix] START ${gate.id}: ${gate.label}\n`),
  onGateFinish: (gate) => process.stderr.write(`[release-matrix] ${gate.status.toUpperCase()} ${gate.id} (${gate.durationMs} ms)\n`),
});
process.stdout.write(`${JSON.stringify({ version: report.version, commit: report.commit, status: report.status, required: `${report.requiredPassed}/${report.requiredTotal}`, report: `release/matrix-${metadata.version}/full-release-matrix.json` })}\n`);
if (report.status !== 'pass') process.exitCode = 1;
