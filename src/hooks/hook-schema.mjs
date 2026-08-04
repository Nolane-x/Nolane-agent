import path from 'node:path';

export const HOOK_EVENTS = Object.freeze([
  'SessionStart', 'SessionEnd', 'BeforeAgent', 'AfterAgent', 'BeforeModel', 'AfterModel',
  'BeforeToolSelection', 'BeforeTool', 'AfterTool', 'PreCheckpoint', 'PostCheckpoint',
  'PreCompress', 'Notification',
]);

const EVENT_SET = new Set(HOOK_EVENTS);
const FAILURE_MODES = new Set(['open', 'closed']);

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function assertSafeHookPath(projectRoot, value) {
  const resolved = path.resolve(projectRoot, value);
  const relative = path.relative(path.resolve(projectRoot), resolved);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return resolved;
  fail('HOOK_PATH_OUTSIDE_PROJECT', `Hook path is outside the project: ${value}`);
}

export function validateHookDefinition(input, { projectRoot } = {}) {
  if (!plainObject(input)) fail('HOOK_SCHEMA_INVALID', 'Hook definition must be an object');
  const id = String(input.id ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) fail('HOOK_ID_INVALID', `Invalid hook id: ${id || '<empty>'}`);
  const events = Array.isArray(input.events) ? [...new Set(input.events.map(String))] : [];
  if (!events.length || events.some((event) => !EVENT_SET.has(event))) fail('HOOK_EVENT_INVALID', `Hook ${id} has unsupported events`);
  const command = String(input.command ?? '').trim();
  if (!command) fail('HOOK_COMMAND_INVALID', `Hook ${id} requires a command`);
  const args = Array.isArray(input.args) ? input.args.map((value) => String(value)) : [];
  if (args.length > 32 || args.some((value) => Buffer.byteLength(value) > 8_192)) fail('HOOK_ARGUMENTS_INVALID', `Hook ${id} arguments exceed limits`);
  const timeoutMs = Number(input.timeoutMs ?? 2_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 60_000) fail('HOOK_TIMEOUT_INVALID', `Hook ${id} timeout is invalid`);
  const failureMode = String(input.failureMode ?? 'closed');
  if (!FAILURE_MODES.has(failureMode)) fail('HOOK_FAILURE_MODE_INVALID', `Hook ${id} failure mode is invalid`);
  const matcher = plainObject(input.matcher) ? input.matcher : {};
  const toolNames = Array.isArray(matcher.toolNames) ? [...new Set(matcher.toolNames.map(String))] : [];
  const profileIds = Array.isArray(matcher.profileIds) ? [...new Set(matcher.profileIds.map(String))] : [];
  const resolvedArgs = [...args];
  if (projectRoot && args[0] && (path.isAbsolute(args[0]) || args[0].startsWith('.') || args[0].includes('/') || args[0].includes('\\'))) {
    resolvedArgs[0] = assertSafeHookPath(projectRoot, args[0]);
  }
  return Object.freeze({ id, events: Object.freeze(events), command, args: Object.freeze(resolvedArgs), timeoutMs, failureMode, matcher: Object.freeze({ toolNames: Object.freeze(toolNames), profileIds: Object.freeze(profileIds) }) });
}

export function validateHookOutput(input) {
  if (!plainObject(input)) fail('HOOK_OUTPUT_SCHEMA', 'Hook output must be a JSON object');
  const allowedKeys = new Set(['decision', 'reason', 'rewrite', 'additionalContext', 'allowedTools', 'retry', 'audit']);
  for (const key of Object.keys(input)) if (!allowedKeys.has(key)) fail('HOOK_OUTPUT_SCHEMA', `Unknown hook output field: ${key}`);
  const decision = String(input.decision ?? 'allow');
  if (!['allow', 'deny'].includes(decision)) fail('HOOK_OUTPUT_SCHEMA', `Invalid decision: ${decision}`);
  const reason = input.reason === undefined ? '' : String(input.reason).slice(0, 2_000);
  if (decision === 'deny' && !reason) fail('HOOK_OUTPUT_SCHEMA', 'Denied hooks require a reason');
  const rewrite = input.rewrite === undefined ? null : input.rewrite;
  if (rewrite !== null && !plainObject(rewrite)) fail('HOOK_OUTPUT_SCHEMA', 'rewrite must be an object');
  let additionalContext = [];
  if (typeof input.additionalContext === 'string') additionalContext = [input.additionalContext];
  else if (Array.isArray(input.additionalContext)) additionalContext = input.additionalContext.map(String);
  else if (input.additionalContext !== undefined) fail('HOOK_OUTPUT_SCHEMA', 'additionalContext must be a string or array');
  additionalContext = additionalContext.slice(0, 8).map((value) => value.slice(0, 4_096));
  if (Buffer.byteLength(additionalContext.join('\n')) > 16_384) fail('HOOK_OUTPUT_SCHEMA', 'additionalContext exceeds limit');
  const allowedTools = input.allowedTools === undefined ? null : [...new Set((Array.isArray(input.allowedTools) ? input.allowedTools : []).map(String))].slice(0, 256);
  if (input.allowedTools !== undefined && !Array.isArray(input.allowedTools)) fail('HOOK_OUTPUT_SCHEMA', 'allowedTools must be an array');
  const retry = Boolean(input.retry);
  const audit = plainObject(input.audit) ? JSON.parse(JSON.stringify(input.audit)) : {};
  return Object.freeze({ decision, reason, rewrite, additionalContext: Object.freeze(additionalContext), allowedTools: allowedTools && Object.freeze(allowedTools), retry, audit: Object.freeze(audit) });
}
