import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules','.forgeos-data','.forgeos-demo-data'].includes(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(full.endsWith('.json'))files.push(full)}}
await walk('.');
const failures=[];
for(const file of files){try{JSON.parse(await readFile(file,'utf8'))}catch(error){failures.push(`${file}: ${error.message}`)}}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}else console.log(`Parsed ${files.length} JSON files.`);
