import { signed } from '../construction/construction-utils.mjs';
import { TaintAnalysisEngine } from './taint-analysis-engine.mjs';
import { ContextualInjectionDetector } from './contextual-injection-detector.mjs';
import { PromptInjectionQuarantine } from './prompt-injection-quarantine.mjs';
import { DependencyRiskIntelligence } from './dependency-risk-intelligence.mjs';
import { SbomProvenanceService } from './sbom-provenance-service.mjs';
import { IntegrityQuarantine } from './integrity-quarantine.mjs';
import { ExfiltrationGuard } from './exfiltration-guard.mjs';
import { MissionCapabilityTokenService } from './mission-capability-token-service.mjs';
import { AuditHashChain } from './audit-hash-chain.mjs';
import { ProtectedBoundaryGuard } from './protected-boundary-guard.mjs';
import { SandboxEscapeAdversarialSuite } from './sandbox-escape-adversarial-suite.mjs';
import { ExtendedFailureScenarioLab } from '../verification/extended-failure-scenario-lab.mjs';
import { ComparabilityContract } from '../benchmark/comparability-contract.mjs';
import { ContaminationGuard } from '../benchmark/contamination-guard.mjs';
import { RunEvidenceJournal } from '../benchmark/run-evidence-journal.mjs';
import { ComparativeCertificationService } from '../benchmark/comparative-certification-service.mjs';

export class SecurityCertificationPlane {
  constructor({ clock = Date.now, minimumTasks = 20, secretScanner = undefined } = {}) {
    this.clock = clock; this.minimumTasks = minimumTasks; this.secretScanner = secretScanner; this.closed = false;
    this._taint = null; this._injection = null; this._quarantine = null; this._dependency = null; this._sbom = null; this._integrity = null; this._exfiltration = null; this._missionTokens = null; this._audit = null; this._boundary = null; this._sandbox = null; this._failure = null; this._comparability = null; this._contamination = null; this._evidenceJournal = null; this._certification = null;
  }
  #open() { if (this.closed) throw new Error('Security Certification Plane is closed'); }
  get taint() { this.#open(); return this._taint ??= new TaintAnalysisEngine(); }
  get injection() { this.#open(); return this._injection ??= new ContextualInjectionDetector(); }
  get quarantine() { this.#open(); return this._quarantine ??= new PromptInjectionQuarantine({ secretScanner: this.secretScanner }); }
  get dependency() { this.#open(); return this._dependency ??= new DependencyRiskIntelligence(); }
  get sbom() { this.#open(); return this._sbom ??= new SbomProvenanceService(); }
  get integrity() { this.#open(); return this._integrity ??= new IntegrityQuarantine(); }
  get exfiltration() { this.#open(); return this._exfiltration ??= new ExfiltrationGuard({ secretScanner: this.secretScanner }); }
  get missionTokens() { this.#open(); return this._missionTokens ??= new MissionCapabilityTokenService({ clock: this.clock }); }
  get audit() { this.#open(); return this._audit ??= new AuditHashChain(); }
  get boundary() { this.#open(); return this._boundary ??= new ProtectedBoundaryGuard(); }
  get sandbox() { this.#open(); return this._sandbox ??= new SandboxEscapeAdversarialSuite(); }
  get failure() { this.#open(); return this._failure ??= new ExtendedFailureScenarioLab({ clock: this.clock }); }
  get comparability() { this.#open(); return this._comparability ??= new ComparabilityContract(); }
  get contamination() { this.#open(); return this._contamination ??= new ContaminationGuard(); }
  get evidenceJournal() { this.#open(); return this._evidenceJournal ??= new RunEvidenceJournal(); }
  get certification() { this.#open(); return this._certification ??= new ComparativeCertificationService({ minimumTasks: this.minimumTasks }); }

  analyzeTaint(input) { return this.taint.analyze(input); }
  detectContextualInjection(input) { return this.injection.detect(input); }
  quarantinePromptInjection(input) { return this.quarantine.screen(input); }
  assessDependency(input) { return this.dependency.assess(input); }
  generateSbom(input) { return this.sbom.generate(input); }
  evaluateIntegrity(input) { return this.integrity.evaluate(input); }
  inspectExfiltration(input) { return this.exfiltration.inspect(input); }
  issueMissionToken(input) { return this.missionTokens.issue(input); }
  authorizeMissionToken(input) { return this.missionTokens.authorize(input); }
  revokeMissionToken(input) { return this.missionTokens.revoke(input); }
  appendAudit(input) { return this.audit.append(input); }
  verifyAudit(input) { return this.audit.verify(input); }
  authorizeProtectedBoundary(input) { return this.boundary.authorizeChange(input); }
  runSandboxEscape(input) { return this.sandbox.run(input); }
  runExtendedFailure(input) { return this.failure.run(input); }
  verifyBenchmarkComparability(input) { return this.comparability.verify(input); }
  assessBenchmarkContamination(input) { return this.contamination.assess(input); }
  recordBenchmarkEvidence(input) { return this.evidenceJournal.record(input); }
  certifyComparison(input) { return this.certification.certify(input); }

  snapshot() {
    return signed({
      schema: 'forge.security-certification-plane-snapshot.v1',
      lifecycle: {
        closed: this.closed, taintLoaded: this._taint !== null, injectionLoaded: this._injection !== null, quarantineLoaded: this._quarantine !== null,
        dependencyLoaded: this._dependency !== null, sbomLoaded: this._sbom !== null, integrityLoaded: this._integrity !== null, exfiltrationLoaded: this._exfiltration !== null,
        missionTokensLoaded: this._missionTokens !== null, auditLoaded: this._audit !== null, boundaryLoaded: this._boundary !== null, sandboxLoaded: this._sandbox !== null,
        failureLoaded: this._failure !== null, comparabilityLoaded: this._comparability !== null, contaminationLoaded: this._contamination !== null,
        evidenceJournalLoaded: this._evidenceJournal !== null, certificationLoaded: this._certification !== null,
      },
      auditEntries: this._audit?.entries?.length ?? 0,
      benchmarkEvidenceEntries: this._evidenceJournal?.entries?.length ?? 0,
      claims: { rawPayloadStored: false, rawPromptStored: false, secretMaterialStored: false, fakeProviderCertified: false, comparativeSuperiorityProven: false },
    });
  }
  close() { if (this._missionTokens?.records) this._missionTokens.records.clear(); this.closed = true; return this.snapshot(); }
}
