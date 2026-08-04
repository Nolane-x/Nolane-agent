import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyDevelopmentalAgentLearning } from '../src/release/developmental-agent-learning-verifier.mjs';
const root=path.resolve(process.argv[2]??'.');const metadata=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));const version=String(process.argv[3]??metadata.version);const report=await verifyDevelopmentalAgentLearning({rootDirectory:root,version,outputFile:path.join(root,'release',`developmental-agent-learning-${version}.json`)});process.stdout.write(`${JSON.stringify({status:report.status,version,receiptSha256:report.receiptSha256,failures:report.failures})}\n`);if(report.status!=='pass')process.exitCode=1;
