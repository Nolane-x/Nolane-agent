import { packageReleaseArtifacts } from '../src/release/release-artifacts.mjs';
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const report = await packageReleaseArtifacts({ version: args.get('--version') });
process.stdout.write(`${JSON.stringify({ version: report.version, artifacts: report.artifacts.length })}\n`);
