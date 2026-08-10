import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(full.endsWith('.md'))files.push(full)}}
await walk('.');
const failures=[];
for(const file of files){const body=await readFile(file,'utf8');const regex=/!?(?:\[[^\]]*\])\(([^)]+)\)/g;for(const match of body.matchAll(regex)){let target=match[1].trim().replace(/^<|>$/g,'').split(/\s+['"]/)[0];if(!target||/^(?:https?:|mailto:|#|data:)/i.test(target))continue;target=decodeURIComponent(target.split('#')[0]);if(!target)continue;const resolved=path.resolve(path.dirname(file),target);try{await access(resolved)}catch{failures.push(`${file}: missing ${target}`)}}}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}else console.log(`Validated local links in ${files.length} Markdown files.`);
