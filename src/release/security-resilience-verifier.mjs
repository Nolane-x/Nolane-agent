import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';
const SHA = /^[a-f0-9]{64}$/i;
async function source(root, file, failures) { try { return await readFile(path.join(root, file), 'utf8'); } catch { failures.push(`missing ${file}`); return ''; } }
async function present(root, file, failures) { try { await access(path.join(root, file)); } catch { failures.push(`missing ${file}`); } }
function required(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }
function expectedAuditFor(version) { return expectedFrontierAuditCounts(version); }
export async function verifySecurityResilience({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? ''); const failures = [];
  const files = ['src/security/taint-analysis-engine.mjs','src/security/contextual-injection-detector.mjs','src/security/prompt-injection-quarantine.mjs','src/security/dependency-risk-intelligence.mjs','src/security/sbom-provenance-service.mjs','src/security/integrity-quarantine.mjs','src/security/exfiltration-guard.mjs','src/security/mission-capability-token-service.mjs','src/security/audit-hash-chain.mjs','src/security/protected-boundary-guard.mjs','src/security/sandbox-escape-adversarial-suite.mjs','src/verification/extended-failure-scenario-lab.mjs','src/security/security-certification-plane.mjs','tests/taint-analysis-engine.test.mjs','tests/contextual-injection-security.test.mjs','tests/supply-chain-security.test.mjs','tests/security-boundary-protection.test.mjs','tests/security-adversarial-runtime.test.mjs','tests/security-certification-http-ui.test.mjs'];
  for (const file of files) await present(root, file, failures);
  const [taint, injection, quarantine, supply, exfiltration, auditChain, sandbox, failureLab, plane, routes, app] = await Promise.all(['src/security/taint-analysis-engine.mjs','src/security/contextual-injection-detector.mjs','src/security/prompt-injection-quarantine.mjs','src/security/dependency-risk-intelligence.mjs','src/security/exfiltration-guard.mjs','src/security/audit-hash-chain.mjs','src/security/sandbox-escape-adversarial-suite.mjs','src/verification/extended-failure-scenario-lab.mjs','src/security/security-certification-plane.mjs','src/server/routes.mjs','src/app.mjs'].map((file) => source(root, file, failures)));
  required(taint, /typed-sanitizer-mismatch[\s\S]*completeDataFlowAnalysis:\s*false/, 'typed taint mismatch and bounded claim', failures);
  required(injection, /shell[\s\S]*sql[\s\S]*path[\s\S]*template[\s\S]*dynamic-code[\s\S]*prompt/, 'six contextual injection sinks', failures);
  required(quarantine, /contentIncluded:\s*false[\s\S]*secretMaterialStored:\s*false/, 'prompt quarantine privacy', failures);
  required(supply, /(?=[\s\S]*critical-vulnerability)(?=[\s\S]*malicious-package-signal)(?=[\s\S]*compatibility-unverified)/, 'dependency security intelligence', failures);
  required(exfiltration, /prompt[\s\S]*context[\s\S]*memory[\s\S]*trace[\s\S]*log[\s\S]*artifact[\s\S]*network/, 'secret exfiltration boundaries', failures);
  required(auditChain, /(?=[\s\S]*previousReceiptSha256)(?=[\s\S]*status:\s*'tampered')/, 'hash-chain tamper evidence', failures);
  required(sandbox, /symlink-escape[\s\S]*junction-escape[\s\S]*child-process-escape[\s\S]*credential-escape[\s\S]*crossPlatformCertificationComplete:\s*false/, 'sandbox escape adversarial suite', failures);
  required(failureLab, /network-loss[\s\S]*fd-exhaustion[\s\S]*disk-full[\s\S]*stale-file-race[\s\S]*directHostFaultInjected:\s*false/, 'bounded failure scenarios', failures);
  required(plane, /analyzeTaint[\s\S]*runSandboxEscape[\s\S]*runExtendedFailure[\s\S]*comparativeSuperiorityProven:\s*false/, 'lazy security certification plane', failures);
  required(routes, /api\/security-certification\/snapshot[\s\S]*dependency\/assess[\s\S]*boundary\/authorize/, 'principal-bound security HTTP surface', failures);
  if (/SecurityCertificationPlane/.test(app)) failures.push('src/app.mjs must not directly import SecurityCertificationPlane');
  let measurement = null; try { measurement = JSON.parse(await source(root, `docs/security-certification-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    for (const [label, value] of Object.entries({ taintBlocked: measurement.security?.taintBlocked, promptQuarantined: measurement.security?.promptQuarantined, dependencyQuarantined: measurement.security?.dependencyQuarantined, exfiltrationBlocked: measurement.security?.exfiltrationBlocked, auditTamperDetected: measurement.security?.auditTamperDetected, sandboxEscapeBlocked: measurement.adversarial?.sandboxEscapeBlocked, failureRecovered: measurement.adversarial?.failureRecovered, httpBounded: measurement.surfaces?.httpBounded, webEvidenceOnly: measurement.surfaces?.webEvidenceOnly, vscodeBounded: measurement.surfaces?.vscodeBounded })) if (value !== true) failures.push(`${label} not measured`);
    if (measurement.adversarial?.directHostFaultInjected !== false) failures.push('direct host fault non-claim violated');
    if (measurement.composition?.appStaticImports > 160 || measurement.composition?.appConstructors > 180) failures.push('composition budget exceeded');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256; if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }
  let audit = null; try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('audit JSON invalid'); }
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expectedAuditFor(releaseVersion))) failures.push('frontier audit transition mismatch');
  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures); for (const phrase of ['does not certify direct host fault injection','does not certify a complete platform matrix','does not claim comparative superiority']) if (!limitations.includes(phrase)) failures.push(`missing limitation: ${phrase}`);
  const base = { schema: 'forge.studio.security-resilience-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', failures, measurement, boundaries: measurement?.boundaries ?? {} }; const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) throw Object.assign(new Error(`Security Resilience verification failed: ${failures.join('; ')}`), { report }); return report;
}
