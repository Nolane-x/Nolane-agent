import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../../core/canonical-json.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const DEFAULT_DIR=path.join(ROOT,'config/policy-profiles');
function validate(profile){if(!profile||typeof profile!=='object'||typeof profile.id!=='string'||!Array.isArray(profile.rules)||!profile.rules.length)throw new TypeError('Invalid policy profile');return Object.freeze({...profile,sha256:canonicalSha256(profile)});}
export async function loadPolicyProfiles(directory=DEFAULT_DIR){const files=(await readdir(directory)).filter((name)=>name.endsWith('.json')).sort();return Object.freeze(await Promise.all(files.map(async(name)=>validate(JSON.parse(await readFile(path.join(directory,name),'utf8'))))));}
export function resolvePolicyProfileHashes(ids,profiles){const byId=new Map((profiles??[]).map((profile)=>[profile.id,profile]));return Object.freeze((ids??[]).map((id)=>{const profile=byId.get(id);if(!profile)throw new Error(`Unknown policy profile: ${id}`);return Object.freeze({id:profile.id,version:profile.version,sha256:profile.sha256??canonicalSha256({...profile,sha256:undefined})});}));}
