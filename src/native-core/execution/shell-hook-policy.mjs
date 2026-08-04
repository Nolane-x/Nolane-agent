const PHASES = new Set(['before-tool', 'after-tool', 'before-provider', 'after-provider', 'on-error']);
export class ShellHookPolicy {
  constructor({ allowedCommands = [] } = {}) { this.allowedCommands = new Set(allowedCommands.map(String)); }
  authorize({ phase, command, args = [], envRefs = {}, env = null } = {}) {
    if (!PHASES.has(String(phase))) throw new Error(`Invalid hook phase: ${phase}`);
    if (!this.allowedCommands.has(String(command))) throw new Error(`Hook command is not allowlisted: ${command}`);
    if (!Array.isArray(args) || args.some((entry) => typeof entry !== 'string' || /[\r\n\0]/.test(entry))) throw new TypeError('Hook args must be safe argv strings');
    if (env && Object.keys(env).length) throw new Error('Raw environment values are forbidden; use envRefs');
    if (Object.values(envRefs ?? {}).some((entry) => !String(entry).includes(':'))) throw new Error('Hook environment must use credential references');
    return Object.freeze({ phase: String(phase), command: String(command), args: Object.freeze([...args]), envRefs: Object.freeze({ ...envRefs }) });
  }
}
