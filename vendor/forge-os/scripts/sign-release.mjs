import { createHash, sign, createPrivateKey, createPublicKey } from 'node:crypto';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalStringify } from '../src/core/canonical-json.mjs';
import { buildSourceManifest } from './release-verify.mjs';

async function shaFile(file){const bytes=await readFile(file);return {sha256:createHash('sha256').update(bytes).digest('hex'),size:(await stat(file)).size};}
export async function createReleaseProvenance({root=process.cwd(),artifacts=[],builderId='forgeos:local'}){
  const source=await buildSourceManifest(root);
  const subject=[];
  for(const file of artifacts){const digest=await shaFile(file);subject.push({name:path.basename(file),digest:{sha256:digest.sha256},size:digest.size});}
  subject.sort((a,b)=>a.name.localeCompare(b.name));
  const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  return {_type:'https://in-toto.io/Statement/v1',subject,predicateType:'https://slsa.dev/provenance/v1',predicate:{buildDefinition:{buildType:'https://forgeos.dev/build/archive/v1',externalParameters:{version:pkg.version},internalParameters:{sourceManifestSha256:source.sha256,sourceManifestAlgorithm:source.algorithm},resolvedDependencies:[]},runDetails:{builder:{id:builderId},metadata:{invocationId:source.sha256,startedOn:null,finishedOn:null},byproducts:[{name:'source-manifest',digest:{sha256:source.sha256},algorithm:source.algorithm,fileCount:source.files}]}}};
}
export function signReleaseProvenance(statement,privateKeyInput){const key=privateKeyInput?.type==='private'?privateKeyInput:createPrivateKey(privateKeyInput);const bytes=Buffer.from(canonicalStringify(statement));const signature=sign(null,bytes,key);const publicKey=createPublicKey(key).export({type:'spki',format:'pem'});return {statement,signature:{algorithm:'Ed25519',value:signature.toString('base64'),publicKeySha256:createHash('sha256').update(publicKey).digest('hex')},publicKey:String(publicKey)};}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [out,privateKeyFile,...artifacts]=process.argv.slice(2);
  if(!out||!privateKeyFile||!artifacts.length)throw new Error('Usage: node scripts/sign-release.mjs <output.json> <private-key.pem> <artifact...>');
  const statement=await createReleaseProvenance({artifacts:artifacts.map((file)=>path.resolve(file))});
  const signed=signReleaseProvenance(statement,await readFile(privateKeyFile,'utf8'));
  await mkdir(path.dirname(path.resolve(out)),{recursive:true});await writeFile(path.resolve(out),`${JSON.stringify(signed,null,2)}\n`);console.log(path.resolve(out));
}
