import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { MemoryPolicyController } from '../memory/memory-policy-controller.mjs';
import { ModelTimeClock } from '../memory/model-time-clock.mjs';
import { ReplayScheduler } from '../memory/replay-scheduler.mjs';
import { CompositionalSkillCompiler } from '../skills/compositional-skill-compiler.mjs';
import { SkillRegistry } from '../skills/skill-registry.mjs';
import { StabilityPlasticityGuard } from '../skills/stability-plasticity-guard.mjs';
import { ResourceAdmissionController } from './resource-admission-controller.mjs';
import { LocalDeviceDoctor } from './local-device-doctor.mjs';
import { ContentAddressedArtifactStore } from '../storage/content-addressed-artifact-store.mjs';
import { ResourceLifecycleCoordinator } from './resource-lifecycle-coordinator.mjs';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class MemorySkillResourcePlane {
  constructor({ memory = {}, replay = {}, skills = {}, resources = {}, artifacts = {}, lifecycle = {}, clock = () => Date.now() } = {}) {
    this.options = { memory, replay, skills, resources, artifacts, lifecycle };
    this.clock = clock;
    this.closed = false;
    this._memoryOperatingSystem = memory.operatingSystem ?? null;
    this._policy = null;
    this._modelTime = null;
    this._replay = null;
    this._skillCompiler = null;
    this._skillRegistry = null;
    this._stability = null;
    this._admission = null;
    this._deviceDoctor = null;
    this._artifacts = artifacts.store ?? null;
    this._lifecycle = lifecycle.coordinator ?? null;
  }

  #open() { if (this.closed) throw new Error('Memory Skill Resource Plane is closed'); }
  get memoryOperatingSystem() {
    this.#open();
    const value = this._memoryOperatingSystem ?? this.options.memory.factory?.();
    if (!value?.apply) throw new Error('Memory Operating System is not configured');
    return this._memoryOperatingSystem = value;
  }
  get policy() { this.#open(); return this._policy ??= new MemoryPolicyController(this.options.memory.policy ?? {}); }
  get modelTime() { this.#open(); return this._modelTime ??= new ModelTimeClock(this.options.replay.modelTime ?? {}); }
  get replay() { this.#open(); return this._replay ??= new ReplayScheduler(this.options.replay.scheduler ?? {}); }
  get skillCompiler() { this.#open(); return this._skillCompiler ??= new CompositionalSkillCompiler(this.options.skills.compiler ?? {}); }
  get skillRegistry() { this.#open(); return this._skillRegistry ??= new SkillRegistry(this.options.skills.registry ?? {}); }
  get stability() { this.#open(); return this._stability ??= new StabilityPlasticityGuard(this.options.skills.stability ?? {}); }
  get admission() { this.#open(); return this._admission ??= new ResourceAdmissionController({ ...(this.options.resources.admission ?? {}), clock: this.clock }); }
  get deviceDoctor() { this.#open(); return this._deviceDoctor ??= new LocalDeviceDoctor(this.options.resources.deviceDoctor ?? {}); }
  get artifacts() {
    this.#open();
    if (this._artifacts) return this._artifacts;
    if (!this.options.artifacts.root) throw new Error('Content-addressed artifact root is not configured');
    return this._artifacts = new ContentAddressedArtifactStore({ ...this.options.artifacts, clock: this.clock });
  }
  get lifecycle() {
    this.#open();
    return this._lifecycle ??= new ResourceLifecycleCoordinator({
      admissionController: this.admission,
      processLedger: this.options.resources.processLedger ?? this.options.lifecycle.processLedger ?? null,
      processDriver: this.options.resources.processDriver ?? this.options.lifecycle.processDriver ?? null,
      adapters: this.options.lifecycle.adapters ?? {}, clock: this.clock,
    });
  }

  operateMemory(input) { return this.memoryOperatingSystem.apply(input); }
  decideMemoryPolicy(input) { return this.policy.decide(input); }
  observeModelTime(input) { return this.modelTime.observe(input); }
  scheduleReplay(input = {}) { return this.replay.schedule({ ...input, modelTime: input.modelTime ?? this.modelTime.snapshot().modelTime }); }
  compileSkill(input) { const skill = this.skillCompiler.compile(input); return this.skillRegistry.add(skill); }
  recombineSkills(input) { return this.skillCompiler.recombine(input); }
  recordSkillTransfer(skillId, input) { return this.skillRegistry.recordTransfer(skillId, input); }
  transitionSkill(skillId, state, input) { return this.skillRegistry.transition(skillId, state, input); }
  evaluateStability(input) { return this.stability.evaluate(input); }
  admitResource(input, metrics) { return this.admission.admit(input, metrics); }
  sampleResource(leaseId, input) { return this.admission.sample(leaseId, input); }
  releaseResource(leaseId, input) { return this.admission.release(leaseId, input); }
  diagnoseDevice(input) { return this.deviceDoctor.diagnose(input); }
  stopMissionResources(input) { return this.lifecycle.stopMission(input); }
  putArtifact(input) { return this.artifacts.put(input); }
  getArtifact(sha256, options) { return this.artifacts.get(sha256, options); }
  artifactProjection(sha256, options) { return this.artifacts.contextProjection(sha256, options); }
  deleteArtifact(sha256, input) { return this.artifacts.delete(sha256, input); }

  snapshot() {
    const lifecycle = {
      closed: this.closed,
      memoryOperatingSystemLoaded: this._memoryOperatingSystem !== null,
      policyLoaded: this._policy !== null,
      replayLoaded: this._modelTime !== null || this._replay !== null,
      skillsLoaded: this._skillCompiler !== null || this._skillRegistry !== null || this._stability !== null,
      admissionLoaded: this._admission !== null,
      deviceDoctorLoaded: this._deviceDoctor !== null,
      artifactsLoaded: this._artifacts !== null,
      lifecycleCoordinatorLoaded: this._lifecycle !== null,
    };
    const base = {
      schema: 'forge.memory-skill-resource-plane.v1', lifecycle,
      modelTime: this._modelTime ? this._modelTime.snapshot() : null,
      replay: this._replay ? { configured: true, maxQueue: this._replay.maxQueue } : null,
      skills: this._skillRegistry ? this._skillRegistry.snapshot() : null,
      resources: this._admission ? this._admission.snapshot() : null,
      lifecycleEvents: this._lifecycle ? this._lifecycle.snapshot() : null,
      artifacts: this._artifacts ? this._artifacts.snapshot() : null,
      claims: { rawMemoryStoredInSnapshot: false, rawArtifactsStoredInSnapshot: false, automaticSkillPromotion: false, productionPolicyChanged: false, unmatchedProcessKilled: false },
    };
    return signed(base);
  }

  close() {
    if (this.closed) return this.snapshot();
    if (this._lifecycle) this._lifecycle.close();
    this.closed = true;
    return this.snapshot();
  }
}
