import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { createDefaultTokenAccountingRegistry } from '../context/token-accounting.mjs';
import { loadSkillSections } from '../skills/v2/section-index.mjs';

const TEXT_EXTENSIONS=new Set(['.md','.mdx','.txt','.json','.yaml','.yml','.toml','.csv']);
function resolveMaterialRoot(root){
  const value=String(root??process.cwd());
  return path.resolve(process.platform==='win32'&&/^\/[A-Za-z]:[\\/]/.test(value)?value.slice(1):value);
}
function verifyBundle(bundle){
  if(!bundle||typeof bundle!=='object')throw new TypeError('Execution bundle is required');
  const payload=structuredClone(bundle);delete payload.bundleId;delete payload.bundleSha256;
  const actual=canonicalSha256(payload);
  if(actual!==bundle.bundleSha256||bundle.bundleId!==`bundle_${actual.slice(0,24)}`)throw new Error('Execution bundle digest is invalid');
  if(bundle.executable===false||(bundle.unresolved??[]).length)throw new Error(`Execution bundle is unresolved and not executable: ${(bundle.unresolved??[]).join('; ')}`);
  if(bundle.context?.withinBudget===false)throw new Error('Execution bundle is outside its compiled context budget');
}

function safeRelative(root,relative){
  const resolvedRoot=resolveMaterialRoot(root);
  const value=String(relative??'').replaceAll('\\','/');
  if(!value||path.posix.isAbsolute(value)||path.win32.isAbsolute(value)||value.split('/').includes('..'))throw new Error(`Provider material path is not a safe relative path: ${value}`);
  const absolute=path.resolve(resolvedRoot,value);const boundary=`${resolvedRoot}${path.sep}`;
  if(absolute!==resolvedRoot&&!absolute.startsWith(boundary))throw new Error(`Provider material path is not a safe relative path: ${value}`);
  return absolute;
}
async function safeMaterialPath(root,relative){
  const lexical=safeRelative(root,relative);
  const [rootReal,fileReal]=await Promise.all([realpath(resolveMaterialRoot(root)),realpath(lexical)]);
  const boundary=`${rootReal}${path.sep}`;
  if(fileReal!==rootReal&&!fileReal.startsWith(boundary))throw new Error(`Provider material path escapes repository root through a symlink: ${relative}`);
  return fileReal;
}
function providerById(providers,id){const provider=(providers??[]).find((item)=>item.providerId===id);if(!provider)throw new Error(`Selected provider is missing: ${id}`);return provider;}
function assertProvider(selected,provider){
  if(provider.status!=='stable')throw new Error(`Materialization requires a stable provider: ${provider.providerId}`);
  if(provider.providerDigest!==selected.providerDigest)throw new Error(`Provider digest mismatch: ${provider.providerId}`);
  if(provider.contentDigest!==selected.contentDigest)throw new Error(`Provider content digest mismatch: ${provider.providerId}`);
  if(provider.trust?.blockers?.length)throw new Error(`Provider has unresolved trust blockers: ${provider.providerId}`);
}
function countBytes(value){return Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value),'utf8');}
function safeExternalDocuments(provider){
  const files=provider.material?.files??[];
  const documents=[];
  for(const file of files){
    const relative=String(file.path??'').replaceAll('\\','/');
    if(path.posix.isAbsolute(relative)||relative.split('/').includes('..'))throw new Error(`Provider material path is not a safe relative path: ${relative}`);
    const extension=path.posix.extname(relative).toLowerCase();
    const isManifest=relative==='SKILL.md'||relative.endsWith('/SKILL.md');
    if(!isManifest&&!TEXT_EXTENSIONS.has(extension))continue;
    if(/(?:^|\/)scripts?(?:\/|$)/i.test(relative))continue;
    documents.push({path:relative,content:String(file.content??''),sha256:canonicalSha256(String(file.content??''))});
  }
  documents.sort((a,b)=>{const am=a.path==='SKILL.md'||a.path.endsWith('/SKILL.md');const bm=b.path==='SKILL.md'||b.path.endsWith('/SKILL.md');return am!==bm?(am?-1:1):a.path.localeCompare(b.path);});
  return documents;
}
async function skillMaterial(provider,selected,root,{registry,model,hardTokens}){
  if(provider.material?.type==='local-agent-skill-v2'){
    const packageRoot=await safeMaterialPath(root,provider.material.packagePath);
    const manifestPath=await safeMaterialPath(root,provider.material.manifestPath);
    const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
    if(manifest.manifestSha256!==provider.contentDigest)throw new Error(`Skill manifest digest mismatch: ${provider.providerId}`);
    const sectionIds=selected.selectedSections?.length?selected.selectedSections:provider.material.defaultSections;
    const loaded=await loadSkillSections(packageRoot,provider.material.sectionIndex,{sectionIds,model,hardTokens,registry});
    return{providerId:provider.providerId,kind:'skill',providerDigest:provider.providerDigest,manifestSha256:manifest.manifestSha256,documents:loaded.sections.map((section)=>({path:section.path,sectionId:section.id,content:section.content,sha256:section.sha256,tokens:section.tokens})),omittedSections:loaded.omitted,sectionTokens:loaded.tokens,executablesExcluded:true};
  }
  if(provider.material?.type==='local-agent-skill'){
    const absolute=await safeMaterialPath(root,provider.material.path);const content=await readFile(absolute,'utf8');return{providerId:provider.providerId,kind:'skill',providerDigest:provider.providerDigest,documents:[{path:provider.material.path,content,sha256:canonicalSha256(content)}],executablesExcluded:true};
  }
  if(provider.material?.type==='external-agent-skill')return{providerId:provider.providerId,kind:'skill',providerDigest:provider.providerDigest,documents:safeExternalDocuments(provider),executablesExcluded:true};
  throw new Error(`Unsupported skill material type: ${provider.material?.type??'missing'}`);
}
async function knowledgeMaterial(provider,root){
  if(provider.material?.type!=='knowledge-pack-reference')throw new Error(`Unsupported knowledge material type: ${provider.material?.type??'missing'}`);
  const absolute=await safeMaterialPath(root,provider.material.path);
  const pack=JSON.parse(await readFile(absolute,'utf8'));
  return{providerId:provider.providerId,kind:'knowledge',providerDigest:provider.providerDigest,packId:pack.id,title:pack.title,loadingPolicy:pack.loadingPolicy,references:structuredClone(pack.sources??[]),remoteContentVendored:false};
}
function mcpMaterial(provider){
  const tools=(provider.material?.server?.tools??[]).map((tool)=>({name:tool.name,description:tool.description??null,annotations:structuredClone(tool.annotations??{})}));
  return{providerId:provider.providerId,kind:'mcp',providerDigest:provider.providerDigest,tools,credentialMaterialIncluded:false,executionRequiresBroker:true};
}
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}

