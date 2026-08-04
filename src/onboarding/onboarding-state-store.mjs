import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ONBOARDING_SCHEMA = 'nolane.onboarding.v1';

function initial(now) {
  return {
    schema: ONBOARDING_SCHEMA,
    completed: false,
    completedAt: null,
    schemaVersion: 1,
    source: null,
    lastReviewedAt: null,
    currentStep: 0,
    draft: {},
    createdAt: now,
    updatedAt: now
  };
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

export class OnboardingStateStore {
  constructor({ dataDir, clock = () => new Date().toISOString() } = {}) {
    this.clock = clock;
    this.file = path.join(path.resolve(String(dataDir ?? '.')), 'onboarding', 'state.json');
  }

  async read() {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (value.schema !== ONBOARDING_SCHEMA || Number(value.schemaVersion) !== 1) throw Object.assign(new Error('Onboarding state is incompatible'), { code: 'onboarding_state_incompatible' });
      return Object.freeze(structuredClone(value));
    } catch (error) {
      if (error.code === 'ENOENT') return Object.freeze(initial(this.clock()));
      throw error;
    }
  }

  async progress({ currentStep = 0, draft = {} } = {}) {
    const state = structuredClone(await this.read());
    if (state.completed) return Object.freeze(state);
    state.currentStep = Math.max(0, Math.min(3, Number(currentStep) || 0));
    state.draft = draft && typeof draft === 'object' && !Array.isArray(draft) ? structuredClone(draft) : {};
    state.updatedAt = this.clock();
    await atomicJson(this.file, state);
    return Object.freeze(structuredClone(state));
  }

  async complete({ source = 'guided', draft = {} } = {}) {
    const state = structuredClone(await this.read());
    const now = this.clock();
    state.completed = true;
    state.completedAt = state.completedAt ?? now;
    state.source = String(source);
    state.lastReviewedAt = now;
    state.currentStep = 3;
    state.draft = draft && typeof draft === 'object' && !Array.isArray(draft) ? structuredClone(draft) : {};
    state.updatedAt = now;
    await atomicJson(this.file, state);
    return Object.freeze(structuredClone(state));
  }
}
