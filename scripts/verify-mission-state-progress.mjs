#!/usr/bin/env node
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyMissionStateProgress } from '../src/release/mission-state-progress-verifier.mjs';
const root=path.resolve(process.argv[2]??'.');const identity=JSON.parse(await readFile(path.join(root,'config','release-identity.json'),'utf8'));const report=await verifyMissionStateProgress({rootDirectory:root,version:identity.version,outputFile:path.join(root,'release',`mission-state-progress-${identity.version}.json`)});console.log(JSON.stringify(report,null,2));
