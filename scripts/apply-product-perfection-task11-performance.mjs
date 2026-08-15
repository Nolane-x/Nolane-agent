import { readFile, writeFile } from 'node:fs/promises';

const file = 'scripts/capture-ui-performance-evidence.mjs';
let source = await readFile(file, 'utf8');

function replaceOnce(anchor, replacement, label) {
  const parts = source.split(anchor);
  if (parts.length !== 2) throw new Error(`${label}: expected exactly one anchor, found ${parts.length - 1}`);
  source = `${parts[0]}${replacement}${parts[1]}`;
}

replaceOnce(
  "  homeRendererMemoryBytes: 180 * 1024 * 1024,\n});",
  "  homeRendererMemoryBytes: 180 * 1024 * 1024,\n  interactiveInputP95Ms: 50,\n});",
  'interactive budget',
);

replaceOnce(
  "  Object.freeze({ id: 'control-plane', route: '/control-plane', selector: '#workspace' }),\n]);",
  "  Object.freeze({ id: 'control-plane', route: '/control-plane', selector: '#workspace' }),\n  Object.freeze({ id: 'missions', route: '/missions', selector: '.activity-page' }),\n  Object.freeze({ id: 'browser', route: '/browser', selector: '.browser-workspace' }),\n]);",
  'changed surface routes',
);

replaceOnce(
  "}\n\nfunction percentile(values, ratio) {",
  `}\n\nasync function preparePerformanceReviewFixture(baseUrl, token) {\n  const project = await apiJson(baseUrl, token, '/api/projects', {\n    method: 'POST',\n    body: {\n      name: \`Performance review fixture \${Date.now()}\`,\n      workspaceRoot: process.cwd(),\n      metadata: { evidenceFixture: 'task11-performance-review-v1' },\n    },\n  });\n  const mission = await apiJson(baseUrl, token, '/api/missions/plan', {\n    method: 'POST',\n    body: {\n      projectId: project?.id,\n      objective: 'Measure evidence-bound review interaction without weakening snapshot truth',\n      plan: {\n        summary: 'Create a bounded performance review fixture.',\n        tasks: [{\n          id: 'review',\n          title: 'Review exact diff truth',\n          objective: 'Keep review decisions bound to the current snapshot.',\n          role: 'reviewer',\n          dependencies: [],\n          allowedPaths: ['**'],\n          deniedPaths: ['.env', '.env.*'],\n        }],\n      },\n    },\n  });\n  const review = await apiJson(baseUrl, token, \`/api/agent/runs/\${encodeURIComponent(String(mission?.id ?? ''))}/diff-review\`);\n  if (!project?.id || !mission?.id || !/^[a-f0-9]{64}$/i.test(String(review?.reviewSha256 ?? ''))) {\n    throw new Error('Performance review fixture did not produce an evidence-bound review snapshot');\n  }\n  return Object.freeze({\n    projectId: String(project.id),\n    missionId: String(mission.id),\n    reviewSha256: String(review.reviewSha256),\n  });\n}\n\nfunction percentile(values, ratio) {`,
  'review fixture helper',
);

replaceOnce(
  "}\n\nfunction budgetObservation(value, target, comparator = '<=') {",
  `}\n\nasync function measureSettingsInputToPaint(page) {\n  const settingsRoute = ROUTES.find((route) => route.id === 'settings');\n  if (!settingsRoute) throw new Error('Settings performance route is missing');\n  await warmRoute(page, settingsRoute);\n  const samples = await page.evaluate(async () => {\n    const values = ['a', 'ap', 'app', 'appe', 'appear'];\n    const durations = [];\n    const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));\n    for (const value of values) {\n      const input = document.querySelector('[data-settings-search]');\n      if (!(input instanceof HTMLInputElement)) throw new Error('Settings search input is unavailable');\n      const started = performance.now();\n      input.value = value;\n      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value.at(-1) ?? null }));\n      await nextPaint();\n      durations.push(performance.now() - started);\n    }\n    const input = document.querySelector('[data-settings-search]');\n    if (input instanceof HTMLInputElement) {\n      input.value = '';\n      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }));\n      await nextPaint();\n    }\n    return durations;\n  });\n  return Object.freeze({ samples: Object.freeze(samples), p95: percentile(samples, 0.95) });\n}\n\nfunction budgetObservation(value, target, comparator = '<=') {`,
  'input response helper',
);

