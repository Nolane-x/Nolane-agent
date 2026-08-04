import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { verifyCollaborationExperience } from '../src/release/collaboration-experience-verifier.mjs';
const root=path.resolve(process.argv[2]??'.');const metadata=await import(path.join(root,'src/version.mjs'));const output=path.join(root,'release',`collaboration-experience-${metadata.VERSION}.json`);await mkdir(path.dirname(output),{recursive:true});const report=await verifyCollaborationExperience({rootDirectory:root,version:metadata.VERSION,outputFile:output});process.stdout.write(`${JSON.stringify({status:report.status,version:report.version,receiptSha256:report.receiptSha256,output:path.relative(root,output).replaceAll('\\','/')})}\n`);
