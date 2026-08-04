import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyWorldModelPortfolio } from '../src/release/world-model-portfolio-verifier.mjs';
const root=path.resolve(process.argv[2]??'.');const metadata=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));const version=String(process.argv[3]??metadata.version);const report=await verifyWorldModelPortfolio({rootDirectory:root,version,outputFile:path.join(root,'release',`world-model-portfolio-${version}.json`)});process.stdout.write(`${JSON.stringify({status:report.status,version,receiptSha256:report.receiptSha256,failures:report.failures})}\n`);if(report.status!=='pass')process.exitCode=1;
