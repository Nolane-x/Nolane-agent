import path from 'node:path';

import { createEvent } from '../protocol/events.mjs';
import { CheckpointIndex } from './checkpoint-index.mjs';
import { ReplayService } from './replay-service.mjs';
import { RestorePlanner } from './restore-planner.mjs';
import { StateComparator } from './state-comparator.mjs';
import { signed, TIME_TRAVEL_SCHEMAS } from './time-travel-schema.mjs';

export class TimeTravelService {
  constructor({ dataDir, store, executionStory = null, clock = () => new Date().toISOString(), index = null, comparator = null, restorer = null, replay = null } = {}) {
    if (!dataDir || !store?.appendEvent) throw new TypeError('TimeTravelService dataDir and store are required');
    this.dataDir = path.resolve(dataDir); this.store = store; this.executionStory = executionStory; this.clock = clock;
    this.index = index ?? new CheckpointIndex({ dataDir: this.dataDir, store, clock });
    this.comparator = comparator ?? new StateComparator({ index: this.index, store, clock });
    this.restorer = restorer ?? new RestorePlanner({ index: this.index, store, clock });
    this.replay = replay ?? new ReplayService({ index: this.index, store, worktreesRoot: path.join(this.dataDir, 'time-travel', 'worktrees'), clock });
  }

  async list(input = {}) { return { schema: 'nolane.time-travel-checkpoint-list.v1', checkpoints: await this.index.list(input) }; }
  async get(checkpointId) { return this.index.get(checkpointId); }

  async create(input = {}) {
    const checkpoint = await this.index.create(input);
    this.store.appendEvent(createEvent('time-travel.checkpoint.created', { checkpointId: checkpoint.id, label: checkpoint.label, gitCommit: checkpoint.git.commit, dirty: checkpoint.git.dirty, completeWorkingTreeCapture: checkpoint.completeWorkingTreeCapture, receiptSha256: checkpoint.receiptSha256 }, { projectId: checkpoint.projectId, missionId: checkpoint.missionId }));
    return checkpoint;
  }

  async compare(checkpointId) { return this.comparator.compare({ checkpointId }); }

  async restoreFile(input = {}) {
    const receipt = await this.restorer.apply(input);
    this.store.appendEvent(createEvent('time-travel.file.restored', { checkpointId: receipt.checkpointId, path: receipt.path, state: receipt.state, backup: receipt.backup, receiptSha256: receipt.receiptSha256 }, { projectId: receipt.projectId, missionId: receipt.missionId }));
    return receipt;
  }

  async createBranch(input = {}) {
    const receipt = await this.replay.createBranch(input);
    this.store.appendEvent(createEvent('time-travel.branch.created', { checkpointId: receipt.checkpointId, branch: receipt.worktree.branch, completeWorkingTreeCapture: receipt.completeWorkingTreeCapture, receiptSha256: receipt.receiptSha256 }, { projectId: receipt.projectId, missionId: receipt.missionId }));
    return receipt;
  }

  async replayMission(input = {}) {
    const receipt = await this.replay.replayMission(input);
    this.store.appendEvent(createEvent('time-travel.mission.replayed', { checkpointId: receipt.checkpointId, sourceMissionId: receipt.sourceMissionId, newMissionId: receipt.mission.id, taskCount: receipt.tasks.length, receiptSha256: receipt.receiptSha256 }, { projectId: receipt.mission.projectId, missionId: receipt.mission.id }));
    return receipt;
  }

  async exportEvidence(checkpointId) {
    const checkpoint = await this.index.get(checkpointId);
    const comparison = await this.comparator.compare({ checkpointId });
    const story = this.executionStory ? this.executionStory.exportBundle({ missionId: checkpoint.missionId }) : null;
    const base = { schema: TIME_TRAVEL_SCHEMAS.export, exportedAt: this.clock(), checkpoint, comparison, executionStory: story };
    return signed(base);
  }
}
