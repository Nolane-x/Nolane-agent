import readline from 'node:readline';
if (process.argv.includes('--environment-probe')) {
  process.stdout.write(`${process.env.NOLANE_TEST_PARENT_SECRET ? 'secret-present' : 'secret-absent'}\n`);
  process.exit(0);
}
const rl = readline.createInterface({ input: process.stdin });
const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
let threadCounter = 0; let turnCounter = 0; let account = { type: 'chatgpt', email: 'user@example.com', planType: 'plus' };
const pendingApprovals = new Map();
rl.on('line', async (line) => {
  const message = JSON.parse(line);
  if (Object.hasOwn(message, 'id') && (Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error'))) {
    const pending = pendingApprovals.get(message.id); if (pending) { pendingApprovals.delete(message.id); pending(message); } return;
  }
  if (message.method === 'initialize') return send({ id: message.id, result: { userAgent: 'fixture', codexHome: '/tmp/codex', platformFamily: 'unix', platformOs: 'linux' } });
  if (message.method === 'initialized') return;
  if (message.method === 'account/read') return send({ id: message.id, result: { account, requiresOpenaiAuth: true } });
  if (message.method === 'test/environment') {
    const present = Object.fromEntries((message.params?.names ?? []).map((name) => [name, Object.hasOwn(process.env, name)]));
    return send({ id: message.id, result: { present } });
  }
  if (message.method === 'model/list') return send({ id: message.id, result: { data: [{ id: 'gpt-5.6-codex', displayName: 'GPT-5.6 Codex', defaultReasoningEffort: 'medium', supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'medium' }, { reasoningEffort: 'high' }], additionalSpeedTiers: ['standard', 'fast'], serviceTiers: ['default', 'flex'], defaultServiceTier: 'default', modelSpecialty: 'coding', hidden: false }], nextCursor: null } });
  if (message.method === 'account/login/start') {
    if (message.params.type === 'chatgpt') return send({ id: message.id, result: { type: 'chatgpt', loginId: 'login_1', authUrl: 'https://chatgpt.com/auth/test' } });
    if (message.params.type === 'chatgptDeviceCode') return send({ id: message.id, result: { type: 'chatgptDeviceCode', loginId: 'login_2', verificationUrl: 'https://auth.openai.com/codex/device', userCode: 'ABCD-1234' } });
    if (message.params.type === 'apiKey') { account = { type: 'apiKey' }; return send({ id: message.id, result: { type: 'apiKey' } }); }
  }
  if (message.method === 'account/login/cancel') return send({ id: message.id, result: {} });
  if (message.method === 'account/logout') { account = null; return send({ id: message.id, result: {} }); }
  if (message.method === 'thread/start') {
    if (message.params?.sandbox !== 'read-only') return send({ id: message.id, error: { code: -32602, message: 'sandbox must be the read-only enum' } });
    const thread = { id: `thr_${++threadCounter}`, ephemeral: Boolean(message.params.ephemeral), turns: [] };
    send({ id: message.id, result: { thread } }); send({ method: 'thread/started', params: { thread } }); return;
  }
  if (message.method === 'thread/resume') return send({ id: message.id, result: { thread: { id: message.params.threadId, ephemeral: false, turns: [] } } });
  if (message.method === 'turn/interrupt') { send({ id: message.id, result: {} }); send({ method: 'turn/completed', params: { threadId: message.params.threadId, turn: { id: message.params.turnId, status: 'interrupted', items: [] } } }); return; }
  if (message.method === 'turn/start') {
    if (message.params?.sandboxPolicy?.type !== 'readOnly') return send({ id: message.id, error: { code: -32602, message: 'sandboxPolicy.type must be readOnly' } });
    if ((message.params.input ?? []).some((item) => item.text === 'verify high effort') && message.params?.effort !== 'high') return send({ id: message.id, error: { code: -32602, message: 'effort must be forwarded' } });
    const turn = { id: `turn_${++turnCounter}`, status: 'inProgress', items: [] };
    send({ id: message.id, result: { turn } });
    send({ method: 'turn/started', params: { threadId: message.params.threadId, turn } });
    const approvalId = 900 + turnCounter;
    send({ id: approvalId, method: 'item/commandExecution/requestApproval', params: { threadId: message.params.threadId, turnId: turn.id, command: ['git', 'status'], cwd: message.params.cwd ?? '.' } });
    await new Promise((resolve) => pendingApprovals.set(approvalId, resolve));
    const prompt = (message.params.input ?? []).map((item) => item.text ?? '').join('');
    const answer = prompt.includes('FORGE_ACTION_PROTOCOL')
      ? JSON.stringify({ text: 'Need README.', toolCalls: [{ id: 'codex_read', name: 'fs.read', arguments: { path: 'README.md' } }] })
      : 'fixture answer';
    send({ method: 'item/agentMessage/delta', params: { threadId: message.params.threadId, turnId: turn.id, delta: answer.slice(0, Math.ceil(answer.length / 2)) } });
    send({ method: 'item/agentMessage/delta', params: { threadId: message.params.threadId, turnId: turn.id, delta: answer.slice(Math.ceil(answer.length / 2)) } });
    send({ method: 'thread/tokenUsage/updated', params: { threadId: message.params.threadId, turnId: turn.id, tokenUsage: { total: { inputTokens: 11, outputTokens: 5, totalTokens: 16 } } } });
    send({ method: 'turn/completed', params: { threadId: message.params.threadId, turn: { ...turn, status: 'completed' } } });
    return;
  }
  send({ id: message.id, error: { code: -32601, message: `unknown ${message.method}` } });
});
