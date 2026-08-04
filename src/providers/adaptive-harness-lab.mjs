import path from 'node:path';

import { HarnessProfileRegistry, createBuiltInHarnessProfiles } from './harness-profile-registry.mjs';
import { HarnessRequestComposer } from './harness-request-composer.mjs';
import { classifyHarnessFailure } from './harness-failure-classifier.mjs';
import { HarnessFailureStore } from './harness-failure-store.mjs';
import { HarnessExperimentService } from './harness-experiment-service.mjs';
import { HarnessCanaryController } from './harness-canary-controller.mjs';
import { AdaptiveLearningControlPlane } from '../learning/adaptive-learning-control-plane.mjs';

export function createAdaptiveHarnessLab({ dataDir, eventSink = () => {}, minImprovement = 0.01, learning = {} } = {}) {
  const root = String(dataDir ?? '').trim();
  if (!root) throw new TypeError('adaptive harness dataDir is required');
  if (typeof eventSink !== 'function') throw new TypeError('adaptive harness eventSink must be a function');
  const profiles = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles(), eventSink });
  const composer = new HarnessRequestComposer({ registry: profiles });
  const failureStore = new HarnessFailureStore({ file: path.join(root, 'harness-failures.db') });
  const experiments = new HarnessExperimentService({ minImprovement });
  const canary = new HarnessCanaryController({ registry: profiles, eventSink });
  let closed = false;
  let learningPlane = null;
  const getLearning = () => learningPlane ??= new AdaptiveLearningControlPlane(learning);
  const learningSnapshot = () => learningPlane?.snapshot() ?? Object.freeze({ schema: 'forge.adaptive-learning-control-plane-snapshot.v1', lifecycle: Object.freeze({ loaded: false, closed }), claims: Object.freeze({ productionRoutingAuthority: false, rawPromptsStored: false, chainOfThoughtStored: false }) });

  const publicView = () => {
    if (closed) throw new Error('Adaptive harness lab is closed');
    return Object.freeze({
      profiles: profiles.publicView(),
      failures: failureStore.summary(),
      experiments: Object.freeze({ mode: 'explicit-replay', minimumCases: 4, minImprovement: experiments.minImprovement }),
      canary: canary.snapshot(),
      learning: learningPlane ? Object.freeze({ lifecycle: Object.freeze({ loaded: true, closed: learningPlane.closed }), snapshot: learningPlane.snapshot() }) : Object.freeze({ lifecycle: Object.freeze({ loaded: false, closed }), snapshot: null }),
    });
  };
  const close = () => {
    if (closed) return;
    closed = true;
    failureStore.close();
    if (learningPlane) learningPlane.close();
  };

  const api = { profiles, composer, failureClassifier: classifyHarnessFailure, failureStore, experiments, canary, publicView, learningSnapshot, close };
  Object.defineProperty(api, 'learning', { enumerable: true, get: getLearning });
  return Object.freeze(api);
}
