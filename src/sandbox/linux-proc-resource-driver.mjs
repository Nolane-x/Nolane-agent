import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function positivePid(value) {
  const pid = Number(value);
  if (!Number.isInteger(pid) || pid <= 0) throw new TypeError('pid must be a positive integer');
  return pid;
}

function parseStat(text) {
  const source = String(text ?? '').trim();
  const close = source.lastIndexOf(') ');
  if (close < 0) throw new Error('Invalid /proc stat record');
  const pid = Number(source.slice(0, source.indexOf(' ')));
  const fields = source.slice(close + 2).split(/\s+/);
  if (fields.length < 22) throw new Error('Incomplete /proc stat record');
  return {
    pid, state: fields[0],
    ppid: Number(fields[1]),
    cpuTicks: Number(fields[11]) + Number(fields[12]),
    startTimeTicks: Number(fields[19]),
    rssPages: Number(fields[21]),
  };
}

export class LinuxProcResourceDriver {
  constructor({ procRoot = '/proc', clockTicks = 100, pageSize = 4096, kill = process.kill.bind(process) } = {}) {
    this.procRoot = path.resolve(procRoot);
    this.clockTicks = Math.max(1, Number(clockTicks) || 100);
    this.pageSize = Math.max(1, Number(pageSize) || 4096);
    this.kill = kill;
  }

  async #records() {
    const entries = await readdir(this.procRoot, { withFileTypes: true });
    const records = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
      try { records.push(parseStat(await readFile(path.join(this.procRoot, entry.name, 'stat'), 'utf8'))); }
      catch (error) { if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error?.code)) throw error; }
    }
    return records;
  }

  async sampleTree(rootPid) {
    const pid = positivePid(rootPid);
    const records = await this.#records();
    const byPid = new Map(records.map((record) => [record.pid, record]));
    if (!byPid.has(pid)) throw Object.assign(new Error(`Process ${pid} is unavailable`), { code: 'SANDBOX_PROCESS_NOT_FOUND' });
    const children = new Map();
    for (const record of records) {
      const list = children.get(record.ppid) ?? [];
      list.push(record.pid);
      children.set(record.ppid, list);
    }
    const pids = [];
    const queue = [pid];
    const seen = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current) || !byPid.has(current)) continue;
      seen.add(current);
      pids.push(current);
      for (const child of (children.get(current) ?? []).sort((a, b) => a - b)) queue.push(child);
    }
    pids.sort((a, b) => a - b);
    let cpuTicks = 0;
    let rssPages = 0;
    for (const current of pids) {
      const record = byPid.get(current);
      cpuTicks += Number(record.cpuTicks) || 0;
      rssPages += Math.max(0, Number(record.rssPages) || 0);
    }
    return Object.freeze({
      cpuTimeMs: (cpuTicks * 1000) / this.clockTicks,
      rssBytes: rssPages * this.pageSize,
      processCount: pids.length,
      pids: Object.freeze(pids),
      rootIdentity: Object.freeze({ pid, startTimeTicks: Number(byPid.get(pid).startTimeTicks) || 0 }),
    });
  }

  async sampleFileDescriptors(rootPid) {
    const tree = await this.sampleTree(rootPid);
    let total = 0;
    for (const pid of tree.pids) {
      try { total += (await readdir(path.join(this.procRoot, String(pid), 'fd'))).length; }
      catch (error) { if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error?.code)) throw error; }
    }
    return total;
  }

  async killTree(rootPid, { signal = 'SIGTERM', expectedRootIdentity = null, allowedPids = null } = {}) {
    let sample;
    try { sample = await this.sampleTree(rootPid); }
    catch (error) { if (error?.code === 'SANDBOX_PROCESS_NOT_FOUND') return Object.freeze({ terminated: Object.freeze([]), signal }); throw error; }
    if (expectedRootIdentity && (Number(expectedRootIdentity.pid) !== sample.rootIdentity.pid || Number(expectedRootIdentity.startTimeTicks) !== sample.rootIdentity.startTimeTicks)) throw Object.assign(new Error('Process root identity mismatch'), { code: 'PROCESS_IDENTITY_MISMATCH' });
    const allowed = allowedPids == null ? null : new Set(allowedPids.map(Number));
    if (allowed) {
      const outside = sample.pids.filter((pid) => !allowed.has(pid));
      if (outside.length) throw Object.assign(new Error(`Process tree contains PIDs outside the registered set: ${outside.join(',')}`), { code: 'PROCESS_TREE_OUTSIDE_REGISTERED', outsidePids: outside });
    }
    const terminated = [];
    for (const currentPid of [...sample.pids].reverse()) {
      try { this.kill(currentPid, signal); terminated.push(currentPid); }
      catch (error) { if (!['ESRCH', 'EPERM'].includes(error?.code)) throw error; }
    }
    return Object.freeze({ terminated: Object.freeze(terminated), signal, rootIdentity: sample.rootIdentity });
  }

  async terminateTree(rootPid, options = {}) { return this.killTree(rootPid, options); }

  async isTreeAlive(rootPid) {
    try {
      const pid = positivePid(rootPid);
      const records = await this.#records();
      const root = records.find((record) => record.pid === pid);
      return Boolean(root && root.state !== 'Z');
    } catch (error) {
      if (['SANDBOX_PROCESS_NOT_FOUND', 'ENOENT', 'ESRCH'].includes(error?.code)) return false;
      throw error;
    }
  }
}
