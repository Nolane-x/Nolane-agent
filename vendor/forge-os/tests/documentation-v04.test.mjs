import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PRODUCT } from '../src/core/constants.mjs';

const requiredDocs=['docs/SKILL-INTELLIGENCE.md','docs/GLOBAL-CONTEXT-KERNEL.md','docs/DETERMINISTIC-SKILL-FABRIC-V06.md','docs/EVAL-LAB-V2.md','docs/CONTINUOUS-LEARNING-V06.md','docs/HARNESS-RUNTIME-V2.md','docs/AGENT-SURFACE-SECURITY.md','docs/CLAIMS-BOUNDARY-V0.6.md'];

test('v0.6 README presents measured Skill Intelligence without claiming 1,024 production-grade procedural skills',async()=>{
 const readme=await readFile('README.md','utf8');
 for(const pattern of [new RegExp(`release-v${PRODUCT.version.replaceAll('.', '\\.')}`),/Skill Intelligence/i,/128 deep/i,/32 L0/i,/96 L1/i,/33 declared stable-channel procedural/i,/Precision@1/i,/Global Context Kernel/i,/Deterministic Skill Fabric/i])assert.match(readme,pattern);
 assert.doesNotMatch(readme,/ForgeOS (?:contains|ships|includes|provides) 1,024 (?:production-grade|deep|expert|hand-authored) (?:procedural )?skills/i);
 assert.match(readme,/PostgreSQL[^\n]+not yet|not yet a v0\.6 claim/i);
});

test('Vietnamese README and v0.6 technical documents state the same claims boundary',async()=>{
 const vn=await readFile('README-vn.md','utf8');
 for(const pattern of [new RegExp(PRODUCT.version.replaceAll('.', '\\.')),/Skill Intelligence/i,/128 kỹ thuật/i,/32 L0/i,/96 L1/i,/33 provider procedural/i,/Global Context Kernel/i])assert.match(vn,pattern);
 for(const file of requiredDocs){const text=await readFile(file,'utf8');assert.ok(text.length>800,`${file} must be substantive`);assert.doesNotMatch(text,/\bTBD\b|\bTODO\b|implement later/i);}
});

test('localized README collection contains no stale pre-v0.6 release badge',async()=>{
 const files=(await readdir('.')).filter(name=>/^README-[a-z-]+\.md$/i.test(name));assert.ok(files.length>=20);
 for(const file of files){const text=await readFile(file,'utf8');assert.doesNotMatch(text,/version-0\.[45]\.0|phiên_bản-0\.[45]\.0|\bv0\.[45]\.0\b/,`${file} contains stale release badge`);}
});

test('ChatGPT deployment documentation uses runtime origin and production federation boundaries',async()=>{const doc=await readFile('docs/CHATGPT.md','utf8');assert.match(doc,/FORGEOS_ALLOWED_ORIGINS/);assert.doesNotMatch(doc,/FORGEOS_ALLOW_ORIGIN(?!S)/);assert.match(doc,/OIDC|API key/);assert.match(doc,/quarantine|federation/i);});
