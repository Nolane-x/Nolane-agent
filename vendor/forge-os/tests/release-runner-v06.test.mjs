import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {runAcceptanceCommand} from '../scripts/archive-acceptance.mjs';

test('coverage release command uses force-exit and completes with a real coverage report', async () => {
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.match(pkg.scripts['test:coverage'],/--test-force-exit/);
  const root=await mkdtemp(path.join(tmpdir(),'forgeos-coverage-contract-'));
  try{
    const fixture=path.join(root,'coverage-smoke.test.mjs');
    await writeFile(fixture,"import test from 'node:test';import assert from 'node:assert/strict';test('coverage smoke',()=>assert.equal(2+2,4));\n");
    const result=await runAcceptanceCommand(process.execPath,['--experimental-test-coverage','--test','--test-force-exit',fixture],root,{}, {timeoutMs:15_000});
    assert.equal(result.code,0,result.stderr);
    assert.equal(result.timedOut,false);
    assert.match(result.stdout,/coverage smoke/);
    assert.match(result.stdout,/all files/i);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('release command matrix does not deadlock when a command leaves an inherited descendant handle', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'forgeos-release-matrix-contract-'));
  try{
    const helper=path.join(root,'helper.mjs');
    const releaseUrl=new URL('../scripts/release-verify.mjs',import.meta.url).href;
    const grandchildScript='setTimeout(()=>{},60000)';
    const parentScript=`const {spawn}=require('node:child_process');spawn(process.execPath,['-e',${JSON.stringify(grandchildScript)}],{stdio:'inherit'}).unref();`;
    await writeFile(helper,`import {runCommandMatrix} from ${JSON.stringify(releaseUrl)};
const command=${JSON.stringify(process.execPath)}+' -e '+${JSON.stringify(JSON.stringify(parentScript))};
const results=await runCommandMatrix([command],{commandTimeoutMs:2000});
console.log(JSON.stringify(results.map(({rawOutput,...item})=>item)));
`);
    const result=await runAcceptanceCommand(process.execPath,[helper],root,{}, {timeoutMs:4_000});
    assert.equal(result.code,0,result.stderr);
    assert.equal(result.timedOut,false);
    assert.match(result.stdout,/"exitCode":0/);
  }finally{await rm(root,{recursive:true,force:true});}
});


test('release command matrix reaps a successful command descendant before returning', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'forgeos-release-reap-contract-'));
  try{
    const helper=path.join(root,'helper.mjs');
    const pidFile=path.join(root,'grandchild.pid');
    const releaseUrl=new URL('../scripts/release-verify.mjs',import.meta.url).href;
    const grandchildScript='setTimeout(()=>{},60000)';
    const parentScript=`const {spawn}=require('node:child_process');const {writeFileSync}=require('node:fs');const child=spawn(process.execPath,['-e',${JSON.stringify(grandchildScript)}],{stdio:'ignore'});writeFileSync(${JSON.stringify(pidFile)},String(child.pid));child.unref();`;
    await writeFile(helper,`import {runCommandMatrix} from ${JSON.stringify(releaseUrl)};\nconst command=${JSON.stringify(process.execPath)}+' -e '+${JSON.stringify(JSON.stringify(parentScript))};\nawait runCommandMatrix([command],{commandTimeoutMs:2000});\n`);
    const result=await runAcceptanceCommand(process.execPath,[helper],root,{}, {timeoutMs:4_000});
    assert.equal(result.code,0,result.stderr);
    const pid=Number(await readFile(pidFile,'utf8'));
    let alive=true;
    for(let attempt=0;attempt<40;attempt++){
      try{process.kill(pid,0);}catch{alive=false;break;}
      await new Promise((resolve)=>setTimeout(resolve,25));
    }
    if(alive){try{process.kill(pid,'SIGKILL');}catch{}}
    assert.equal(alive,false,`grandchild process ${pid} survived successful command cleanup`);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('critical mutation harness isolates descendant-leak mutant to the cleanup-aware regression', async () => {
  const source = await readFile(new URL('../scripts/critical-mutation-check.mjs', import.meta.url), 'utf8');
  assert.match(source, /archive-success-descendant-leak[\s\S]*testNamePattern:\s*'release command matrix reaps a successful command descendant before returning'/);
  assert.match(source, /--test-name-pattern/);
});
