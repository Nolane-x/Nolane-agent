function boundedTasks(value) {
  const number = value === undefined ? 32 : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 128) throw new TypeError('maxTasks must be an integer between 1 and 128');
  return number;
}

function assertActive(signal) {
  if (signal?.aborted) throw new Error('Autopilot cancelled');
}

export class MissionAutopilot {
  constructor({ store, missionRunner, verificationRunner, selfFixFactory = null } = {}) {
    if (!store?.getMission || !missionRunner?.runNext || !missionRunner?.verify || !verificationRunner?.runTask) {
      throw new TypeError('MissionAutopilot store, missionRunner, and verificationRunner are required');
    }
    this.store = store;
    this.missionRunner = missionRunner;
    this.verificationRunner = verificationRunner;
    this.selfFixFactory = typeof selfFixFactory === 'function' ? selfFixFactory : null;
  }

  async run({ missionId, providerId = 'auto', workerId = 'autopilot', maxTasks, signal = null, budgets = undefined } = {}) {
    const limit = boundedTasks(maxTasks);
    let completedTasks = 0;
    const reports = [];
    while (completedTasks < limit) {
      assertActive(signal);
      const mission = this.store.getMission(String(missionId ?? ''));
      if (!mission) throw new Error(`Unknown mission: ${missionId}`);
      if (mission.status === 'completed') return Object.freeze({ missionId: mission.id, status: 'completed', completedTasks, reports: Object.freeze(reports) });
      if (mission.status !== 'running') throw new Error(`Mission is ${mission.status}`);

      const execution = await this.missionRunner.runNext({ missionId: mission.id, workerId, providerId, signal, budgets });
      if (!execution) throw new Error('Autopilot made no progress: no ready task is available');
      assertActive(signal);
      let report = await this.verificationRunner.runTask(execution.task.id, { signal });
      let selfFix = null;
      if (report.status !== 'pass' && this.selfFixFactory) {
        const failedTest = report.evidence?.find((item) => item.status !== 'pass' && String(item.kind ?? '').startsWith('test-')) ?? null;
        if (failedTest) {
          const controller = await this.selfFixFactory({ task: execution.task, report, failedTest, execution, providerId, workerId, signal, budgets });
          if (controller?.run) {
            const scope = String(failedTest.kind).slice('test-'.length);
            const relatedTest = execution.task.metadata?.testMatrix?.relatedTests?.[0] ?? null;
            const test = { scope };
            if (scope === 'file' && relatedTest) test.path = relatedTest;
            if (scope === 'module' && relatedTest) test.path = relatedTest.split('/').slice(0, -1).join('/') || 'tests';
            selfFix = await controller.run({ test, baselineOutput: String(execution.task.metadata?.testBaseline?.output ?? ''), signal });
            if (selfFix.status === 'pass') report = await this.verificationRunner.runTask(execution.task.id, { signal });
          }
        }
      }
      reports.push(Object.freeze({ taskId: execution.task.id, status: report.status, evidenceCount: report.evidence?.length ?? 0, ...(selfFix ? { selfFix } : {}) }));
      if (report.status !== 'pass') {
        if (typeof this.missionRunner.rejectVerification === 'function') {
          await this.missionRunner.rejectVerification({
            taskId: execution.task.id,
            workerId: execution.task.leaseOwner ?? workerId,
            fencingToken: execution.task.fencingToken ?? execution.lease?.fencingToken,
            report,
          });
        }
        const failed = report.evidence?.find((item) => item.status !== 'pass');
        const detail = String(failed?.summary ?? `Verification failed for task ${execution.task.id}`).trim();
        throw Object.assign(new Error(detail), { code: 'VERIFICATION_FAILED', taskId: execution.task.id, report, selfFix });
      }
      await this.missionRunner.verify({
        taskId: execution.task.id,
        workerId: execution.task.leaseOwner ?? workerId,
        fencingToken: execution.task.fencingToken ?? execution.lease?.fencingToken,
        evidence: report.evidence,
      });
      completedTasks += 1;
    }
    const mission = this.store.getMission(String(missionId ?? ''));
    if (mission?.status === 'completed') return Object.freeze({ missionId: mission.id, status: 'completed', completedTasks, reports: Object.freeze(reports) });
    throw new Error(`Autopilot reached maxTasks=${limit} before mission completion`);
  }
}
