import { ComposerDraftStore } from './composer-draft-store.mjs';
import { SessionRestoreStore } from './session-restore-store.mjs';

export class SessionRestoreService {
  constructor({ dataDir, clock = () => new Date().toISOString(), restoreStore = null, draftStore = null } = {}) {
    this.restoreStore = restoreStore ?? new SessionRestoreStore({ dataDir, clock });
    this.draftStore = draftStore ?? new ComposerDraftStore({ dataDir, clock });
  }

  restore() { return this.restoreStore.read(); }
  updateRestore(patch) { return this.restoreStore.update(patch); }
  draft(scope = 'home') { return this.draftStore.get(scope); }
  saveDraft({ scope = 'home', draft = {} } = {}) { return this.draftStore.put(scope, draft); }
  clearDraft(scope = 'home') { return this.draftStore.delete(scope); }
}
