import { deepFreeze } from './shared.mjs';
export class SpeculativeBranchLedger {
  #branches = new Map();
  open({ id, predictedObservation }) { if (!id) throw new TypeError('Branch id is required'); const branch = { id, predictedObservation, actions: [], status: 'open' }; this.#branches.set(id, branch); return deepFreeze(structuredClone(branch)); }
  record(id, action) { const branch = this.#branches.get(id); if (!branch || branch.status !== 'open') throw new Error(`Speculative branch is not open: ${id}`); if (action?.reversible !== true || action?.sideEffect === true) throw new Error('Irreversible or side-effecting speculative action is forbidden'); branch.actions.push(structuredClone(action)); return deepFreeze(structuredClone(branch)); }
  resolve(id, { actualObservation }) { const branch = this.#branches.get(id); if (!branch) throw new Error(`Unknown speculative branch: ${id}`); branch.actualObservation = actualObservation; branch.status = actualObservation === branch.predictedObservation ? 'accepted' : 'discarded'; return deepFreeze(structuredClone(branch)); }
}
