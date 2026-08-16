#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const args=new Map(); for(let i=2;i<process.argv.length;i+=2) args.set(process.argv[i],process.argv[i+1]);
const root=path.resolve(args.get('--dir')??'release/final'); const output=path.resolve(args.get('--output')??path.join(root,'RELEASE-MANIFEST.json'));
const checksumOutput=path.resolve(args.get('--checksums')??path.join(root,'SHA256SUMS')); const pkg=JSON.parse(await readFile(path.resolve('package.json'),'utf8'));
const expectedVersion=args.get('--version')??pkg.version; if(pkg.version!==expectedVersion) throw new Error(`Release manifest version mismatch: package=${pkg.version} expected=${expectedVersion}`);
const excluded=new Set([path.basename(output),path.basename(checksumOutput)]); const files=[];
async function walk(current){ for(const entry of await readdir(current,{withFileTypes:true})){ const absolute=path.join(current,entry.name); if(entry.isDirectory()) await walk(absolute); else if(entry.isFile()&&!excluded.has(entry.name)){ const content=await readFile(absolute); const info=await stat(absolute); files.push({path:path.relative(root,absolute).replaceAll('\\','/'),bytes:info.size,sha256:createHash('sha256').update(content).digest('hex')}); } } }
await mkdir(root,{recursive:true}); await walk(root); files.sort((a,b)=>a.path.localeCompare(b.path)); const capabilities=JSON.parse(await readFile(path.resolve('config/release-platform-capabilities.json'),'utf8'));
const manifest={schema:'nolane.agent.release-manifest.v1',product:'Nolane Agent',version:expectedVersion,tag:args.get('--tag')??`v${expectedVersion}`,commit:args.get('--commit')??process.env.GITHUB_SHA??null,generatedAt:new Date().toISOString(),files,trust:{checksums:'sha256',provenance:'GitHub Actions attestation when available',signingClaims:'bounded-by-platform-verification'},platformCapabilities:capabilities.platforms};
await writeFile(output,`${JSON.stringify(manifest,null,2)}\n`); const manifestBytes=await readFile(output); const all=[...files,{path:path.basename(output),bytes:manifestBytes.length,sha256:createHash('sha256').update(manifestBytes).digest('hex')}].sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(checksumOutput,all.map(item=>`${item.sha256}  ${item.path}`).join('\n')+'\n'); process.stdout.write(JSON.stringify({status:'pass',version:expectedVersion,files:all.length,manifest:output,checksums:checksumOutput})+'\n');
