import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_COMMANDS } from '../scripts/release-verify.mjs';
import { ARCHIVE_ACCEPTANCE_COMMANDS } from '../scripts/archive-acceptance.mjs';

test('v0.6 release verifier makes deterministic generation, v0.6 audit, skill/router/context benchmarks, federation adversarial evaluation, and federation audit mandatory',()=>{
 const text=RELEASE_COMMANDS.join('\n');
 for(const command of ['npm run generate:capabilities','npm run generate:knowledge','npm run generate:v06','npm run v06:audit','npm run skills:v2:audit','npm run skills:certification-audit','npm run test:mutation-critical','npm run router:benchmark','npm run context:benchmark','npm run federation:eval','npm run federation:audit'])assert.match(text,new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('release archives rerun Skill Intelligence and federation gates after extraction',()=>{
 const text=ARCHIVE_ACCEPTANCE_COMMANDS.map(([command,args])=>[command,...args].join(' ')).join('\n');
 for(const command of ['npm run generate:v06','npm run v06:audit','npm run skills:v2:audit','npm run skills:certification-audit','npm run test:mutation-critical','npm run router:benchmark','npm run context:benchmark','npm run federation:eval','npm run federation:audit'])assert.match(text,new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
