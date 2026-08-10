import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleSkills, routeSkills } from '../src/router/router.mjs';

const contract = (overrides={}) => ({ status:'stable', pack:'product', domains:['all'], stages:['product-definition'], consumes:['confirmed-intent'], produces:['product-thesis'], preconditions:['intent.confirmed'], requiredTools:[], optionalTools:[], conflicts:[], assurance:['A0','A1'], context:{estimatedTokens:300}, ...overrides });
const catalog = [
  { name:'a', contract:contract() },
  { name:'b', contract:contract({domains:['saas'],requiredTools:['web'],assurance:['A1','A2'],context:{estimatedTokens:200},produces:['capability-map']}) },
  { name:'c', contract:contract({status:'quarantined',domains:['saas'],preconditions:[],context:{estimatedTokens:50}}) },
];
const context={stage:'product-definition',domain:'saas',assurance:'A1',artifacts:['confirmed-intent'],facts:{'intent.confirmed':true},tools:['web'],utility:{a:0.4,b:0.8},targets:['capability-map']};

test('router filters by status, preconditions, artifacts, tools, and assurance',()=>assert.deepEqual(eligibleSkills(catalog,context).map(x=>x.name),['a','b']));
test('router ranks deterministically using gate target, domain, measured utility, and context cost',()=>{const routes=routeSkills(catalog,context,{limit:2});assert.deepEqual(routes.map(x=>x.name),['b','a']);assert.ok(routes[0].reasons.includes('target:capability-map'));});
