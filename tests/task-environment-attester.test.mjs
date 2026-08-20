import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { createTaskEnvironmentAttester } from '../src/security/task-environment-attester.mjs';

function fixture({ task = null, gitFile = 'gitdir: ../../../../projects/nolane/.git/worktrees/task-1\n' } = {}) {
  const projectRoot = path.resolve('/projects/nolane');
  const worktreesRoot = path.resolve('/data/worktrees');
  const workspaceRoot = path.join(worktreesRoot, 'project-1', 'task-1');
  const project = { id: 'project-1', workspaceRoot: projectRoot };
  const activeTask = task ?? { id: 'task-1', projectId: project.id, metadata: { executionWorkspace: workspaceRoot, worktree: { path: workspaceRoot } } };
  const paths = new Map([
    [projectRoot, projectRoot],
    [workspaceRoot, workspaceRoot],
    [path.join(workspaceRoot, '.git'), path.join(workspaceRoot, '.git')],
    [path.join(projectRoot, '.git'), path.join(projectRoot, '.git')],
    [path.join(projectRoot, '.git', 'worktrees', 'task-1'), path.join(projectRoot, '.git', 'worktrees', 'task-1')],
  ]);
  const attester = createTaskEnvironmentAttester({
    projectResolver: (id) => id === project.id ? project : null,
    taskResolver: (id) => id === activeTask.id ? activeTask : null,
    worktreesRoot,
    realpath: async (value) => {
      const resolved = paths.get(path.resolve(value));
      if (!resolved) throw new Error('ENOENT');
      return resolved;
    },
    stat: async (value) => ({ isFile: () => path.resolve(value) === path.join(workspaceRoot, '.git') }),
    readFile: async () => gitFile,
  });
  return { attester, activeTask, project, projectRoot, workspaceRoot };
}

test('attester accepts only a live linked worktree rooted in the task manager directory', async () => {
  const f = fixture();
  assert.deepEqual(await f.attester({ taskId: f.activeTask.id, projectId: f.project.id }), {
    withinWorkspace: true,
    inManagedWorktree: true,
    inSandbox: false,
  });
});

test('attester rejects task metadata that names a root outside the managed worktree directory', async () => {
  const f = fixture({ task: { id: 'task-1', projectId: 'project-1', metadata: { executionWorkspace: '/tmp/not-managed', worktree: { path: '/tmp/not-managed' } } } });
  assert.deepEqual(await f.attester({ taskId: f.activeTask.id, projectId: f.project.id }), {
    withinWorkspace: false,
    inManagedWorktree: false,
    inSandbox: false,
  });
});

test('attester rejects a worktree whose Git admin directory is not owned by the project repository', async () => {
  const f = fixture({ gitFile: 'gitdir: /other-repository/.git/worktrees/task-1\n' });
  assert.deepEqual(await f.attester({ taskId: f.activeTask.id, projectId: f.project.id }), {
    withinWorkspace: false,
    inManagedWorktree: false,
    inSandbox: false,
  });
});
