function tokenFromLocation(locationObject) {
  try {
    const location = new URL(locationObject?.href ?? 'http://localhost/');
    const hashRoute = location.hash.slice(1);
    return hashRoute ? new URL(hashRoute, 'http://nolane.local').searchParams.get('token') ?? location.searchParams.get('token') : location.searchParams.get('token');
  }
  catch { return null; }
}

function clientIdentity({ clientId, storage }) {
  if (clientId) return String(clientId);
  const key = 'nolane.workroom.terminal-client-id';
  try {
    const existing = storage?.getItem(key);
    if (existing) return existing;
    const next = globalThis.crypto?.randomUUID?.() ?? `workroom-${Date.now()}`;
    storage?.setItem(key, next);
    return next;
  } catch { return globalThis.crypto?.randomUUID?.() ?? `workroom-${Date.now()}`; }
}

export function createTerminalClient({ WebSocketImpl = globalThis.WebSocket, locationObject = globalThis.location, token = tokenFromLocation(locationObject), clientId = null, storage = globalThis.localStorage, onEvent = () => {}, onStatus = () => {}, requestTimeoutMs = 15_000 } = {}) {
  if (typeof WebSocketImpl !== 'function') throw new Error('WebSocket is unavailable');
  const id = clientIdentity({ clientId, storage });
  let socket = null;
  let sequence = 0;
  const pending = new Map();
  const rejectPending = (error) => {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
  };
  const connect = async () => {
    if (socket && (socket.readyState === WebSocketImpl.OPEN || socket.readyState === 1)) return socket;
    const protocol = locationObject?.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = new URL(`${protocol}//${locationObject?.host ?? 'localhost'}/terminal`);
    url.searchParams.set('clientId', id);
    const protocols = token ? [`nolane-auth.${token}`] : undefined;
    const candidate = protocols ? new WebSocketImpl(url.toString(), protocols) : new WebSocketImpl(url.toString());
    socket = candidate;
    candidate.onmessage = (event) => {
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (message?.id && pending.has(String(message.id))) {
        const entry = pending.get(String(message.id)); pending.delete(String(message.id)); clearTimeout(entry.timer);
        if (message.error) entry.reject(Object.assign(new Error(message.error.message ?? 'Terminal request failed'), { code: message.error.code }));
        else entry.resolve(message.result);
        return;
      }
      onEvent(message);
    };
    candidate.onclose = () => { if (socket === candidate) socket = null; rejectPending(new Error('Terminal connection closed')); onStatus('disconnected'); };
    candidate.onerror = () => onStatus('error');
    await new Promise((resolve, reject) => {
      candidate.onopen = () => { onStatus('connected'); resolve(candidate); };
      candidate.onerror = () => { onStatus('error'); reject(new Error('Cannot open terminal connection')); };
    });
    return candidate;
  };
  return Object.freeze({
    async request(type, payload = {}, timeoutMs = requestTimeoutMs) {
      const active = await connect(); const requestId = String(++sequence);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Terminal request timed out: ${type}`)); }, timeoutMs);
        pending.set(requestId, { resolve, reject, timer });
        active.send(JSON.stringify({ id: requestId, type: String(type), ...payload }));
      });
    },
    close() { socket?.close?.(); socket = null; },
  });
}

export function decodeTerminalOutput(value) {
  try {
    const bytes = Uint8Array.from(atob(String(value ?? '')), (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}
