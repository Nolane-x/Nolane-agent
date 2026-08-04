import path from 'node:path';

const HIGH_RISK_PATTERNS = [
  /\bpush\b.*--force/i,
  /\breset\b.*--hard/i,
  /\bclean\b.*-f/i,
  /\brm\b.*\b-rf\b/i,
  /\b(?:curl|wget|ssh|scp|nc|netcat)\b/i,
  /\b(?:npm|pnpm|yarn)\b.*\bpublish\b/i
];

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function createGovernedShellTool({ workspaceRoot, executor }) {
  if (!workspaceRoot || typeof executor !== 'function') throw new TypeError('workspaceRoot and executor are required');
  const root = path.resolve(workspaceRoot);
  return {
    async execute({ command, cwd = root } = {}, { capabilities = [], approvals = [] } = {}) {
      if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string')) {
        throw new TypeError('command must be a non-empty string array');
      }
      if (!capabilities.includes('shell:execute')) throw new Error('missing capability: shell:execute');
      const resolvedCwd = path.resolve(cwd);
      if (!within(root, resolvedCwd)) throw new Error('command cwd is outside workspace');
      const rendered = command.join(' ');
      const highRisk = HIGH_RISK_PATTERNS.some((pattern) => pattern.test(rendered));
      if (highRisk && !approvals.some((approval) => approval === 'shell:high-risk' || approval === rendered)) {
        throw new Error(`approval required for high-risk command: ${rendered}`);
      }
      const [file, ...args] = command;
      return executor(file, args, { cwd: resolvedCwd, shell: false, windowsHide: true });
    }
  };
}
