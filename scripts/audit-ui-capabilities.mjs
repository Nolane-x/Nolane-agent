#!/usr/bin/env node
import { UI_CAPABILITIES, auditUiCapabilityCoverage } from '../src/ui/capability-registry.mjs';

const report = auditUiCapabilityCoverage(UI_CAPABILITIES);
console.log(JSON.stringify({ schema: 'nolane.agent.ui-capability-audit.v1', product: 'Nolane Agent', ...report }, null, 2));
if (report.duplicateIds.length || report.duplicateRoutes.length || report.missingLegacyCenters.length || report.missingRequiredSurfaces.length) process.exitCode = 1;
