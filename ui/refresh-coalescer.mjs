export function createRefreshCoalescer({
  refresh,
  delayMs = 120,
  schedule = setTimeout,
  cancel = clearTimeout,
} = {}) {
  if (typeof refresh !== 'function') {
    throw new TypeError('refresh must be a function');
  }
  if (typeof schedule !== 'function' || typeof cancel !== 'function') {
    throw new TypeError('schedule and cancel must be functions');
  }

  let timer = null;
  let running = false;
  let queued = false;
  let recent = false;

  async function flush() {
    timer = null;
    if (running) {
      queued = true;
      return;
    }

    running = true;
    const options = { recent };
    recent = false;
    try {
      await refresh(options);
    } finally {
      running = false;
      if (queued || recent) {
        queued = false;
        timer = schedule(flush, delayMs);
      }
    }
  }

  return Object.freeze({
    request(options = {}) {
      recent ||= options.recent === true;
      if (running) {
        queued = true;
        return;
      }
      if (timer !== null) {
        cancel(timer);
      }
      timer = schedule(flush, delayMs);
    },

    cancel() {
      if (timer !== null) {
        cancel(timer);
      }
      timer = null;
      queued = false;
      recent = false;
    },
  });
}
