import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const STAGES = new Set(['authentication', 'organization-authorization', 'route-handler']);
const OUTCOMES = new Set(['allow', 'deny', 'pass', 'error', 'not-found']);

function safePathname(value) {
  const pathname = String(value ?? '').split('?')[0];
  if (!pathname.startsWith('/')) throw new TypeError('pathname must be absolute');
  return pathname.slice(0, 1024);
}

export class RouteSecurityTelemetry {
  constructor({ eventSink = () => {}, clock = () => new Date().toISOString(), idFactory = () => randomUUID() } = {}) {
    if (typeof eventSink !== 'function') throw new TypeError('eventSink must be a function');
    if (typeof clock !== 'function' || typeof idFactory !== 'function') throw new TypeError('clock and idFactory must be functions');
    this.eventSink = eventSink;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  start({ method, pathname } = {}) {
    const requestId = String(this.idFactory());
    const requestMethod = String(method ?? 'GET').toUpperCase().slice(0, 16);
    const route = safePathname(pathname);
    let sequence = 0;
    const record = (stage, outcome, { statusCode = null, code = null } = {}) => {
      if (!STAGES.has(stage)) throw new TypeError(`Unsupported route security stage: ${stage}`);
      if (!OUTCOMES.has(outcome)) throw new TypeError(`Unsupported route security outcome: ${outcome}`);
      sequence += 1;
      const base = {
        schema: 'nolane.agent.route-security-event.v1',
        type: 'security.route-gate',
        requestId,
        sequence,
        time: this.clock(),
        method: requestMethod,
        route,
        stage,
        outcome,
        ...(Number.isInteger(statusCode) ? { statusCode } : {}),
        ...(code ? { code: String(code).slice(0, 128) } : {}),
        claims: { headersStored: false, queryStored: false, bodyStored: false, credentialsStored: false },
      };
      const event = Object.freeze({ ...base, claims: Object.freeze(base.claims), receiptSha256: canonicalSha256(base) });
      this.eventSink(event);
      return event;
    };
    return Object.freeze({ requestId, record });
  }
}
