export class CodebaseKnowledgeWatcher {
  constructor({ service, scheduler = null, intervalMs = 1_500, debounceMs = 250, onIndexed = () => {} } = {}) {
    if (!service?.signature || !service?.index) throw new TypeError('CodebaseKnowledgeWatcher requires a graph service');
    this.service = service; this.scheduler = scheduler; this.intervalMs = Math.max(25, Number(intervalMs) || 1_500); this.debounceMs = Math.max(0, Number(debounceMs) || 250); this.onIndexed = onIndexed; this.watchers = new Map();
  }
  async start(project) {
    if (!project?.id) throw new TypeError('project is required');
    await this.stop(project.id);
    const record = { project, state: 'watching', signature: await this.service.signature(project), timer: null, debounce: null, indexing: false, pendingTick: null, pendingIndex: null, lastIndexedAt: null, lastError: null };
    const tick = () => {
      if (record.state !== 'watching' || record.indexing || record.pendingTick) return;
      record.pendingTick = (async () => {
        try {
          const signature = await this.service.signature(project);
          if (record.state !== 'watching' || signature === record.signature) return;
          record.signature = signature; clearTimeout(record.debounce);
          record.debounce = setTimeout(() => {
            if (record.state !== 'watching') return;
            record.indexing = true;
            record.pendingIndex = (async () => {
              try {
                const result = this.scheduler ? await this.scheduler.enqueue({ project, generation: record.signature, priority: 'watcher', stages: ['lexical', 'semantic', 'graph'], reason: 'portable-repository-watcher' }) : await this.service.index(project, { includeGitHistory: false });
                if (record.state !== 'watching') return;
                record.lastIndexedAt = new Date().toISOString(); record.lastError = null;
                await this.onIndexed(Object.freeze({ projectId: project.id, ...result }));
              } catch (error) { record.lastError = String(error?.message ?? error); }
              finally { record.indexing = false; record.pendingIndex = null; }
            })();
          }, this.debounceMs);
        } catch (error) { record.lastError = String(error?.message ?? error); }
        finally { record.pendingTick = null; }
      })();
    };
    record.timer = setInterval(tick, this.intervalMs); record.timer.unref?.(); this.watchers.set(project.id, record);
    return this.status(project.id);
  }
  status(projectId) { const record = this.watchers.get(String(projectId)); return Object.freeze(record ? { schema: 'forge.codebase-watcher.v1', projectId: String(projectId), state: record.state, mode: 'portable-polling', intervalMs: this.intervalMs, debounceMs: this.debounceMs, indexing: record.indexing, lastIndexedAt: record.lastIndexedAt, lastError: record.lastError } : { schema: 'forge.codebase-watcher.v1', projectId: String(projectId), state: 'stopped', mode: 'portable-polling', intervalMs: this.intervalMs, debounceMs: this.debounceMs, indexing: false, lastIndexedAt: null, lastError: null }); }
  async stop(projectId) { const key = String(projectId); const record = this.watchers.get(key); if (!record) return this.status(key); record.state = 'stopped'; clearInterval(record.timer); clearTimeout(record.debounce); await record.pendingTick; await record.pendingIndex; this.watchers.delete(key); return this.status(key); }
  async close() { await Promise.all([...this.watchers.keys()].map((key) => this.stop(key))); }
}
