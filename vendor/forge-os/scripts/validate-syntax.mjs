import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(full.endsWith('.mjs'))files.push(full)}}
for(const root of ['src','scripts','config'])await walk(root);
const failures=[];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)failures.push(`${file}: ${result.stderr.trim()}`)}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}else console.log(`Syntax checked ${files.length} modules.`);
