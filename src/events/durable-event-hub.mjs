export class DurableEventHub {
  constructor({ maxSubscribers = 256, eventSink = () => {} } = {}) {
    this.maxSubscribers = Math.max(1, Number(maxSubscribers) || 256);
    this.eventSink = eventSink;
    this.subscribers = new Set();
    this.closed = false;
  }

  subscribe(listener) {
    if (this.closed) throw new Error('Durable event hub is closed');
    if (typeof listener !== 'function') throw new TypeError('event listener is required');
    if (this.subscribers.size >= this.maxSubscribers) throw Object.assign(new Error('Event subscriber limit reached'), { statusCode: 503, code: 'EVENT_SUBSCRIBER_LIMIT' });
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  publish(event) {
    if (this.closed) return Object.freeze({ delivered: 0, failed: 0 });
    if (!event || !Number.isInteger(Number(event.seq)) || Number(event.seq) <= 0) throw new TypeError('Committed event sequence is required');
    let delivered = 0; let failed = 0;
    for (const listener of [...this.subscribers]) {
      try { listener(event); delivered += 1; } catch (error) { failed += 1; this.eventSink({ type: 'runtime.event-subscriber-failed', error: String(error?.message ?? error), eventId: event.id, seq: event.seq }); }
    }
    return Object.freeze({ delivered, failed });
  }

  snapshot() { return Object.freeze({ schema: 'forge.event-hub.v1', subscribers: this.subscribers.size, maxSubscribers: this.maxSubscribers, closed: this.closed }); }
  close() { this.closed = true; this.subscribers.clear(); }
}
