import { parentPort } from 'node:worker_threads';

export const NOLANE_RUNTIME_PROTOCOL = 'nolane-agent-runtime/1';

if (parentPort) {
  parentPort.on('message', (message) => {
    if (!message || typeof message !== 'object') return;
    const { id, type } = message;
    if (type === 'handshake') {
      parentPort.postMessage({ id, ok: true, protocol: NOLANE_RUNTIME_PROTOCOL, capabilities: [] });
      return;
    }
    if (type === 'ping') {
      parentPort.postMessage({ id, ok: true, pong: true, protocol: NOLANE_RUNTIME_PROTOCOL });
      return;
    }
    if (type === 'shutdown') {
      parentPort.postMessage({ id, ok: true, stopped: true });
      setImmediate(() => process.exit(0));
      return;
    }
    parentPort.postMessage({ id, ok: false, error: 'unsupported-message-type' });
  });
}
