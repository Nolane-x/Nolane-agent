import { timingSafeEqual } from 'node:crypto';

const BEARER = /^Bearer\s+(.+)$/i;

function headerValue(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()] ?? headers?.[name.toUpperCase()];
  return Array.isArray(value) ? value[0] : value;
}

function cookieValue(value, name) {
  for (const item of String(value ?? '').split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === name) {
      const raw = rest.join('=');
      try { return decodeURIComponent(raw); } catch { return raw; }
    }
  }
  return null;
}

export function terminalAuthProtocol(value) {
  for (const protocol of String(value ?? '').split(',')) {
    const match = /^nolane-auth\.([A-Za-z0-9!#$%&'*+.\^_`|~-]+)$/.exec(protocol.trim());
    if (match) return protocol.trim();
  }
  return null;
}

export function sameLocalSecret(actual, expected) {
  const received = Buffer.from(String(actual ?? ''));
  const configured = Buffer.from(String(expected ?? ''));
  return received.length === configured.length && timingSafeEqual(received, configured);
}

export function localRequestToken(req, { allowTerminalProtocol = false } = {}) {
  const authorization = String(headerValue(req?.headers, 'authorization') ?? '');
  const bearer = BEARER.exec(authorization)?.[1]?.trim();
  if (bearer) return bearer;
  const cookie = cookieValue(headerValue(req?.headers, 'cookie'), 'nolane_local_session');
  if (cookie) return cookie;
  const protocol = allowTerminalProtocol ? terminalAuthProtocol(headerValue(req?.headers, 'sec-websocket-protocol')) : null;
  return protocol ? protocol.slice('nolane-auth.'.length) : null;
}
