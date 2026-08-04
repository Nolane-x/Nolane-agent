import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { LinuxProcResourceDriver } from '../src/sandbox/linux-proc-resource-driver.mjs';

function stat(pid, ppid, utime = 1, stime = 2, rss = 3) {
  const fields = ['S', ppid, 0, 0, 0, 0, 0, 0, 0, 0, 0, utime, stime, 0, 0, 0, 0, 0, 0, 0, 0, rss];
  return `${pid} (forge-test) ${fields.join(' ')}`;
}

test('LinuxProcResourceDriver counts file descriptors for an entire process tree', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-proc-'));
  for (const [pid, ppid, fdCount] of [[10, 1, 2], [11, 10, 3], [12, 10, 1]]) {
    const dir = path.join(root, String(pid));
    await mkdir(path.join(dir, 'fd'), { recursive: true });
    await writeFile(path.join(dir, 'stat'), stat(pid, ppid));
    for (let index = 0; index < fdCount; index += 1) await writeFile(path.join(dir, 'fd', String(index)), '');
  }
  const driver = new LinuxProcResourceDriver({ procRoot: root });
  assert.equal(await driver.sampleFileDescriptors(10), 6);
});
