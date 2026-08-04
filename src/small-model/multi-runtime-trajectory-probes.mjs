const labels = (toolRouter, contextScorer, testSelector, patchRanker, riskClassifier) => Object.freeze({ toolRouter, contextScorer, testSelector, patchRanker, riskClassifier });

export const MULTI_RUNTIME_TRAJECTORY_PROBES = Object.freeze([
  Object.freeze({
    id: 'multi-node-context-utility', projectId: 'nolane-node', projectRoot: '.', runtime: 'node', argv: ['--test', 'tests/context-utility-selector.test.mjs'],
    sourcePaths: ['src/context/context-utility-selector.mjs'], testPaths: ['tests/context-utility-selector.test.mjs'], kind: 'tool-policy', actionType: 'read',
    state: { evidenceFamily: 'multi-runtime-context', scenarioGroup: 'node-context-utility', labels: labels('read', 'pin', 'unit', 'accept', 'low') },
  }),
  Object.freeze({
    id: 'multi-node-release-non-claim', projectId: 'nolane-node', projectRoot: '.', runtime: 'node', argv: ['--test', 'tests/release-non-claim-manifest.test.mjs'],
    sourcePaths: ['src/release/non-claim-manifest.mjs'], testPaths: ['tests/release-non-claim-manifest.test.mjs'], kind: 'recovery', actionType: 'rollback',
    state: { evidenceFamily: 'multi-runtime-release', scenarioGroup: 'node-release-non-claim', labels: labels('rollback', 'pin', 'full', 'rollback', 'high') },
  }),
  Object.freeze({
    id: 'multi-node-browser-injection', projectId: 'nolane-node', projectRoot: '.', runtime: 'node', argv: ['--test', 'tests/browser-injection-guard.test.mjs'],
    sourcePaths: ['src/browser/browser-injection-guard.mjs'], testPaths: ['tests/browser-injection-guard.test.mjs'], kind: 'verification', actionType: 'stop',
    state: { evidenceFamily: 'multi-runtime-browser-security', scenarioGroup: 'node-browser-injection', labels: labels('stop', 'exclude', 'mutation', 'reject', 'critical') },
  }),
  Object.freeze({
    id: 'multi-go-launcher-update', projectId: 'launcher-go', projectRoot: 'launcher', runtime: 'go', argv: ['test', './...'],
    sourcePaths: ['update.go', 'electron_runtime.go'], testPaths: ['update_test.go', 'electron_runtime_test.go'], kind: 'verification', actionType: 'test',
    state: { evidenceFamily: 'multi-runtime-launcher', scenarioGroup: 'go-launcher-update', labels: labels('test', 'support', 'full', 'review', 'high') },
  }),
  Object.freeze({
    id: 'multi-go-pty', projectId: 'native-pty-go', projectRoot: 'native/pty', runtime: 'go', argv: ['test', './...'],
    sourcePaths: ['main.go'], testPaths: ['main_test.go'], kind: 'verification', actionType: 'test',
    state: { evidenceFamily: 'multi-runtime-terminal', scenarioGroup: 'go-native-pty', labels: labels('test', 'support', 'integration', 'review', 'medium') },
  }),
  Object.freeze({
    id: 'multi-go-credential', projectId: 'native-credential-go', projectRoot: 'native/credential', runtime: 'go', argv: ['test', './...'],
    sourcePaths: ['main.go'], testPaths: ['main_test.go'], kind: 'verification', actionType: 'stop',
    state: { evidenceFamily: 'multi-runtime-credential', scenarioGroup: 'go-native-credential', labels: labels('stop', 'exclude', 'mutation', 'reject', 'critical') },
  }),
  Object.freeze({
    id: 'multi-python-sdk', projectId: 'python-sdk', projectRoot: 'sdk/python', runtime: 'python', argv: ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'],
    sourcePaths: ['nolane_agent/client.py', 'forge_studio/client.py'], testPaths: ['tests/test_client.py'], kind: 'verification', actionType: 'test',
    state: { evidenceFamily: 'multi-runtime-sdk', scenarioGroup: 'python-sdk-client', labels: labels('test', 'support', 'integration', 'review', 'medium') },
  }),
]);
