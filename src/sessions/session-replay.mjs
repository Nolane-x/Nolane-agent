function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

export class SessionReplay {
  static materialize(events, { cursorSeq, initialState, reducer } = {}) {
    if (typeof reducer !== 'function') fail('SESSION_REPLAY_REDUCER', 'reducer must be a function');
    const bySeq = new Map(events.map((event) => [Number(event.seq), event]));
    if (cursorSeq !== 0 && !bySeq.has(Number(cursorSeq))) fail('SESSION_REPLAY_CURSOR', `Unknown cursor sequence: ${cursorSeq}`);
    const lineage = [];
    const selected = [];
    const seen = new Set();
    let cursor = Number(cursorSeq) || 0;
    while (cursor) {
      if (seen.has(cursor)) fail('SESSION_REPLAY_CYCLE', `Cycle at sequence ${cursor}`);
      seen.add(cursor);
      const event = bySeq.get(cursor);
      if (!event) fail('SESSION_REPLAY_PARENT', `Missing parent sequence ${cursor}`);
      lineage.push(cursor);
      selected.push(event);
      cursor = Number(event.parentSeq) || 0;
    }
    lineage.reverse();
    selected.reverse();
    let state = structuredClone(initialState);
    for (const event of selected) state = reducer(state, event);
    return Object.freeze({ schema: 'forge.session-replay.v1', cursorSeq: Number(cursorSeq) || 0, lineage: Object.freeze(lineage), events: Object.freeze(selected), state });
  }
}
