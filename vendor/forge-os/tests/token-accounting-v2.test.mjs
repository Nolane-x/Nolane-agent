import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenAccountingRegistry, createDefaultTokenAccountingRegistry } from '../src/context/token-accounting.mjs';
import { compileBudgetTree } from '../src/context/budget-policy.mjs';

test('token accounting uses one provider interface for text, messages, and tool schemas',async()=>{
  const registry=createDefaultTokenAccountingRegistry();
  for(const model of ['gpt-5.6','claude-opus-4.2','gemini-3.0-pro','qwen3.5-32b']){
    const text=await registry.countText(model,'Hello 世界. This is a deterministic token estimate.');
    const messages=await registry.countMessages(model,[{role:'user',content:'Hello 世界. This is a deterministic token estimate.'}]);
    const tools=await registry.countToolSchemas(model,[{name:'read_file',description:'Read a file',inputSchema:{type:'object',properties:{path:{type:'string'}}}}]);
    assert.ok(text>0);assert.ok(messages>text);assert.ok(tools>0);
  }
});

test('calibration records provider usage and lowers repeated systematic estimation error',async()=>{
  const registry=createDefaultTokenAccountingRegistry();
  const model='gpt-5.6';
  const content='x '.repeat(1000);
  const before=await registry.countText(model,content);
  registry.observe({model,estimatedTokens:before,actualTokens:Math.round(before*1.2),contentClass:'text'});
  registry.observe({model,estimatedTokens:before,actualTokens:Math.round(before*1.2),contentClass:'text'});
  const after=await registry.countText(model,content);
  assert.ok(after>before);
  assert.ok(Math.abs(after-before*1.2)<Math.abs(before-before*1.2));
});

test('global budget compiler reserves output and safety tokens and rejects impossible allocations',()=>{
  const budget=compileBudgetTree({modelContextLimit:128000,hardInputLimit:96000,outputReserve:16000,safetyReserve:8000,budgets:{system:5000,task:3000,skills:8000,code:42000,artifacts:18000,memory:8000,toolOutput:8000,references:4000}});
  assert.equal(budget.availableInput,96000);
  assert.ok(budget.requested<=budget.availableInput);
  assert.throws(()=>compileBudgetTree({modelContextLimit:1000,hardInputLimit:900,outputReserve:500,safetyReserve:500,budgets:{skills:100}}),/reserve|budget/i);
});
