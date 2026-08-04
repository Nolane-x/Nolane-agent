import readline from 'node:readline';

const sessions = new Map();
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
function send(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }

rl.on('line', (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  const { id, method, params = {} } = request;
  try {
    if (method === 'initialize') return send({ id, result: { protocolVersion: 1, host: 'fake', capabilities: ['pty'] } });
    if (method === 'session/create') {
      const session = { id: params.id, cwd: params.cwd, cols: params.cols, rows: params.rows, state: 'running', cursor: 0, chunks: [] };
      sessions.set(session.id, session);
      send({ id, result: { ...session, chunks: undefined } });
      queueMicrotask(() => {
        const data = Buffer.from(`ready:${session.id}\r\n`).toString('base64');
        session.chunks.push({ cursor: ++session.cursor, data });
        send({ method: 'session/output', params: { sessionId: session.id, cursor: session.cursor, data } });
      });
      return;
    }
    if (method === 'session/input') {
      const session = sessions.get(params.sessionId);
      if (!session) throw new Error('unknown session');
      const data = String(params.data ?? '');
      const encoded = Buffer.from(data).toString('base64');
      session.chunks.push({ cursor: ++session.cursor, data: encoded });
      send({ id, result: { acceptedBytes: Buffer.byteLength(data), cursor: session.cursor } });
      send({ method: 'session/output', params: { sessionId: session.id, cursor: session.cursor, data: encoded } });
      return;
    }
    if (method === 'session/resize') {
      const session = sessions.get(params.sessionId); if (!session) throw new Error('unknown session');
      session.cols = params.cols; session.rows = params.rows; return send({ id, result: { cols: session.cols, rows: session.rows } });
    }
    if (method === 'session/snapshot') {
      const session = sessions.get(params.sessionId); if (!session) throw new Error('unknown session');
      const after = Number(params.afterCursor ?? 0);
      return send({ id, result: { sessionId: session.id, cursor: session.cursor, chunks: session.chunks.filter((chunk) => chunk.cursor > after) } });
    }
    if (method === 'session/list') return send({ id, result: [...sessions.values()].map(({ chunks, ...session }) => session) });
    if (method === 'session/terminate') {
      const session = sessions.get(params.sessionId); if (!session) throw new Error('unknown session');
      session.state = 'exited';
      send({ id, result: { terminated: true } });
      send({ method: 'session/exit', params: { sessionId: session.id, exitCode: 0, signal: null } });
      return;
    }
    if (method === 'shutdown') { send({ id, result: { closing: true } }); setImmediate(() => process.exit(0)); return; }
    throw new Error(`unknown method: ${method}`);
  } catch (error) { send({ id, error: { code: -32000, message: error.message } }); }
});
