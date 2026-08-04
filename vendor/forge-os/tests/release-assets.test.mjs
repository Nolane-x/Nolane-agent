import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';

const requiredDocs=['README.md','LICENSE','SECURITY.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','GOVERNANCE.md','CHANGELOG.md','docs/ARCHITECTURE.md','docs/TRUST-KERNEL.md','docs/SKILLS.md','docs/PROTOCOLS.md','docs/ADAPTERS.md','docs/TESTING.md','docs/CHATGPT.md','docs/SECURITY-MODEL.md','docs/SKILL-INTELLIGENCE.md','docs/GLOBAL-CONTEXT-KERNEL.md','docs/DETERMINISTIC-SKILL-FABRIC-V06.md','docs/EVAL-LAB-V2.md','docs/CONTINUOUS-LEARNING-V06.md','docs/HARNESS-RUNTIME-V2.md','docs/AGENT-SURFACE-SECURITY.md','docs/CLAIMS-BOUNDARY-V0.6.md','assets/forgeos-v06-hero.svg','assets/forgeos-banner.svg','assets/architecture.svg','.github/workflows/ci.yml','Dockerfile','.env.example'];

test('public v0.6 release documentation and visuals exist and state measured boundaries',async()=>{
 for(const file of requiredDocs)await access(file);
 const readme=await readFile('README.md','utf8');
 for(const pattern of [/128 deep/i,/32 L0/i,/96 L1/i,/33 declared stable-channel procedural/i,/trust kernel/i,/MCP/,/A2A/,/npm run release:verify/,/does not claim|not a universal/i])assert.match(readme,pattern);
 assert.doesNotMatch(readme,/100% bug[- ]free|guaranteed defect[- ]free/i);
 assert.match(await readFile('LICENSE','utf8'),/MIT License/);
});

test('localized README collection covers major developer communities and exposes archive verification',async()=>{
 const translations=(await readdir('.')).filter(name=>/^README-[a-z-]+\.md$/i.test(name));assert.ok(translations.length>=20,`only ${translations.length} translations`);
 for(const file of translations){const body=await readFile(file,'utf8');assert.match(body,/ForgeOS/);assert.match(body,/npm run release:verify/);assert.ok(body.length>5000,`${file} is too shallow for a detailed translation`);assert.ok((body.match(/^## /gm)||[]).length>=7,`${file} lacks translated sections`);}
});

test('dashboard evidence records a fresh known renderer',async()=>{const renderer=(await readFile('evidence/dashboard-renderer.txt','utf8')).trim();assert.equal(renderer,'forgeos-svg');const svg=await readFile('evidence/dashboard.svg','utf8');assert.match(svg,/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);assert.doesNotMatch(svg,/<script/i);assert.doesNotMatch(svg,/(?:href|src)="https?:\/\//i);});
