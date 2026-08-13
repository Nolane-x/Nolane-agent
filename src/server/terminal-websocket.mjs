import { createHash } from 'node:crypto';
import { localRequestToken, sameLocalSecret, terminalAuthProtocol } from './local-session-auth.mjs';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function httpReject(socket, status, message) {
  const body = Buffer.from(String(message));
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${body.length}\r\n\r\n${body}`);
}
function encodeFrame(payload, opcode = 0x1) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const header = body.length < 126 ? Buffer.from([0x80 | opcode, body.length])
    : body.length <= 0xffff ? Buffer.from([0x80 | opcode, 126, body.length >> 8, body.length & 0xff])
      : (() => { const value = Buffer.alloc(10); value[0] = 0x80 | opcode; value[1] = 127; value.writeBigUInt64BE(BigInt(body.length), 2); return value; })();
  return Buffer.concat([header, body]);
}
function closePayload(code, reason = '') { const text = Buffer.from(String(reason).slice(0, 120)); const body = Buffer.alloc(2 + text.length); body.writeUInt16BE(code, 0); text.copy(body, 2); return body; }

class WebSocketPeer {
  constructor(socket, { maxFrameBytes = 1024 * 1024, maxQueueBytes = 2 * 1024 * 1024 } = {}) {
    this.socket = socket; this.maxFrameBytes = maxFrameBytes; this.maxQueueBytes = maxQueueBytes; this.buffer = Buffer.alloc(0); this.closed = false; this.onMessage = null; this.onClose = null;
    socket.on('data', (chunk) => this.#read(chunk));
    socket.on('close', () => this.#closed()); socket.on('error', () => this.#closed());
  }
  get queuedBytes() { return Number(this.socket.writableLength ?? 0); }
  send(value) {
    if (this.closed) return false;
    const frame = encodeFrame(JSON.stringify(value));
    if (this.queuedBytes + frame.length > this.maxQueueBytes) { this.close(1013, 'terminal output backpressure'); return false; }
    return this.socket.write(frame);
  }
  close(code = 1000, reason = '') {
    if (this.closed) return; this.closed = true;
    try { this.socket.end(encodeFrame(closePayload(code, reason), 0x8)); } catch { this.socket.destroy(); }
    this.onClose?.();
  }
  #closed() { if (this.closed) return; this.closed = true; this.onClose?.(); }
  #read(chunk) {
    if (this.closed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > this.maxFrameBytes * 2 + 32) return this.close(1009, 'frame buffer too large');
    while (this.buffer.length >= 2) {
      const first = this.buffer[0]; const second = this.buffer[1];
      const fin = Boolean(first & 0x80); const opcode = first & 0x0f; const masked = Boolean(second & 0x80); let length = second & 0x7f; let offset = 2;
      if (!fin) return this.close(1003, 'fragmented frames are unsupported');
      if (!masked) return this.close(1002, 'client frames must be masked');
      if (length === 126) { if (this.buffer.length < 4) return; length = this.buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (this.buffer.length < 10) return; const big = this.buffer.readBigUInt64BE(2); if (big > BigInt(this.maxFrameBytes)) return this.close(1009, 'frame too large'); length = Number(big); offset = 10; }
      if (length > this.maxFrameBytes) return this.close(1009, 'frame too large');
      if (this.buffer.length < offset + 4 + length) return;
      const mask = this.buffer.subarray(offset, offset + 4); offset += 4;
      const payload = Buffer.from(this.buffer.subarray(offset, offset + length)); this.buffer = this.buffer.subarray(offset + length);
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      if (opcode === 0x8) return this.close(1000, 'closed');
      if (opcode === 0x9) { this.socket.write(encodeFrame(payload, 0xA)); continue; }
      if (opcode === 0xA) continue;
      if (opcode !== 0x1) return this.close(1003, 'text frames only');
      let message; try { message = JSON.parse(payload.toString('utf8')); } catch { this.send({ type: 'error', error: 'invalid-json' }); continue; }
      this.onMessage?.(message);
    }
  }
}

function publicError(error) {
  const message = String(error?.message ?? error ?? 'terminal error');
  return { code: String(error?.code ?? 'TERMINAL_ERROR'), message: message.replace(/(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, '[redacted]').slice(0, 500) };
}

function isLoopbackHostname(hostname) {
  return ['127.0.0.1', '::1', 'localhost'].includes(String(hostname ?? '').toLowerCase());
}

export function isAllowedTerminalOrigin({ origin, host } = {}) {
  const receivedOrigin = String(origin ?? '').trim();
  if (!receivedOrigin) return true;
  try {
    const requested = new URL(receivedOrigin);
    const target = new URL(`http://${String(host ?? '').trim()}`);
    return requested.protocol === 'http:'
      && isLoopbackHostname(requested.hostname)
      && isLoopbackHostname(target.hostname)
      && requested.hostname === target.hostname
      && requested.port === target.port;
  } catch {
    return false;
  }
}

