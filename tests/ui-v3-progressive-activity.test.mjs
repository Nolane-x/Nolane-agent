import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivityController, renderActivityView } from '../ui-v3/views/activity/activity-view.mjs';

test('activity surface shows mission tasks and separates agent events from system noise', async () => {
  const api={async get(path){
    if(path.startsWith('/api/events'))return [{type:'security.route-gate',refs:{missionId:'m1'},payload:{route:'/api/test'}},{type:'mission.planned',refs:{missionId:'m1'},payload:{summary:'Build UI',taskCount:2}}];
    if(path==='/api/missions')return [{id:'m1',objective:'Build UI',status:'running',metadata:{summary:'Progressive UI'}}];
    if(path.startsWith('/api/tasks'))return [{id:'t1',missionId:'m1',title:'Audit',role:'scout',status:'completed'},{id:'t2',missionId:'m1',title:'Build',role:'builder',status:'ready'}];
    return {};
  }};
  const controller=createActivityController({api,selectedMissionId:'m1'});await controller.load();
  const html=renderActivityView(controller.snapshot());
  assert.match(html,/Selected mission/);assert.match(html,/Build UI/);assert.match(html,/50%/);assert.match(html,/mission\.planned/);assert.doesNotMatch(html,/security\.route-gate/);
  controller.setFilter('system');assert.match(renderActivityView(controller.snapshot()),/security\.route-gate/);
});
