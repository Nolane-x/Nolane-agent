import { readFile, writeFile } from 'node:fs/promises';
const file='ui-v3/styles/pages/settings.css';
let css=await readFile(file,'utf8');
const old='.settings-actions>button.primary[data-settings-save-state="dirty"]{border-color:var(--accent);background:var(--accent);color:var(--text-inverse);opacity:1}';
const next='.settings-actions>button.primary[data-settings-save-state="dirty"]{border-color:var(--accent);background:var(--accent);color:var(--nolane-ink);opacity:1}';
if(!css.includes(old)) throw new Error('expected dirty Settings primary rule not found exactly once');
if(css.split(old).length!==2) throw new Error('dirty Settings primary rule is not unique');
css=css.replace(old,next);
await writeFile(file,css);
