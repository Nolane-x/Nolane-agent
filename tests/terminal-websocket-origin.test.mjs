import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import net from 'node:net';
import { once } from 'node:events';

import { attachTerminalWebSocket, isAllowedTerminalOrigin } from '../src/server/terminal-websocket.mjs';

test('terminal websocket permits only its own loopback browser origin while retaining non-browser clients', () => {
  assert.equal(isAllowedTerminalOrigin({ origin: 'http://127.0.0.1:4173', host: '127.0.0.1:4173' }), true);
  assert.equal(isAllowedTerminalOrigin({ origin: 'http://localhost:4173', host: 'localhost:4173' }), true);
  assert.equal(isAllowedTerminalOrigin({ origin: undefined, host: '127.0.0.1:4173' }), true);
  assert.equal(isAllowedTerminalOrigin({ origin: 'http://127.0.0.1:4174', host: '127.0.0.1:4173' }), false);
  assert.equal(isAllowedTerminalOrigin({ origin: 'https://example.test', host: '127.0.0.1:4173' }), false);
  assert.equal(isAllowedTerminalOrigin({ origin: 'not a URL', host: '127.0.0.1:4173' }), false);
});

test('attached terminal websocket rejects a foreign browser origin before it upgrades', async () => {
  const server = createServer();
  const terminalSocket = attachTerminalWebSocket({ server, token: 'local-secret', terminalManager: { on() {}, off() {} } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const socket = net.createConnection({ host: '127.0.0.1', port: address.port });
  try {
    await once(socket, 'connect');
    const response = new Promise((resolve, reject) => { socket.once('data', (data) => resolve(String(data))); socket.once('error', reject); });
    socket.write(`GET /terminal?clientId=test HTTP/1.1\r\nHost: 127.0.0.1:${address.port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Protocol: nolane-auth.local-secret\r\nOrigin: https://example.test\r\n\r\n`);
    assert.match(await response, /^HTTP\/1\.1 403 Forbidden/m);
  } finally {
    socket.destroy();
    terminalSocket.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
