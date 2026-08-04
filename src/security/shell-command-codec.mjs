import path from 'node:path';

const SHELL_KINDS = new Set(['bash', 'powershell', 'cmd', 'wsl']);
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const WSL_DISTRO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function text(value, label, maxBytes, { allowEmpty = false } = {}) {
  const result = String(value ?? '');
  if (!allowEmpty && !result) throw new TypeError(`${label} is required`);
  if (result.includes('\0')) throw new TypeError(`${label} contains a NUL byte`);
  if (/[\r\n]/.test(result)) throw new TypeError(`${label} contains a newline`);
  if (Buffer.byteLength(result) > maxBytes) throw new TypeError(`${label} exceeds ${maxBytes} bytes`);
  return result;
}

function quoteBash(value) {
  const input = String(value);
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(input)) return input;
  return `'${input.replaceAll("'", `'\\''`)}'`;
}

function quotePowerShell(value) {
  const input = String(value);
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(input)) return input;
  return `'${input.replaceAll("'", "''")}'`;
}

function quoteCmd(value) {
  const input = String(value);
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(input)) return input;
  const escaped = input.replace(/([&|<>^])/g, '^$1').replaceAll('"', '\\"');
  return `"${escaped}"`;
}

export class ShellCommandCodec {
  constructor({ platform = process.platform, maxArgs = 128, maxArgBytes = 8_192, maxTotalBytes = 65_536 } = {}) {
    this.platform = String(platform);
    this.maxArgs = Number(maxArgs);
    this.maxArgBytes = Number(maxArgBytes);
    this.maxTotalBytes = Number(maxTotalBytes);
  }

  validateArgv({ command, args = [], env = {} } = {}) {
    const safeCommand = text(command, 'command', 4_096);
    if (!Array.isArray(args) || args.length > this.maxArgs) throw new TypeError(`args must contain at most ${this.maxArgs} strings`);
    const safeArgs = args.map((value, index) => text(value, `args[${index}]`, this.maxArgBytes, { allowEmpty: true }));
    if (Buffer.byteLength(JSON.stringify([safeCommand, ...safeArgs])) > this.maxTotalBytes) throw new TypeError(`command argv exceeds ${this.maxTotalBytes} bytes`);
    if (!env || typeof env !== 'object' || Array.isArray(env)) throw new TypeError('env must be an object');
    const safeEnv = {};
    const entries = Object.entries(env);
    if (entries.length > 64) throw new TypeError('env must contain at most 64 entries');
    for (const [key, value] of entries) {
      if (!ENV_KEY.test(key)) throw new TypeError(`env key is invalid: ${key}`);
      safeEnv[key] = text(value, `env.${key}`, this.maxArgBytes, { allowEmpty: true });
    }
    return Object.freeze({ command: safeCommand, args: Object.freeze(safeArgs), env: Object.freeze(safeEnv) });
  }

  prepareInteractive({ kind, executable, args = [], distribution = null } = {}) {
    const normalizedKind = String(kind ?? '').toLowerCase();
    if (!SHELL_KINDS.has(normalizedKind)) throw new TypeError(`Unsupported shell kind: ${kind}`);
    const validated = this.validateArgv({ command: executable, args });
    if (normalizedKind === 'cmd' && this.platform !== 'win32') throw new Error('CMD is only available on Windows');
    if (normalizedKind === 'wsl' && this.platform !== 'win32') throw new Error('WSL is only available on Windows');
    if (normalizedKind === 'wsl') {
      const distro = text(distribution, 'distribution', 128);
      if (!WSL_DISTRO.test(distro)) throw new TypeError('WSL distribution name is invalid');
      return Object.freeze({ kind: normalizedKind, executable: validated.command, args: Object.freeze(['--distribution', distro, '--exec', 'bash', ...validated.args]), capability: 'available' });
    }
    return Object.freeze({ kind: normalizedKind, executable: validated.command, args: validated.args, capability: 'available' });
  }

  quote(kind, value) {
    const normalized = String(kind ?? '').toLowerCase();
    if (normalized === 'bash' || normalized === 'wsl') return quoteBash(value);
    if (normalized === 'powershell') return quotePowerShell(value);
    if (normalized === 'cmd') return quoteCmd(value);
    throw new TypeError(`Unsupported shell kind: ${kind}`);
  }

  preview({ kind = 'bash', command, args = [] } = {}, { maxLength = 512 } = {}) {
    const validated = this.validateArgv({ command, args });
    const rendered = [validated.command, ...validated.args.map((value) => this.quote(kind, value))].join(' ');
    const limit = Math.max(16, Number(maxLength) || 512);
    return rendered.length <= limit ? rendered : `${rendered.slice(0, limit - 1)}…`;
  }
}