export function attachTerminalWebSocket({ server, token, terminalManager, path = '/terminal', maxFrameBytes = 1024 * 1024, maxQueueBytes = 2 * 1024 * 1024, reconnectGraceMs = 5 * 60_000 } = {}) {
  if (!server || !terminalManager) return { close() {} };
  const peers = new Set(); const ownership = new Map(); const orphanOutput = new Map();
  const rememberOrphan = (event) => {
    const sessionId = String(event?.sessionId ?? ''); if (!sessionId) return;
    const current = orphanOutput.get(sessionId) ?? { events: [], bytes: 0, timer: null };
    const bytes = Buffer.byteLength(JSON.stringify(event));
    while (current.events.length && current.bytes + bytes > 128 * 1024) current.bytes -= Buffer.byteLength(JSON.stringify(current.events.shift()));
    if (bytes <= 128 * 1024) { current.events.push(event); current.bytes += bytes; }
    clearTimeout(current.timer); current.timer = setTimeout(() => orphanOutput.delete(sessionId), 2_000); current.timer.unref?.(); orphanOutput.set(sessionId, current);
  };
  const forward = (type, event) => {
    const sessionId = String(event?.sessionId ?? ''); const owner = ownership.get(sessionId);
    if (owner?.peer) owner.peer.send({ type, ...event }); else if (type === 'output') rememberOrphan(event);
    if (type === 'exit') { clearTimeout(owner?.timer); ownership.delete(sessionId); }
  };
  const outputListener = (event) => forward('output', event); const exitListener = (event) => forward('exit', event); const titleListener = (event) => forward('title', event); const errorListener = (event) => forward('session-error', event);
  terminalManager.on?.('output', outputListener); terminalManager.on?.('exit', exitListener); terminalManager.on?.('title', titleListener); terminalManager.on?.('session-error', errorListener);

  const upgrade = (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== path) return httpReject(socket, '404 Not Found', 'not found');
    if (!isAllowedTerminalOrigin({ origin: req.headers.origin, host: req.headers.host })) return httpReject(socket, '403 Forbidden', 'forbidden origin');
    const actual = localRequestToken(req, { allowTerminalProtocol: true });
    if (!actual || !sameLocalSecret(actual, token)) return httpReject(socket, '401 Unauthorized', 'unauthorized');
    const requestedClientId = String(url.searchParams.get('clientId') ?? '');
    const clientId = /^[A-Za-z0-9._:-]{1,128}$/.test(requestedClientId) ? requestedClientId : `ephemeral-${Math.random().toString(36).slice(2)}`;
    if (String(req.headers.upgrade ?? '').toLowerCase() !== 'websocket' || String(req.headers['sec-websocket-version'] ?? '') !== '13') return httpReject(socket, '426 Upgrade Required', 'websocket version 13 required');
    const key = String(req.headers['sec-websocket-key'] ?? ''); if (!/^[A-Za-z0-9+/]{22}==$/.test(key)) return httpReject(socket, '400 Bad Request', 'invalid websocket key');
    const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
    const selectedProtocol = terminalAuthProtocol(req.headers['sec-websocket-protocol']);
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n${selectedProtocol ? `Sec-WebSocket-Protocol: ${selectedProtocol}\r\n` : ''}\r\n`);
    const peer = new WebSocketPeer(socket, { maxFrameBytes, maxQueueBytes }); peers.add(peer); if (head?.length) socket.unshift(head);
    const sessions = new Set();
    peer.onClose = () => {
      peers.delete(peer);
      for (const id of sessions) {
        const owner = ownership.get(id); if (!owner || owner.peer !== peer) continue;
        owner.peer = null;
        clearTimeout(owner.timer);
        owner.timer = setTimeout(async () => {
          if (ownership.get(id) !== owner || owner.peer) return;
          ownership.delete(id); try { await terminalManager.terminate(id); } catch {}
        }, Math.max(1_000, reconnectGraceMs));
        owner.timer.unref?.();
      }
    };
    peer.onMessage = async (message) => {
      const id = message && Object.hasOwn(message, 'id') ? String(message.id) : null; const reply = (value) => peer.send(id ? { id, ...value } : value);
      try {
        const type = String(message?.type ?? ''); let result;
        if (type === 'create') {
          result = await terminalManager.create({ projectId: String(message.projectId ?? ''), principalId: 'local-admin', taskId: String(message.taskId ?? ''), sandbox: message.sandbox ?? null, cwd: String(message.cwd ?? '.'), shell: String(message.shell ?? ''), shellKind: String(message.shellKind ?? ''), distribution: message.distribution == null ? null : String(message.distribution), args: Array.isArray(message.args) ? message.args : [], env: message.env && typeof message.env === 'object' && !Array.isArray(message.env) ? message.env : {}, cols: message.cols, rows: message.rows });
          const sessionId = String(result?.id ?? ''); if (!sessionId) throw new Error('Terminal manager returned no session ID');
          sessions.add(sessionId); ownership.set(sessionId, { peer, clientId, projectId: String(message.projectId ?? ''), timer: null }); reply({ result });
          const orphan = orphanOutput.get(sessionId); if (orphan) { clearTimeout(orphan.timer); orphanOutput.delete(sessionId); for (const event of orphan.events) peer.send({ type: 'output', ...event }); }
          return;
        }
        const sessionId = String(message?.sessionId ?? '');
        const owner = ownership.get(sessionId);
        if (type !== 'list' && (!sessionId || owner?.peer !== peer)) throw Object.assign(new Error('Terminal session is not owned by this connection'), { code: 'SESSION_NOT_OWNED' });
        if (type === 'input') result = await terminalManager.input(sessionId, String(message.data ?? ''));
        else if (type === 'resize') result = await terminalManager.resize(sessionId, message.cols, message.rows);
        else if (type === 'snapshot') result = await terminalManager.snapshot(sessionId, message.afterCursor);
        else if (type === 'terminate') { result = await terminalManager.terminate(sessionId); sessions.delete(sessionId); clearTimeout(owner?.timer); ownership.delete(sessionId); }
        else if (type === 'list') {
          const all = await terminalManager.list(); result = [];
          for (const entry of all) {
            const idValue = String(entry.id); const record = ownership.get(idValue);
            if (!record || record.clientId !== clientId) continue;
            clearTimeout(record.timer); record.timer = null; record.peer = peer; sessions.add(idValue); result.push(entry);
          }
        }
        else throw Object.assign(new Error(`Unknown terminal message type: ${type}`), { code: 'UNKNOWN_MESSAGE' });
        reply({ result });
      } catch (error) { reply({ error: publicError(error) }); }
    };
  };
  server.on('upgrade', upgrade);
  return {
    close() {
      server.off('upgrade', upgrade); terminalManager.off?.('output', outputListener); terminalManager.off?.('exit', exitListener); terminalManager.off?.('title', titleListener); terminalManager.off?.('session-error', errorListener);
      for (const item of orphanOutput.values()) clearTimeout(item.timer); orphanOutput.clear();
      for (const owner of ownership.values()) clearTimeout(owner.timer);
      for (const peer of peers) peer.close(1001, 'server shutdown'); peers.clear(); ownership.clear();
    },
  };
}
