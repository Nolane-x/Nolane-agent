import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyContextEngineV3 } from '../src/release/context-engine-v3-verifier.mjs';
const root=path.resolve(process.argv[2]??'.'); const metadata=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')); const output=path.join(root,'release',`context-engine-v3-${metadata.version}.json`); const report=await verifyContextEngineV3({rootDirectory:root,version:metadata.version,outputFile:output}); process.stdout.write(`${JSON.stringify({status:report.status,version:report.version,receiptSha256:report.receiptSha256,output:path.relative(root,output).replaceAll('\\','/')})}\n`);