export async function materializeCapabilityBundle(bundle,{providers,root=process.cwd(),maxBytes=256_000,registry=createDefaultTokenAccountingRegistry()}={}){
  verifyBundle(bundle);
  if(!Number.isInteger(maxBytes)||maxBytes<1)throw new TypeError('maxBytes must be a positive integer');
  const model=bundle.context?.model??'gpt-5.6';const materials=[];let bytes=0;
  for(const selected of bundle.selected??[]){
    const provider=providerById(providers,selected.providerId);assertProvider(selected,provider);
    const material=provider.kind==='skill'?await skillMaterial(provider,selected,root,{registry,model,hardTokens:Math.max(selected.estimatedTokens??0,bundle.context?.hardTokens??bundle.context?.budgetTokens??0)}):provider.kind==='knowledge'?await knowledgeMaterial(provider,root):provider.kind==='mcp'?mcpMaterial(provider):null;
    if(!material)throw new Error(`Unsupported provider kind: ${provider.kind}`);bytes+=countBytes(material);if(bytes>maxBytes)throw new RangeError(`Capability materialization byte budget exceeded: ${bytes} > ${maxBytes}`);materials.push(material);
  }
  const estimatedTokens=await registry.countText(model,materials.map((material)=>material.kind==='skill'?material.documents.map((document)=>document.content).join('\n\n'):JSON.stringify(material)).join('\n'));
  const hardTokens=bundle.context?.hardTokens??bundle.context?.budgetTokens??0;if(estimatedTokens>hardTokens)throw new RangeError(`Capability materialization token budget exceeded: ${estimatedTokens} > ${hardTokens}`);
  const payload={schemaVersion:2,bundleId:bundle.bundleId,bundleSha256:bundle.bundleSha256,capabilityId:bundle.capability.capabilityId,model,materials,bytes,estimatedTokens,omissionManifest:materials.flatMap((material)=>material.omittedSections??[]).map((item)=>({...item,providerId:materials.find((m)=>m.omittedSections?.includes(item))?.providerId??null})),generatedAt:new Date().toISOString()};const stablePayload={...payload,generatedAt:null};return deepFreeze({...payload,contextPackSha256:canonicalSha256(stablePayload)});
}
