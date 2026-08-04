import { randomUUID } from 'node:crypto';
import { deepFreeze } from '../config.mjs';

function cloneJson(value) {
  if (value === undefined) return {};
  return structuredClone(value);
}

export function createEvent(type, payload = {}, refs = {}) {
  const normalizedType = String(type ?? '').trim();
  if (!/^[a-z][a-z0-9_.-]{1,127}$/i.test(normalizedType)) throw new TypeError('event type is invalid');
  const envelope = {
    schema: 'forge.studio.event.v1',
    id: `evt_${randomUUID().replaceAll('-', '')}`,
    time: new Date().toISOString(),
    type: normalizedType,
    refs: cloneJson(refs),
    payload: cloneJson(payload),
  };
  return deepFreeze(envelope);
}

export function eventToSse(event, sequence = null) {
  const id = sequence ?? event.id;
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
