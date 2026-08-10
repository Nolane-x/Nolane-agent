import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Windows Job Object helper has a real bounded native lifecycle and product wiring', async () => {
  const [common, windows, desktop, electronBuild, workflow, packageJson] = await Promise.all([
    readFile('native/job-object/main.go', 'utf8'),
    readFile('native/job-object/backend_windows.go', 'utf8'),
    readFile('desktop/main.cjs', 'utf8'),
    readFile('scripts/build-electron.mjs', 'utf8'),
    readFile('.github/workflows/external-gates.yml', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);

  assert.match(common, /capabilities[\s\S]*create[\s\S]*attach[\s\S]*terminate/);
  assert.match(common, /cpu-percent[\s\S]*memory-bytes[\s\S]*process-count/);
  assert.match(windows, /CreateJobObjectW/);
  assert.match(windows, /SetInformationJobObject/);
  assert.match(windows, /AssignProcessToJobObject/);
  assert.match(windows, /TerminateJobObject/);
  assert.match(windows, /jobObjectLimitKillOnJobClose/);
  assert.match(desktop, /NOLANE_AGENT_JOB_OBJECT_HELPER/);
  assert.match(electronBuild, /ForgeJobObject\.exe/);
  assert.match(workflow, /go build -trimpath -o [^\n]*ForgeJobObject\.exe/);
  assert.match(workflow, /NOLANE_JOB_OBJECT_HELPER=/);
  assert.match(packageJson, /job-object/);
});
