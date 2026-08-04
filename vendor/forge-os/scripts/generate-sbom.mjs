import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../src/core/canonical-json.mjs';

export async function generateSbom(root=process.cwd()){
  const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
  const components=[];
  for(const [location,entry] of Object.entries(lock.packages??{})){
    const name=entry.name??(location?location.split('node_modules/').at(-1):pkg.name);
    const version=entry.version??(location?'unknown':pkg.version);
    if(!name)continue;
    components.push({type:location?'library':'application',name,version, ...(entry.license?{licenses:[{license:{id:entry.license}}]}:{}),purl:`pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`});
  }
  components.sort((a,b)=>`${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
  const serialSeed={name:pkg.name,version:pkg.version,components:components.map(({name,version,purl})=>({name,version,purl}))};
  return {
    bomFormat:'CycloneDX',specVersion:'1.6',serialNumber:`urn:uuid:${canonicalSha256(serialSeed).slice(0,8)}-${canonicalSha256(serialSeed).slice(8,12)}-4${canonicalSha256(serialSeed).slice(13,16)}-a${canonicalSha256(serialSeed).slice(17,20)}-${canonicalSha256(serialSeed).slice(20,32)}`,version:1,
    metadata:{timestamp:new Date(0).toISOString(),tools:{components:[{type:'application',name:'ForgeOS SBOM Generator',version:pkg.version}]},component:{type:'application',name:pkg.name,version:pkg.version,purl:`pkg:npm/${pkg.name}@${pkg.version}`}},
    components,
  };
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const root=path.resolve(process.argv[2]??'.');
  const out=path.resolve(process.argv[3]??path.join(root,'dist','forgeos-sbom.cdx.json'));
  const {mkdir}=await import('node:fs/promises');await mkdir(path.dirname(out),{recursive:true});
  await writeFile(out,`${JSON.stringify(await generateSbom(root),null,2)}\n`);
  console.log(out);
}
