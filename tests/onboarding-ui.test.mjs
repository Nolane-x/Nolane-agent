import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { renderOnboardingView } from '../ui-v3/views/onboarding/onboarding-view.mjs';
import { createOnboardingController } from '../ui-v3/views/onboarding/onboarding-controller.mjs';

const source = fs.readFileSync(new URL('../ui-v3/views/onboarding/onboarding-view.mjs', import.meta.url), 'utf8');

test('onboarding has four compact screens and never asks cloud versus local model questions', () => {
  for (let step=0;step<4;step+=1) {
    const html=renderOnboardingView({status:'ready',required:true,step,answers:{language:'en',primaryUse:'software',explanationDepth:'detailed',responseStyle:'reviewer',askBeforeAmbiguousChanges:true,experience:'studio',theme:'system',accent:'violet',density:'comfortable',motion:'system',memoryMode:'approved',notifications:{desktop:true,taskCompletion:true,approvals:true,errors:true},telemetry:false}});
    assert.match(html,new RegExp(`data-state="current"`));
  }
  assert.doesNotMatch(source,/cloud\s*(?:or|vs\.?|versus|\/)[\s-]*local|local\s*(?:or|vs\.?|versus|\/)[\s-]*cloud/i);
  assert.doesNotMatch(source,/api key|provider setup/i);
});

test('onboarding controller restores progress and sends explicit completion', async () => {
  const calls=[];
  const api={
    get:async()=>({required:true,state:{currentStep:1,draft:{language:'vi',primaryUse:'learning'}}}),
    post:async(path,body)=>{calls.push([path,body]);if(path.endsWith('/complete'))return{profile:{preferences:{experience:{level:'everyday'}}}};return{};}
  };
  const controller=createOnboardingController({api});await controller.load();
  assert.equal(controller.snapshot().step,1);assert.equal(controller.snapshot().answers.language,'vi');
  controller.set('responseStyle','teacher');await controller.persist();await controller.complete();
  assert.equal(controller.snapshot().completed,true);
  assert.equal(calls.at(-1)[0],'/api/onboarding/complete');
  assert.equal(calls.at(-1)[1].source,'guided');
});

test('fresh product defaults begin in Everyday instead of a legacy experience alias', () => {
  const appSource = fs.readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(appSource, /experience:\s*\{\s*level:\s*'everyday'\s*\}/);
});
