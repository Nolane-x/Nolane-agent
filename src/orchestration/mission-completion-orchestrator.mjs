import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const HASH64 = /^[a-f0-9]{64}$/i;

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function phaseTask({ id, title, objective, role, dependencies = [], allowedPaths = ['**'], phase, metadata = {} }) {
  return Object.freeze({
    id, title, objective, role,
    dependencies: Object.freeze([...dependencies]),
    allowedPaths: Object.freeze([...allowedPaths]),
    deniedPaths: Object.freeze(['.env', '.env.*', '**/*.pem', '**/*.key', '**/.git/**']),
    metadata: Object.freeze({
      ...metadata,
      completionPhase: phase,
      taskKind: phase,
      testMatrix: ['builder', 'integrator'].includes(role) ? { changedPaths: [...allowedPaths], relatedTests: [], requireFull: true } : undefined,
      selfFix: ['builder', 'integrator'].includes(role) ? { enabled: true, maxAttempts: 3, maxStagnantAttempts: 1 } : undefined,
    }),
  });
}

export class MissionCompletionOrchestrator {
  constructor({ missionRunner, gitGovernance = null, capabilityChecker = async () => false } = {}) {
    if (!missionRunner?.plan) throw new TypeError('missionRunner.plan is required');
    this.missionRunner = missionRunner;
    this.gitGovernance = gitGovernance;
    this.capabilityChecker = capabilityChecker;
  }

  async prepare({ missionId = null, projectId, principalId, objective, allowCommit = false } = {}) {
    const project = required(projectId, 'projectId');
    const principal = required(principalId, 'principalId');
    const goal = required(objective, 'objective');
    const commitAllowed = allowCommit === true && await this.capabilityChecker({ capability: 'git.commit', projectId: project, principalId: principal });

    const tasks = [
      phaseTask({ id: 'architecture', title: 'Explain project architecture', objective: `Explain the project architecture and identify the safest completion path for: ${goal}`, role: 'scout', phase: 'architecture' }),
      phaseTask({ id: 'repair-tests', title: 'Repair failing tests', objective: `Reproduce and repair failing tests for: ${goal}. Run the smallest relevant tests before the full required suite.`, role: 'builder', dependencies: ['architecture'], allowedPaths: ['src/**', 'tests/**', 'package.json', 'package-lock.json'], phase: 'repair-tests' }),
      phaseTask({ id: 'repair-dependencies', title: 'Repair dependency faults', objective: `Inspect and repair dependency or package resolution faults for: ${goal}. Preserve lockfile integrity.`, role: 'builder', dependencies: ['architecture'], allowedPaths: ['src/**', 'tests/**', 'package.json', 'package-lock.json', 'vendor/**'], phase: 'repair-dependencies' }),
      phaseTask({ id: 'resolve-conflicts', title: 'Resolve Git conflicts', objective: `Resolve only evidenced Git conflicts after both repair branches complete. Preserve user changes and record test evidence.`, role: 'integrator', dependencies: ['repair-tests', 'repair-dependencies'], allowedPaths: ['**'], phase: 'resolve-conflicts' }),
      phaseTask({ id: 'security-review', title: 'Run security review', objective: `Review the completed changes for secret exposure, unsafe commands, path escape, dependency risk, and permission escalation.`, role: 'reviewer', dependencies: ['repair-tests', 'repair-dependencies', 'resolve-conflicts'], phase: 'security-review' }),
      phaseTask({ id: 'update-docs', title: 'Update documentation', objective: `Update only documentation made stale by the verified implementation for: ${goal}.`, role: 'builder', dependencies: ['security-review'], allowedPaths: ['README.md', 'docs/**', 'RELEASE-*.md', 'LIMITATIONS-*.md'], phase: 'update-docs' }),
      phaseTask({ id: 'local-pr-review', title: 'Review local pull request bundle', objective: `Perform an independent local diff review, verify test receipts and residual risks, and block integration if evidence is incomplete.`, role: 'reviewer', dependencies: ['update-docs'], phase: 'local-pr-review' }),
    ];
    if (commitAllowed) tasks.push(phaseTask({ id: 'commit', title: 'Create governed commit', objective: 'Create a selective, secret-safe commit only after local review and passing test receipts.', role: 'integrator', dependencies: ['local-pr-review'], allowedPaths: ['**'], phase: 'commit' }));

    const mission = await this.missionRunner.plan({
      missionId, projectId: project, objective: goal,
      planner: async () => ({ summary: 'Complete the mission through architecture, parallel repair, conflict resolution, security review, documentation, local review, and optional governed commit.', tasks }),
    });
    const created = mission.tasks ?? tasks;
    const byPhase = new Map(created.map((task) => [task.metadata?.completionPhase, task]));
    const parallelGroups = Object.freeze([[byPhase.get('repair-tests')?.id, byPhase.get('repair-dependencies')?.id].filter(Boolean)]);
    const base = Object.freeze({
      schema: 'forge.mission-completion-workflow.v1',
      projectId: project,
      principalId: principal,
      missionId: mission.id,
      objective: goal,
      tasks: Object.freeze(created),
      parallelGroups,
      commit: Object.freeze({ status: commitAllowed ? 'planned' : 'skipped', reason: commitAllowed ? null : 'git.commit capability not granted' }),
      remotePullRequestCreated: false,
    });
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async reviewLocalPullRequest({ missionId, principal, targetRef = 'HEAD' } = {}) {
    if (!this.gitGovernance?.collisionMap) throw new Error('Git governance collisionMap is not configured');
    return this.gitGovernance.collisionMap({ missionId: required(missionId, 'missionId'), principal, targetRef, idempotencyKey: `local-review:${missionId}:${targetRef}` });
  }

  async resolveConflict(input = {}) {
    if (!this.gitGovernance?.recordConflictResolution) throw new Error('Git governance conflict resolution is not configured');
    return this.gitGovernance.recordConflictResolution(input);
  }

  async commitIfAllowed(input = {}) {
    if (!this.gitGovernance?.commit) throw new Error('Git governance commit is not configured');
    const principalId = required(input.principal?.subject, 'principal.subject');
    const allowed = await this.capabilityChecker({ capability: 'git.commit', taskId: input.taskId, principalId });
    if (!allowed) throw Object.assign(new Error('git.commit capability is required'), { code: 'MISSION_COMMIT_NOT_ALLOWED', statusCode: 403 });
    const result = await this.gitGovernance.commit(input);
    if (!HASH64.test(String(result?.receiptSha256 ?? ''))) throw new Error('Git governance commit did not return a valid receipt');
    return result;
  }
}
