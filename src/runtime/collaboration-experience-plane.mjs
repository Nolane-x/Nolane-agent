import { signed } from '../construction/construction-utils.mjs';
import { SharedBlackboard } from '../collaboration/shared-blackboard.mjs';
import { JointCommitmentLedger } from '../collaboration/joint-commitment-ledger.mjs';
import { AdaptiveTopologySelector, DomainTrustRegistry, assignCausalCredit } from '../collaboration/adaptive-topology-selector.mjs';
import { SemanticMergeAnalyzer } from '../collaboration/semantic-merge-analyzer.mjs';
import { DeterministicJourneyReplayer } from '../browser/deterministic-journey-replayer.mjs';
import { ReviewQueueService } from '../experience/review-queue-service.mjs';
import { ArtifactPlaybackService } from '../experience/artifact-playback-service.mjs';
import { MissionSteeringService } from '../experience/mission-steering-service.mjs';

export class CollaborationExperiencePlane {
  constructor({ clock = () => Date.now(), blackboard = {}, commitments = {}, topology = {}, semanticMerge = {}, browserReplay = {}, reviewQueue = {}, playback = {}, steering = {} } = {}) {
    this.clock = clock; this.options = { blackboard, commitments, topology, semanticMerge, browserReplay, reviewQueue, playback, steering }; this.closed = false;
    this._blackboard = null; this._commitments = null; this._topology = null; this._trust = null; this._semanticMerge = null; this._browserReplay = null; this._reviewQueue = null; this._playback = null; this._steering = null;
  }
  #open() { if (this.closed) throw new Error('Collaboration Experience Plane is closed'); }
  get blackboard() { this.#open(); return this._blackboard ??= new SharedBlackboard({ ...this.options.blackboard, clock: this.clock }); }
  get commitments() { this.#open(); return this._commitments ??= new JointCommitmentLedger({ ...this.options.commitments, clock: this.clock }); }
  get topology() { this.#open(); return this._topology ??= new AdaptiveTopologySelector(this.options.topology); }
  get trust() { this.#open(); return this._trust ??= new DomainTrustRegistry(this.options.topology); }
  get semanticMerge() { this.#open(); return this._semanticMerge ??= new SemanticMergeAnalyzer(this.options.semanticMerge); }
  get browserReplay() { this.#open(); return this._browserReplay ??= new DeterministicJourneyReplayer(this.options.browserReplay); }
  get reviewQueue() { this.#open(); return this._reviewQueue ??= new ReviewQueueService(this.options.reviewQueue); }
  get playback() { this.#open(); return this._playback ??= new ArtifactPlaybackService(this.options.playback); }
  get steering() { this.#open(); return this._steering ??= new MissionSteeringService(this.options.steering); }

  heartbeatAgent(input) { return this.blackboard.heartbeat(input); }
  writeBlackboard(input) { return this.blackboard.write(input); }
  readBlackboard(input) { return this.blackboard.read(input); }
  resolveBlackboard(key) { return this.blackboard.resolve(key); }
  createCommitment(input) { return this.commitments.create(input); }
  renegotiateCommitment(input) { return this.commitments.renegotiate(input); }
  acknowledgeCommitment(input) { return this.commitments.acknowledge(input); }
  handoffCommitment(input) { return this.commitments.handoff(input); }
  waitForCommitment(input) { return this.commitments.waitFor(input); }
  detectCommitmentDeadlocks(input) { return this.commitments.detectDeadlocks(input); }
  revokeCommitment(input) { return this.commitments.revoke(input); }
  reassignCommitment(input) { return this.commitments.reassign(input); }
  selectTopology(input) { return this.topology.select(input); }
  recordDomainTrust(input) { return this.trust.record(input); }
  rankDomainTrust(input) { return this.trust.rank(input); }
  assignCausalCredit(input) { return assignCausalCredit(input); }
  analyzeSemanticMerge(input) { return this.semanticMerge.analyze(input); }
  replayBrowserJourney(input) { return this.browserReplay.replay(input); }
  addReviewItem(input) { return this.reviewQueue.add(input); }
  decideReviewItem(input) { return this.reviewQueue.decide(input); }
  reviewQueueSnapshot() { return this._reviewQueue ? this._reviewQueue.snapshot() : signed({ schema: 'forge.review-queue-snapshot.v1', items: [], claims: { orderedByTimeOnly: false, rawDiffStored: false } }); }
  appendPlaybackEvent(input) { return this.playback.append(input); }
  addPlaybackCheckpoint(input) { return this.playback.checkpoint(input); }
  createRewindPlan(input) { return this.playback.rewindPlan(input); }
  issueSteering(input) { return this.steering.issue(input); }

  snapshot() {
    return signed({
      schema: 'forge.collaboration-experience-plane.v1',
      lifecycle: { closed: this.closed, blackboardLoaded: this._blackboard !== null, commitmentsLoaded: this._commitments !== null, topologyLoaded: this._topology !== null, trustLoaded: this._trust !== null, semanticMergeLoaded: this._semanticMerge !== null, browserReplayLoaded: this._browserReplay !== null, reviewQueueLoaded: this._reviewQueue !== null, playbackLoaded: this._playback !== null, steeringLoaded: this._steering !== null },
      blackboard: this._blackboard ? this._blackboard.snapshot() : null,
      commitments: this._commitments ? this._commitments.snapshot() : null,
      reviewQueue: this._reviewQueue ? this._reviewQueue.snapshot() : null,
      playback: this._playback ? this._playback.snapshot() : null,
      steering: this._steering ? this._steering.snapshot() : null,
      claims: { rawPromptStored: false, rawModelOutputStored: false, hiddenReasoningStored: false, browserSecretStored: false, automaticAgentCreation: false, automaticMergeExecuted: false, productionJetBrainsParity: false },
    });
  }
  close() { this.closed = true; return this.snapshot(); }
}
