const USES = new Set(['chat', 'writing', 'learning', 'planning', 'software', 'advanced']);

const PROFILES = Object.freeze({
  chat: { experience: 'everyday', intent: 'ask', explanationDepth: 'balanced', responseStyle: 'direct' },
  writing: { experience: 'everyday', intent: 'ask', explanationDepth: 'balanced', responseStyle: 'collaborative' },
  learning: { experience: 'everyday', intent: 'ask', explanationDepth: 'detailed', responseStyle: 'teacher' },
  planning: { experience: 'workspace', intent: 'plan', explanationDepth: 'balanced', responseStyle: 'collaborative' },
  software: { experience: 'studio', intent: 'build', explanationDepth: 'detailed', responseStyle: 'reviewer' },
  advanced: { experience: 'expert', intent: 'plan', explanationDepth: 'research', responseStyle: 'reviewer' }
});

function cleanUse(value) { return USES.has(String(value)) ? String(value) : 'chat'; }

export function recommendedOnboardingAnswers(primaryUse = 'chat') {
  const use = cleanUse(primaryUse);
  const profile = PROFILES[use];
  return Object.freeze({
    language: 'system',
    primaryUse: use,
    explanationDepth: profile.explanationDepth,
    responseStyle: profile.responseStyle,
    askBeforeAmbiguousChanges: true,
    experience: profile.experience,
    defaultIntent: profile.intent,
    theme: 'system',
    accent: 'violet',
    density: 'comfortable',
    motion: 'system',
    memoryMode: 'approved',
    notifications: { taskCompletion: true, approvals: true, errors: true, desktop: true },
    telemetry: false
  });
}

export function onboardingAnswersToSettings(input = {}) {
  const base = recommendedOnboardingAnswers(input.primaryUse);
  const answers = {
    ...base,
    ...structuredClone(input),
    notifications: { ...base.notifications, ...(input.notifications ?? {}) }
  };
  return Object.freeze({
    experience: { level: answers.experience },
    general: { language: answers.language, defaultIntent: answers.defaultIntent },
    personalization: {
      explanationDepth: answers.explanationDepth,
      responseStyle: answers.responseStyle,
      askBeforeAmbiguousChanges: Boolean(answers.askBeforeAmbiguousChanges),
      preferredDocumentationLanguage: answers.language
    },
    appearance: { theme: answers.theme, accent: answers.accent, density: answers.density, motion: answers.motion },
    memory: { enabled: answers.memoryMode !== 'off' },
    notifications: {
      desktop: Boolean(answers.notifications.desktop),
      taskCompletion: Boolean(answers.notifications.taskCompletion),
      approvals: Boolean(answers.notifications.approvals),
      errors: Boolean(answers.notifications.errors)
    },
    data: { telemetry: Boolean(answers.telemetry) }
  });
}
