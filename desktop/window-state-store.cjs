'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = 'nolane.window-state.v1';
const VERSION = 1;

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function area(display) {
  const source = display?.workArea ?? display?.bounds ?? {};
  return {
    x: finite(source.x, 0), y: finite(source.y, 0),
    width: Math.max(1, finite(source.width, 1480)), height: Math.max(1, finite(source.height, 940))
  };
}

function intersection(a, b) {
  const left = Math.max(a.x, b.x); const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width); const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function receipt(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function resolveWindowBounds(saved, displays = [], defaults = {}) {
  const fallback = { width: finite(defaults.width, 1480), height: finite(defaults.height, 940), minWidth: finite(defaults.minWidth, 980), minHeight: finite(defaults.minHeight, 680) };
  const available = displays.length ? displays : [{ id: 'fallback', workArea: { x: 0, y: 0, width: fallback.width, height: fallback.height } }];
  const desired = {
    x: finite(saved?.bounds?.x, NaN), y: finite(saved?.bounds?.y, NaN),
    width: Math.max(fallback.minWidth, finite(saved?.bounds?.width, fallback.width)),
    height: Math.max(fallback.minHeight, finite(saved?.bounds?.height, fallback.height))
  };
  let display = available.find((item) => String(item.id) === String(saved?.displayId));
  if (!display && Number.isFinite(desired.x) && Number.isFinite(desired.y)) display = [...available].sort((a, b) => intersection(desired, area(b)) - intersection(desired, area(a)))[0];
  display ??= available.find((item) => item.primary) ?? available[0];
  const work = area(display);
  const width = Math.min(desired.width, work.width);
  const height = Math.min(desired.height, work.height);
  const centeredX = Math.round(work.x + (work.width - width) / 2);
  const centeredY = Math.round(work.y + (work.height - height) / 2);
  const visibleEnough = Number.isFinite(desired.x) && Number.isFinite(desired.y) && intersection({ ...desired, width, height }, work) >= Math.min(width * height, 160 * 120);
  const x = visibleEnough ? clamp(desired.x, work.x, work.x + work.width - width) : centeredX;
  const y = visibleEnough ? clamp(desired.y, work.y, work.y + work.height - height) : centeredY;
  return Object.freeze({ bounds: Object.freeze({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }), maximized: Boolean(saved?.maximized), displayId: String(display.id ?? '') });
}

class WindowStateStore {
  constructor({ userDataDir, clock = () => new Date().toISOString() } = {}) {
    this.clock = clock;
    this.file = path.join(path.resolve(String(userDataDir ?? '.')), 'session', 'window-state.json');
  }

  read() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (value.schema !== SCHEMA || Number(value.version) !== VERSION) throw Object.assign(new Error('Window state is incompatible'), { code: 'window_state_incompatible' });
      return Object.freeze(structuredClone(value));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      if (error instanceof SyntaxError) throw Object.assign(new Error('Window state is corrupt'), { code: 'window_state_corrupt' });
      throw error;
    }
  }

  save({ bounds, maximized = false, displayId = null } = {}) {
    const now = this.clock();
    const value = {
      schema: SCHEMA, version: VERSION,
      bounds: {
        x: Math.round(finite(bounds?.x, 0)), y: Math.round(finite(bounds?.y, 0)),
        width: Math.max(320, Math.round(finite(bounds?.width, 1480))), height: Math.max(240, Math.round(finite(bounds?.height, 940)))
      },
      maximized: Boolean(maximized), displayId: displayId == null ? null : String(displayId), updatedAt: now
    };
    value.receiptSha256 = receipt(value);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, this.file);
    return Object.freeze(structuredClone(value));
  }
}

module.exports = Object.freeze({ WindowStateStore, resolveWindowBounds });
