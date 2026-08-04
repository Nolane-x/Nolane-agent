import test from 'node:test'; import assert from 'node:assert/strict';
import { createActivityTimeline } from '../ui-v3/views/mission/activity-timeline.mjs';
import { buildStatusStrip } from '../ui-v3/views/mission/status-strip.mjs';
import { createMissionComposer } from '../ui-v3/views/mission/mission-composer.mjs';
import { buildMissionHeader } from '../ui-v3/views/mission/mission-header.mjs';
test('activity timeline batches polite announcements and suspends hidden work',()=>{ const t=createActivityTimeline(); t.upsert({id:'a',summary:'one'}); t.setVisible(false); t.upsert({id:'b',summary:'two'}); assert.equal(t.flushAnnouncements().length,1); assert.equal(t.snapshot().suspended,true); });
test('mission composer distinguishes queued guidance from immediate interruption',()=>{ const c=createMissionComposer({missionId:'m'}); assert.equal(c.submit({text:'later'}).delivery,'queued'); assert.equal(c.submit({text:'stop now',interrupt:true}).delivery,'interrupt'); assert.throws(()=>c.submit({text:''}),/text/i); });
test('status strip never fabricates percentage when total is unknown',()=>{ assert.equal(buildStatusStrip({phase:'testing'}).percent,null); assert.equal(buildStatusStrip({completed:2,total:4}).percent,50); });
test('mission header exposes isolated worktree and bounded controls',()=>{ const h=buildMissionHeader({missionId:'m',title:'Build',status:'running',worktreeIsolated:true}); assert.equal(h.isolationLabel,'Worktree isolated'); assert.deepEqual(h.actions,['pause','stop','more']); });
