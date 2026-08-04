'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = 'nolane.update-preferences.v1';

function safeVersion(value) {
  if (value == null || value === '') return null;
  const text = String(value);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(text)) throw Object.assign(new Error('Update preference version is invalid'), { code: 'update_preference_version_invalid' });
  return text;
}

class UpdatePreferenceStore {
  constructor({ userDataDir, clock = () => new Date().toISOString() } = {}) {
    this.clock = clock;
    this.file = path.join(path.resolve(String(userDataDir ?? '.')), 'updates', 'preferences.json');
  }

  read() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (value.schema !== SCHEMA) throw Object.assign(new Error('Update preferences are incompatible'), { code: 'update_preferences_incompatible' });
      return Object.freeze({ schema: SCHEMA, deferredVersion: safeVersion(value.deferredVersion), ignoredVersion: safeVersion(value.ignoredVersion), lastCheckAt: value.lastCheckAt ?? null, updatedAt: value.updatedAt ?? null });
    } catch (error) {
      if (error.code === 'ENOENT') return Object.freeze({ schema: SCHEMA, deferredVersion: null, ignoredVersion: null, lastCheckAt: null, updatedAt: null });
      if (error instanceof SyntaxError) throw Object.assign(new Error('Update preferences are corrupt'), { code: 'update_preferences_corrupt' });
      throw error;
    }
  }

  write(patch = {}) {
    const current = this.read();
    const next = {
      schema: SCHEMA,
      deferredVersion: 'deferredVersion' in patch ? safeVersion(patch.deferredVersion) : current.deferredVersion,
      ignoredVersion: 'ignoredVersion' in patch ? safeVersion(patch.ignoredVersion) : current.ignoredVersion,
      lastCheckAt: 'lastCheckAt' in patch ? patch.lastCheckAt : current.lastCheckAt,
      updatedAt: this.clock()
    };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, this.file);
    return Object.freeze(structuredClone(next));
  }
}

module.exports = Object.freeze({ UpdatePreferenceStore });