replaceOnce(
  "    routeSwitchP95: budgetObservation(metrics.routeSwitchP95Ms, PERFORMANCE_BUDGETS.routeSwitchP95Ms),\n    longTaskMax:",
  "    routeSwitchP95: budgetObservation(metrics.routeSwitchP95Ms, PERFORMANCE_BUDGETS.routeSwitchP95Ms),\n    interactiveInputP95: budgetObservation(metrics.interactiveInputP95Ms, PERFORMANCE_BUDGETS.interactiveInputP95Ms),\n    longTaskMax:",
  'candidate input observation',
);

replaceOnce(
  "  let browser = null;\n  let onboardingSetup = null;\n  try {\n    onboardingSetup = await prepareOnboarding(runtimeUrl, credential);",
  "  let browser = null;\n  let onboardingSetup = null;\n  let reviewFixture = null;\n  let routes = ROUTES;\n  try {\n    onboardingSetup = await prepareOnboarding(runtimeUrl, credential);\n    reviewFixture = await preparePerformanceReviewFixture(runtimeUrl, credential);\n    routes = Object.freeze([...ROUTES, Object.freeze({ id: 'review', route: `/review/${encodeURIComponent(reviewFixture.missionId)}`, selector: '.review-detail' })]);",
  'runtime fixture setup',
);

replaceOnce(
  "    for (const route of ROUTES) await warmRoute(page, route);\n    await page.evaluate(() => { window.__nolaneLongTasks = []; window.__nolanePerfPhase = 'interaction-ready'; });\n    const routeSwitchSamplesMs = [];\n    for (let round = 0; round < 3; round += 1) {\n      for (const route of ROUTES) routeSwitchSamplesMs.push(await measureRouteSwitch(page, route));\n    }\n    const routeSwitchP95Ms = percentile(routeSwitchSamplesMs, 0.95);",
  `    const routeResourceObservations = {};\n    for (const route of routes) {\n      await warmRoute(page, route);\n      routeResourceObservations[route.id] = await cdpSnapshot(session);\n    }\n    await page.evaluate(() => { window.__nolaneLongTasks = []; window.__nolanePerfPhase = 'interaction-ready'; });\n    const routeSwitchSamplesMs = [];\n    const routeSwitchSamplesByRoute = Object.fromEntries(routes.map((route) => [route.id, []]));\n    for (let round = 0; round < 3; round += 1) {\n      for (const route of routes) {\n        const duration = await measureRouteSwitch(page, route);\n        routeSwitchSamplesMs.push(duration);\n        routeSwitchSamplesByRoute[route.id].push(duration);\n      }\n    }\n    const routeSwitchP95Ms = percentile(routeSwitchSamplesMs, 0.95);\n    const routeSwitchP95ByRoute = Object.freeze(Object.fromEntries(Object.entries(routeSwitchSamplesByRoute).map(([id, samples]) => [id, percentile(samples, 0.95)])));\n    const interactiveInput = await measureSettingsInputToPaint(page);`,
  'per-route resources and interaction samples',
);

replaceOnce(
  "    await warmRoute(page, ROUTES[0]);",
  "    await warmRoute(page, routes.find((route) => route.id === 'home') ?? routes[0]);",
  'idle home route',
);

replaceOnce(
  "      routeSwitchP95Ms,\n      routeSwitchSamplesMs: Object.freeze(routeSwitchSamplesMs),",
  "      routeSwitchP95Ms,\n      routeSwitchSamplesMs: Object.freeze(routeSwitchSamplesMs),\n      routeSwitchP95ByRoute,\n      routeResourceObservations: Object.freeze(routeResourceObservations),\n      interactiveInputP95Ms: interactiveInput.p95,\n      interactiveInputSamplesMs: interactiveInput.samples,",
  'detailed metrics',
);

replaceOnce(
  "      setup: onboardingSetup,\n      budgets: PERFORMANCE_BUDGETS,",
  "      setup: Object.freeze({ onboarding: onboardingSetup, reviewFixture }),\n      budgets: PERFORMANCE_BUDGETS,",
  'setup evidence',
);

replaceOnce(
  "        visualBudget: 'separate_ui_runtime_visual_receipt_required',",
  "        visualBudget: 'separate_ui_runtime_visual_receipt_required',\n        interactiveInput: 'settings_search_input_to_two_animation_frames_source_runtime_proxy',\n        streamingInputResponsiveness: 'not_observed_no_replayable_stream_fixture',\n        changedSurfaceRoutes: Object.freeze(['missions', 'review', 'workroom', 'browser', 'settings', 'control-plane']),",
  'observability boundaries',
);

await writeFile(file, source);
console.log(JSON.stringify({ file, changed: true }));
