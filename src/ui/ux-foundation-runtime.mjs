import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ManagedProcessRegistry } from '../execution/managed-process-registry.mjs';
import { ModelProfileRegistry } from '../providers/model-profile-registry.mjs';
import { ModelDiscoveryService } from '../providers/model-discovery-service.mjs';
import { ModelCapabilityProbeService } from '../providers/model-capability-probe-service.mjs';
import { ModelManagementService } from '../model-management/model-management-service.mjs';
import { ModelTruthPlane } from '../model-profiles/model-truth-plane.mjs';
import { ModelTruthStore } from '../model-profiles/model-truth-store.mjs';
import { UiSummaryService } from './ui-summary-service.mjs';

export async function createUxFoundationRuntime({ appRoot, dataDir, maxOutputBytes }) {
  const catalogPath = path.join(path.resolve(appRoot), 'config', 'model-families.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (catalog?.schema !== 'nolane.model-families.v1' || !Array.isArray(catalog.families)) {
    throw new TypeError('Model family catalog is invalid');
  }

  const managedProcesses = new ManagedProcessRegistry({ maxOutputBytes });
  const modelProfiles = new ModelProfileRegistry({ families: catalog.families });
  const modelTruthStore = new ModelTruthStore({ file: dataDir ? path.join(path.resolve(dataDir), 'model-intelligence', 'model-truth-store.json') : null });
  const modelTruth = new ModelTruthPlane({ registry: modelProfiles.intelligenceRegistry, store: modelTruthStore });
  modelProfiles.attachTruthPlane(modelTruth);
  const modelDiscovery = new ModelDiscoveryService();
  let modelProbes = null;
  let modelManager = null;

  return Object.freeze({
    managedProcesses,
    modelProfiles,
    modelDiscovery,
    bindProviders(providers) {
      modelProbes ??= new ModelCapabilityProbeService({ getProvider: (providerId) => providers.get(providerId) });
      modelManager ??= new ModelManagementService({ registry: modelProfiles.intelligenceRegistry, truthPlane: modelTruth, providerInventory: () => providers.publicView() });
      return Object.freeze({ modelProfiles, modelDiscovery, modelProbes, modelManager, modelTruth });
    },
    createSummary(options) {
      return new UiSummaryService({ ...options, managedProcesses });
    },
    close() {
      return managedProcesses.close();
    },
  });
}
