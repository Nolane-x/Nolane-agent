import { verifyReleaseArtifacts } from '../src/release/release-artifacts.mjs';
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const report = await verifyReleaseArtifacts({ version: args.get('--version') });
process.stdout.write(`${JSON.stringify({ version: report.version, status: report.status, archives: report.archives.length })}\n`);
