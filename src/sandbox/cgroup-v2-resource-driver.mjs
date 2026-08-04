import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

function safeId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) throw new TypeError('Invalid cgroup lease id');
  return id;
}
function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new TypeError(`${label} must be a positive integer`);
  return number;
}
async function readNumber(file) { return Number(String(await readFile(file, 'utf8')).trim()) || 0; }

export class CgroupV2ResourceDriver {
  constructor({ root = '/sys/fs/cgroup', groupName = 'forge-studio' } = {}) {
    this.root = path.resolve(root);
    this.groupName = safeId(groupName);
  }

  async available() {
    try {
      const controllers = await readFile(path.join(this.root, 'cgroup.controllers'), 'utf8');
      await access(this.root, constants.W_OK);
      return ['cpu', 'memory', 'pids'].every((name) => controllers.split(/\s+/).includes(name));
    } catch { return false; }
  }

  async createLease(id, limits) {
    const leaseId = safeId(id);
    const target = path.join(this.root, this.groupName, leaseId);
    await mkdir(target, { recursive: true });
    const period = 100_000;
    const quota = Math.max(1_000, Math.round((positiveInteger(limits.cpuPercent, 'cpuPercent') / 100) * period));
    await writeFile(path.join(target, 'cpu.max'), `${quota} ${period}\n`);
    await writeFile(path.join(target, 'memory.max'), `${positiveInteger(limits.memoryBytes, 'memoryBytes')}\n`);
    await writeFile(path.join(target, 'pids.max'), `${positiveInteger(limits.processCount, 'processCount')}\n`);
    await writeFile(path.join(target, 'memory.oom.group'), '1\n').catch(() => {});
    return Object.freeze({ id: leaseId, path: target, mode: 'cgroup-v2' });
  }

  async attach(lease, pid) {
    await writeFile(path.join(lease.path, 'cgroup.procs'), `${positiveInteger(pid, 'pid')}\n`);
  }

  async sample(lease) {
    const cpuStat = await readFile(path.join(lease.path, 'cpu.stat'), 'utf8');
    const values = Object.fromEntries(cpuStat.trim().split(/\r?\n/).map((line) => line.trim().split(/\s+/, 2)));
    return Object.freeze({
      cpuTimeMs: (Number(values.usage_usec) || 0) / 1000,
      rssBytes: await readNumber(path.join(lease.path, 'memory.current')),
      processCount: await readNumber(path.join(lease.path, 'pids.current')),
      pids: Object.freeze([]),
    });
  }

  async remove(lease) {
    await writeFile(path.join(lease.path, 'cgroup.kill'), '1\n').catch(() => {});
    await rm(lease.path, { recursive: true, force: true });
  }
}
