import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIVE_ACCEPTANCE_COMMANDS } from '../scripts/archive-acceptance.mjs';

test('archive acceptance verifies installation, invariants, protocols, adapters, and archive-first release evidence',()=>{
  const text=ARCHIVE_ACCEPTANCE_COMMANDS.map(([cmd,args])=>[cmd,...args].join(' ')).join('\n');
  for(const required of ['npm ci --ignore-scripts','npm test','npm run smoke','npm run adapter:tck','npm run release:verify'])assert.match(text,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
