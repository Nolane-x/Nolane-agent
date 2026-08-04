import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { CapabilityRegistry } from './capability-registry.mjs';
import { CommandRiskClassifier } from './command-risk-classifier.mjs';
import { SecretScanner } from './secret-scanner.mjs';
import { ShellCommandCodec } from './shell-command-codec.mjs';

const PROTECTED_UPLOAD = /(^|\/)(?:\.env(?:\..*)?|[^/]*\.(?:pem|key|p12|pfx|kdbx)|id_(?:rsa|ed25519)|credentials|secrets?\.(?:json|ya?ml))$/i;

function required(value, label, max = 4_000) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return text;
}

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function firstDomain(input) {
  const values = [...(input.args ?? []), input.url, input.destination].filter(Boolean).map(String);
  for (const value of values) {
    const match = value.match(/https?:\/\/[^\s"']+/i);
    if (!match) continue;
    try { return new URL(match[0]).hostname.toLowerCase(); } catch {}
  }
  const remote = values.find((value) => /^[^\s:@]+@([^\s:]+):/.test(value));
  if (remote) return remote.match(/^[^\s:@]+@([^\s:]+):/)[1].toLowerCase();
  return null;
}

function unique(values) { return [...new Set(values)].sort(); }

export class CommandExecutionGovernanceService {
  constructor({
    capabilityLedger,
    approvalBundles,
    shellCodec = new ShellCommandCodec(),
    classifier = new CommandRiskClassifier(),
    secretScanner = new SecretScanner(),
    registry = capabilityLedger?.registry ?? new CapabilityRegistry(),
    clock = () => Date.now(),
    eventSink = () => {},
  } = {}) {
    if (!capabilityLedger?.authorize) throw new TypeError('capabilityLedger is required');
    if (!approvalBundles?.record) throw new TypeError('approvalBundles is required');
    this.capabilityLedger = capabilityLedger;
    this.approvalBundles = approvalBundles;
    this.shellCodec = shellCodec;
    this.classifier = classifier;
    this.secretScanner = secretScanner;
    this.registry = registry;
    this.clock = clock;
    this.eventSink = eventSink;
  }

  #resource(capability, input, validated) {
    if (['shell.run', 'system.admin', 'software.install'].includes(capability)) return { command: path.basename(validated.command), arguments: [...validated.args] };
    if (['network.use', 'file.upload'].includes(capability)) return { domain: firstDomain(input), tool: path.basename(validated.command) };
    return { tool: path.basename(validated.command) };
  }

  #scan(input, validated) {
    const findings = [];
    const redactedArgs = validated.args.map((value, index) => {
      const result = this.secretScanner.scanText(value, { source: `args[${index}]` });
      findings.push(...result.findings);
      return result.redactedText;
    });
    const redactedEnv = {};
    for (const [key, value] of Object.entries(validated.env)) {
      const result = this.secretScanner.scanText(value, { source: `env.${key}` });
      findings.push(...result.findings);
      redactedEnv[key] = result.redactedText;
    }
    const stdin = this.secretScanner.scanText(String(input.stdin ?? ''), { source: 'stdin' });
    findings.push(...stdin.findings);
    const uploadFindings = [];
    for (const item of input.uploadContents ?? []) {
      const result = this.secretScanner.scanText(String(item?.content ?? ''), { source: `upload:${String(item?.path ?? '')}` });
      uploadFindings.push(...result.findings);
    }
    return { findings, uploadFindings, redactedArgs, redactedEnv, redactedStdin: stdin.redactedText };
  }

  #receipt(input, validated, classification, scan, decision, extra = {}) {
    const preview = scan.findings.length
      ? this.shellCodec.preview({ kind: input.shellKind ?? 'bash', command: validated.command, args: scan.redactedArgs })
      : this.shellCodec.preview({ kind: input.shellKind ?? 'bash', command: validated.command, args: validated.args });
    const base = {
      schema: 'forge.command-governance.v1',
      at: new Date(this.clock()).toISOString(),
      principalId: String(input.principalId),
      sessionId: input.sessionId ? String(input.sessionId) : null,
      projectId: String(input.projectId),
      taskId: String(input.taskId),
      origin: String(input.origin ?? 'agent'),
      decision,
      command: path.basename(validated.command),
      argvSha256: canonicalSha256([validated.command, ...validated.args]),
      preview,
      categories: [...classification.categories],
      requiredCapabilities: [...extra.requiredCapabilities ?? []],
      missingCapabilities: [...extra.missingCapabilities ?? []],
      grantIds: [...extra.grantIds ?? []],
      secretFindings: [...scan.findings, ...scan.uploadFindings].map((finding) => ({ type: finding.type, source: finding.source, fingerprint: finding.fingerprint })),
      reason: extra.reason ?? null,
    };
    const receipt = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.eventSink(receipt);
    return receipt;
  }

  authorize(input = {}) {
    required(input.principalId, 'principalId', 240);
    required(input.projectId, 'projectId', 240);
    required(input.taskId, 'taskId', 240);
    const validated = this.shellCodec.validateArgv({ command: input.command, args: input.args ?? [], env: input.env ?? {} });
    const classification = this.classifier.classify({ ...input, command: validated.command, args: validated.args });
    const scan = this.#scan(input, validated);
    const baseCapabilities = unique(['shell.run', ...classification.requiredCapabilities]);

    if (String(input.origin ?? 'agent') === 'chat' && scan.findings.length) {
      const governance = this.#receipt(input, validated, classification, scan, 'deny', { requiredCapabilities: baseCapabilities, reason: 'Plaintext secrets are not accepted from chat or model-authored command fields.' });
      const error = new Error('Command denied because chat-authored fields contain a secret');
      error.code = 'COMMAND_SECRET_IN_CHAT'; error.governance = governance; throw error;
    }

    const outbound = classification.categories.includes('outbound-transfer');
    const protectedPath = (input.uploadPaths ?? []).map((value) => String(value).replaceAll('\\', '/')).find((value) => PROTECTED_UPLOAD.test(value));
    if (outbound && (protectedPath || scan.uploadFindings.length)) {
      const governance = this.#receipt(input, validated, classification, scan, 'deny', { requiredCapabilities: baseCapabilities, reason: 'Sensitive upload was blocked before network activity.' });
      const error = new Error('Sensitive upload blocked'); error.code = 'COMMAND_SENSITIVE_UPLOAD'; error.governance = governance; throw error;
    }

    const missing = [];
    const grantIds = [];
    for (const capability of baseCapabilities) {
      const decision = this.capabilityLedger.authorize({
        principalId: String(input.principalId),
        sessionId: input.sessionId ? String(input.sessionId) : null,
        capability,
        resource: this.#resource(capability, input, validated),
        consume: true,
      });
      if (decision.decision === 'allow') { if (decision.grantId) grantIds.push(decision.grantId); }
      else missing.push(capability);
    }
    if (missing.length) {
      const capability = missing[0];
      const definition = this.registry.describe(capability);
      const resource = this.#resource(capability, input, validated);
      const approvalBundle = this.approvalBundles.record({
        principalId: input.principalId,
        projectId: input.projectId,
        taskId: input.taskId,
        capability,
        approvalMode: definition.approval,
        risk: definition.risk,
        resource,
        reason: `Authorize ${capability} for the exact structured command scope.`,
      });
      const governance = this.#receipt(input, validated, classification, scan, 'ask', { requiredCapabilities: baseCapabilities, missingCapabilities: missing, grantIds, reason: 'One or more exact scoped capabilities are missing.' });
      const error = new Error('Command requires explicit scoped approval');
      error.code = 'COMMAND_APPROVAL_REQUIRED'; error.governance = governance; error.approvalBundle = approvalBundle; throw error;
    }

    return this.#receipt(input, validated, classification, scan, 'allow', { requiredCapabilities: baseCapabilities, grantIds, reason: 'All exact scoped command capabilities are active.' });
  }
}
