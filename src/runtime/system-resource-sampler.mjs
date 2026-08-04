import os from 'node:os';

function finite(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; }

export class SystemResourceSampler {
  constructor({ osModule = os, memoryUsage = () => process.memoryUsage(), clock = () => Date.now() } = {}) {
    this.os = osModule;
    this.memoryUsage = memoryUsage;
    this.clock = clock;
  }

  sample(extra = {}) {
    const systemTotalBytes = finite(this.os.totalmem?.());
    const systemAvailableBytes = finite(this.os.freemem?.());
    const processMemory = this.memoryUsage?.() ?? {};
    return Object.freeze({
      sampledAtMs: finite(this.clock()),
      rssBytes: finite(processMemory.rss),
      heapUsedBytes: finite(processMemory.heapUsed),
      externalBytes: finite(processMemory.external),
      systemTotalBytes,
      systemAvailableBytes,
      systemAvailableRatio: systemTotalBytes > 0 ? systemAvailableBytes / systemTotalBytes : 0,
      loadAverage1m: finite(this.os.loadavg?.()?.[0]),
      ...extra,
    });
  }
}
