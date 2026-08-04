import readline from 'node:readline';
const values = new Map();
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
rl.on('line', (line) => {
  const request = JSON.parse(line); const { id, method, params = {} } = request; const key = `${params.service}\0${params.account}`;
  if (method === 'initialize') return send({ id, result: { protocolVersion: 1, backend: 'fake' } });
  if (method === 'credential/set') { values.set(key, params.secret); return send({ id, result: { service: params.service, account: params.account, present: true } }); }
  if (method === 'credential/resolve') return send({ id, result: { secret: values.get(key) ?? null } });
  if (method === 'credential/list') return send({ id, result: [...values.keys()].map((item) => { const [service, account] = item.split('\0'); return { service, account, present: true }; }).filter((item) => !params.service || item.service === params.service) });
  if (method === 'credential/delete') return send({ id, result: { deleted: values.delete(key) } });
  if (method === 'shutdown') { send({ id, result: { closing: true } }); return setImmediate(() => process.exit(0)); }
  send({ id, error: { code: -32000, message: 'unknown method' } });
});
