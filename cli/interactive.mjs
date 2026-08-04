import { createInterface } from 'node:readline';

const HELP = `Commands:
  health
  projects
  runs <projectId> [limit]
  run <projectId> <objective>
  get <runId>
  pause|resume|stop|retry <runId>
  review|logs <runId>
  message <runId> <content>
  help
  exit`;

function words(line) {
  const result = [];
  let current = '';
  let quote = null;
  let escaped = false;
  for (const character of String(line)) {
    if (escaped) { current += character; escaped = false; continue; }
    if (character === '\\') { escaped = true; continue; }
    if (quote) { if (character === quote) quote = null; else current += character; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (/\s/.test(character)) { if (current) { result.push(current); current = ''; } continue; }
    current += character;
  }
  if (quote) throw new Error('Unclosed quote');
  if (escaped) current += '\\';
  if (current) result.push(current);
  return result;
}

function required(value, usage) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(usage);
  return result;
}

function write(output, value) {
  output.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}

async function execute(client, tokens) {
  const [command, id, ...rest] = tokens;
  if (!command) return null;
  if (command === 'help' || command === '?') return HELP;
  if (command === 'health') return client.health();
  if (command === 'projects') return client.listProjects();
  if (command === 'runs') return client.listRuns(required(id, 'runs requires <projectId>'), { limit: rest[0] === undefined ? 30 : Number(rest[0]) });
  if (command === 'run') return client.createRun({ projectId: required(id, 'run requires <projectId> <objective>'), objective: required(rest.join(' '), 'run requires <projectId> <objective>'), autonomyProfile: 'guided' });
  if (command === 'get') return client.getRun(required(id, 'get requires <runId>'));
  if (['pause', 'resume', 'stop', 'retry'].includes(command)) return client.controlRun(required(id, `${command} requires <runId>`), command);
  if (command === 'review') return client.reviewRun(required(id, 'review requires <runId>'));
  if (command === 'logs') return client.listActivities(required(id, 'logs requires <runId>'));
  if (command === 'message') return client.sendMessage(required(id, 'message requires <runId> <content>'), required(rest.join(' '), 'message requires <runId> <content>'));
  throw new Error(`Unknown command: ${command}`);
}

export async function runInteractiveCli({ client, input = process.stdin, output = process.stdout, prompt = 'forge> ' } = {}) {
  if (!client) throw new TypeError('client is required');
  const terminal = Boolean(input.isTTY && output.isTTY);
  const rl = createInterface({ input, output, terminal, historySize: 100, removeHistoryDuplicates: true });
  let reason = 'eof';
  if (prompt) output.write(prompt);
  try {
    for await (const line of rl) {
      let tokens;
      try { tokens = words(line); }
      catch (error) { write(output, { error: String(error.message ?? error) }); if (prompt) output.write(prompt); continue; }
      if (!tokens.length) { if (prompt) output.write(prompt); continue; }
      if (['exit', 'quit'].includes(tokens[0])) { reason = 'exit'; break; }
      try { const result = await execute(client, tokens); if (result !== null) write(output, result); }
      catch (error) { write(output, { error: String(error?.message ?? error).slice(0, 500) }); }
      if (prompt) output.write(prompt);
    }
  } finally { rl.close(); }
  return Object.freeze({ reason });
}

export { HELP as INTERACTIVE_HELP };
