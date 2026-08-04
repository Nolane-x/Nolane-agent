import test from 'node:test';
import assert from 'node:assert/strict';
import { GATE_RULES, runGate } from '../src/core/gates.mjs';
import { STAGES } from '../src/core/constants.mjs';
import { trustedEvidenceRecord } from './helpers/trusted-evidence.mjs';

const evidence=(type,project)=>trustedEvidenceRecord(type,project);

test('every non-terminal workflow stage has an explicit evidence gate',()=>{assert.deepEqual(Object.keys(GATE_RULES),STAGES.slice(0,-1));for(const stage of STAGES.slice(0,-1))assert.ok(GATE_RULES[stage].length>=1);});
test('intent gate requires confirmed intent and measurable success',()=>{assert.equal(runGate({stage:'intent',revision:1,semanticRevision:1,intent:null,artifacts:[],evidence:[],findings:[]}).status,'blocked');assert.equal(runGate({stage:'intent',revision:1,semanticRevision:1,intent:{confirmed:true,success:['critical flow passes']},artifacts:[],evidence:[],findings:[]}).status,'pass');});
test('release readiness uses assurance policy and authenticated risk state',()=>{const project={id:'forge_gate',revision:7,semanticRevision:5,stage:'release-readiness',assurance:'A0',artifacts:[{id:'release',type:'release-dossier',state:'verified'}],evidence:[],findings:[{severity:'critical',status:'open'}],ideas:[],scores:[],decisions:[]};project.evidence=[evidence('verification-report',project)];assert.equal(runGate(project).status,'fail');project.findings[0]={...project.findings[0],status:'accepted',acceptedBy:{id:'owner',type:'human'}};assert.equal(runGate(project).status,'pass');project.assurance='A1';assert.equal(runGate(project).status,'fail');});
