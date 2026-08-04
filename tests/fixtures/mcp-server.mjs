import readline from 'node:readline';
const rl = readline.createInterface({ input: process.stdin });
const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
rl.on('line', async (line) => {
  const message = JSON.parse(line);
  if (message.method === 'initialize') return send({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-11-25', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'fixture', version: '1.0.0' } } });
  if (message.method === 'notifications/initialized') return;
  if (message.method === 'tools/list') return send({ jsonrpc: '2.0', id: message.id, result: { tools: [
    { name: 'echo', description: 'Echo text', inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } },
    { name: 'slow', description: 'Wait', inputSchema: { type: 'object', properties: {} } },
  ] } });
  if (message.method === 'tools/call') {
    if (message.params.name === 'slow') { await new Promise((resolve) => setTimeout(resolve, 5_000)); return send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'late' }] } }); }
    if (message.params.name === 'error') return send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: 'fixture error' } });
    return send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: message.params.arguments.text }], structuredContent: { echoed: message.params.arguments.text }, isError: false } });
  }
  send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'method not found' } });
});
