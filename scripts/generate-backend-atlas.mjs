import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=process.cwd();
const sourcePath=path.join(root,'src/server/routes.mjs');
const source=await readFile(sourcePath,'utf8');
const lines=source.split(/\r?\n/);
const entries=[];const seen=new Set();
const methodFrom=(line)=>{const m=line.match(/method\s*===\s*['"](GET|POST|PUT|DELETE|PATCH)['"]/);return m?.[1]??'ANY'};
const domainFor=(p)=>{const parts=p.replace(/^\^?/,'').replace(/^\/api\//,'').split('/').filter(Boolean);return parts.slice(0,parts[0]==='nolane'?2:1).join('/')||'root'};
for(let index=0;index<lines.length;index++){
 const line=lines[index];
 const method=methodFrom(line);
 for(const match of line.matchAll(/pathname\s*===\s*['"](\/api\/[^'"]+)['"]/g)){
   const key=`${method}:${match[1]}`;if(seen.has(key))continue;seen.add(key);entries.push({method,path:match[1],kind:'exact',domain:domainFor(match[1]),line:index+1});
 }
 for(const match of line.matchAll(/pathname\.startsWith\(['"](\/api\/[^'"]+)['"]\)/g)){
   const p=`${match[1]}*`;const key=`${method}:${p}`;if(seen.has(key))continue;seen.add(key);entries.push({method,path:p,kind:'prefix',domain:domainFor(match[1]),line:index+1});
 }
 const rx=line.match(/pathname\.match\(\/(\^\\\/api\\\/[^/]+(?:\\\/[^/]+)*)/);
 if(rx){const p=rx[1].replaceAll('\\/','/').replace(/^\^/,'')+'…';const key=`${method}:${p}`;if(!seen.has(key)){seen.add(key);entries.push({method,path:p,kind:'pattern',domain:domainFor(p),line:index+1});}}
}
entries.sort((a,b)=>a.domain.localeCompare(b.domain)||a.path.localeCompare(b.path)||a.method.localeCompare(b.method));
const domains=[...new Set(entries.map(x=>x.domain))].map(id=>({id,count:entries.filter(x=>x.domain===id).length,read:entries.filter(x=>x.domain===id&&x.method==='GET').length,write:entries.filter(x=>x.domain===id&&x.method!=='GET').length})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
const sha256=createHash('sha256').update(source).digest('hex');
const payload={schema:'nolane.ui.backend-atlas.v1',generatedAt:new Date().toISOString(),source:'src/server/routes.mjs',sourceSha256:sha256,total:entries.length,domains,entries};
await mkdir(path.join(root,'ui-v3/generated'),{recursive:true});
await writeFile(path.join(root,'ui-v3/generated/backend-atlas.json'),JSON.stringify(payload,null,2)+'\n');
await writeFile(path.join(root,'ui-v3/generated/backend-atlas.mjs'),`export const BACKEND_ATLAS = Object.freeze(${JSON.stringify(payload)});\n`);
console.log(JSON.stringify({total:entries.length,domains:domains.length,sourceSha256:sha256}));
