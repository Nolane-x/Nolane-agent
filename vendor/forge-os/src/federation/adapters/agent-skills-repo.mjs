import path from 'node:path';
import { canonicalSha256 } from '../../core/canonical-json.mjs';

function parseFrontmatter(content) {
  if (!String(content).startsWith('---\n')) throw new Error('missing YAML frontmatter');
  const end=content.indexOf('\n---\n',4); if(end<0) throw new Error('unterminated YAML frontmatter');
  const data={};
  for(const line of content.slice(4,end).split('\n')){
    const match=/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line);
    if(match)data[match[1]]=match[2].replace(/^['"]|['"]$/g,'');
  }
  if(!data.name||!data.description)throw new Error('name and description are required');
  return {metadata:data,body:content.slice(end+5)};
}

function directories(files) {
  return files.filter((file)=>file.path==='SKILL.md'||file.path.endsWith('/SKILL.md')).map((file)=>({file,dir:path.posix.dirname(file.path)==='.'?'':path.posix.dirname(file.path)}));
}


export function filesForSkillRoot(files, root = '.') {
  const normalizedRoot = root === '.' ? '' : String(root).replace(/\/$/, '');
  const allRoots = directories(files).map(({ dir }) => dir);
  const nestedRoots = allRoots.filter((candidate) => candidate && candidate !== normalizedRoot && (!normalizedRoot || candidate.startsWith(`${normalizedRoot}/`)));
  const prefix = normalizedRoot ? `${normalizedRoot}/` : '';
  return files.filter((entry) => {
    const withinRoot = normalizedRoot ? entry.path === `${normalizedRoot}/SKILL.md` || entry.path.startsWith(prefix) : true;
    if (!withinRoot) return false;
    return !nestedRoots.some((nested) => entry.path === `${nested}/SKILL.md` || entry.path.startsWith(`${nested}/`));
  });
}

export function discoverAgentSkills(snapshot) {
  const providers=[]; const findings=[];
  for(const {file,dir} of directories(snapshot.files??[])){
    try{
      const parsed=parseFrontmatter(String(file.content??''));
      const related=filesForSkillRoot(snapshot.files??[],dir||'.');
      const references=related.filter((entry)=>entry.path.includes('/references/')).map((entry)=>entry.path).sort();
      const executables=related.filter((entry)=>entry.path.includes('/scripts/')||/\.(?:sh|mjs|js|py|ps1|bat|cmd)$/i.test(entry.path)&&entry.path!==file.path).map((entry)=>entry.path).sort();
      providers.push({
        providerId:`${snapshot.source?.id??'source'}.${parsed.metadata.name}`,
        name:parsed.metadata.name,description:parsed.metadata.description,kind:'skill',status:'quarantined',
        sourceId:snapshot.source?.id??'unknown',authority:snapshot.source?.authority??'community',revision:String(snapshot.revision??''),
        root:dir||'.',references,executables,license:{...(snapshot.source?.license??{spdx:'UNKNOWN',mode:'link-only'})},
        contentDigest:canonicalSha256(related.map((entry)=>({path:entry.path,content:String(entry.content??'')})).sort((a,b)=>a.path.localeCompare(b.path))),
        metadata:parsed.metadata,
      });
    }catch(error){findings.push({code:'invalid-skill-frontmatter',severity:'blocker',path:file.path,message:error.message});}
  }
  return {providers,findings};
}
