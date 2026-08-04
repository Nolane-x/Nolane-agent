const labels = (toolRouter, contextScorer, testSelector, patchRanker, riskClassifier) => Object.freeze({ toolRouter, contextScorer, testSelector, patchRanker, riskClassifier });

export const MUTATION_RECOVERY_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'node-release-claim-recovery', projectId: 'nolane-node', projectRoot: '.', runtime: 'node', argv: ['--test', 'tests/release-non-claim-manifest.test.mjs'],
    sourcePath: 'src/release/non-claim-manifest.mjs', testPaths: ['tests/release-non-claim-manifest.test.mjs'],
    mutation: { from: 'if (value !== false) throw new Error(`Protected claim ${key} must remain false`);', to: 'if (false) throw new Error(`Protected claim ${key} must remain false`);' },
    repair: { from: 'if (false) throw new Error(`Protected claim ${key} must remain false`);', to: 'if (value !== false) throw new Error(`Protected claim ${key} must remain false`);' },
    state: { scenarioGroup: 'node-release-claim-recovery', evidenceFamily: 'release-mutation-recovery', failureLabels: labels('stop', 'counter-evidence', 'mutation', 'reject', 'critical'), recoveryLabels: labels('rollback', 'pin', 'full', 'accept', 'low') },
  }),
  Object.freeze({
    id: 'go-pty-validation-recovery', projectId: 'native-pty-go', projectRoot: 'native/pty', runtime: 'go', argv: ['test', './...'],
    sourcePath: 'main.go', testPaths: ['main_test.go'],
    mutation: { from: 'if p.ID == "" {', to: 'if false {' },
    repair: { from: 'if false {', to: 'if p.ID == "" {' },
    state: { scenarioGroup: 'go-pty-validation-recovery', evidenceFamily: 'terminal-mutation-recovery', failureLabels: labels('stop', 'counter-evidence', 'mutation', 'reject', 'high'), recoveryLabels: labels('rollback', 'support', 'integration', 'accept', 'low') },
  }),
  Object.freeze({
    id: 'python-sdk-https-recovery', projectId: 'python-sdk', projectRoot: 'sdk/python', runtime: 'python', argv: ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'],
    sourcePath: 'nolane_agent/client.py', testPaths: ['tests/test_client.py'],
    mutation: { from: 'if parsed.scheme != "https" and not (parsed.scheme == "http" and loopback):', to: 'if False:' },
    repair: { from: 'if False:', to: 'if parsed.scheme != "https" and not (parsed.scheme == "http" and loopback):' },
    state: { scenarioGroup: 'python-sdk-https-recovery', evidenceFamily: 'sdk-mutation-recovery', failureLabels: labels('stop', 'exclude', 'mutation', 'reject', 'critical'), recoveryLabels: labels('rollback', 'support', 'integration', 'accept', 'low') },
  }),
]);
