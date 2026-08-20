import path from 'node:path';
import { readFile as nodeReadFile, realpath as nodeRealpath, stat as nodeStat } from 'node:fs/promises';

const noTrust = () => Object.freeze({ withinWorkspace: false, inManagedWorktree: false, inSandbox: false });

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function gitDirectoryPointer(content) {
  const match = /^gitdir:\s*(.+?)\s*$/im.exec(String(content));
  return match?.[1] ?? null;
}

async function canonical(realpath, value) {
  try { return await realpath(path.resolve(value)); } catch { return null; }
}

export function createTaskEnvironmentAttester({ projectResolver, taskResolver, worktreesRoot, realpath = nodeRealpath, stat = nodeStat, readFile = nodeReadFile } = {}) {
  if (typeof projectResolver !== 'function' || typeof taskResolver !== 'function' || !worktreesRoot) {
    throw new TypeError('projectResolver, taskResolver, and worktreesRoot are required');
  }
  if (typeof realpath !== 'function' || typeof stat !== 'function' || typeof readFile !== 'function') throw new TypeError('filesystem attestation functions are required');
  const managedRoot = path.resolve(worktreesRoot);

  return async ({ taskId, projectId } = {}) => {
    const task = taskResolver(String(taskId ?? ''));
    const project = projectResolver(String(projectId ?? ''));
    if (!task || !project || task.projectId !== project.id || !project.workspaceRoot) return noTrust();
    const projectRoot = await canonical(realpath, project.workspaceRoot);
    const workspaceRoot = await canonical(realpath, task.metadata?.executionWorkspace ?? project.workspaceRoot);
    if (!projectRoot || !workspaceRoot) return noTrust();
    if (workspaceRoot === projectRoot) return Object.freeze({ withinWorkspace: true, inManagedWorktree: false, inSandbox: false });

    const declaredWorktree = await canonical(realpath, task.metadata?.worktree?.path);
    const projectManagedRoot = path.join(managedRoot, project.id);
    if (!declaredWorktree || declaredWorktree !== workspaceRoot || !isWithin(projectManagedRoot, workspaceRoot)) return noTrust();

    try {
      const gitFile = path.join(workspaceRoot, '.git');
      if (!(await stat(gitFile)).isFile()) return noTrust();
      const pointer = gitDirectoryPointer(await readFile(gitFile, 'utf8'));
      if (!pointer) return noTrust();
      const gitDirectory = await canonical(realpath, path.resolve(workspaceRoot, pointer));
      const projectGitDirectory = await canonical(realpath, path.join(projectRoot, '.git'));
      if (!gitDirectory || !projectGitDirectory || !isWithin(path.join(projectGitDirectory, 'worktrees'), gitDirectory)) return noTrust();
    } catch {
      return noTrust();
    }

    return Object.freeze({ withinWorkspace: true, inManagedWorktree: true, inSandbox: false });
  };
}
