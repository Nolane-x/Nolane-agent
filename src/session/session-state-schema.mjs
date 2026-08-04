import { createHash } from 'node:crypto';
import path from 'node:path';

export const SESSION_RESTORE_SCHEMA = 'nolane.session-restore.v1';
export const COMPOSER_DRAFT_SCHEMA = 'nolane.composer-draft.v1';
export const SESSION_STATE_VERSION = 1;
export const MAX_DRAFT_CHARS = 100_000;
export const MAX_ATTACHMENT_REFS = 32;

const EXPERIENCE_LEVELS = new Set(['everyday', 'workspace', 'studio', 'expert']);
const INTENTS = new Set(['ask', 'plan', 'build', 'verify']);
const FORBIDDEN_KEY = /(api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential|authorization)/i;

function cleanString(value, { max = 512, nullable = true } = {}) {
  if (value == null || value === '') return nullable ? null : '';
  return String(value).slice(0, max);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function stateReceipt(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function rejectSensitiveKeys(value, prefix = '') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_KEY.test(key)) throw Object.assign(new Error(`Sensitive field ${full} is not allowed in session state`), { statusCode: 400, code: 'session_sensitive_field' });
    rejectSensitiveKeys(child, full);
  }
}

export function normalizeRoute(value = '/') {
  const route = String(value || '/').trim().slice(0, 2_048);
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('\0')) throw Object.assign(new Error('Session route must be an application-relative route'), { statusCode: 400, code: 'session_route_invalid' });
  return route;
}

export function normalizeExperienceLevel(value = 'everyday') {
  const level = String(value || 'everyday');
  if (!EXPERIENCE_LEVELS.has(level)) throw Object.assign(new Error(`Unsupported experience level: ${level}`), { statusCode: 400, code: 'session_experience_invalid' });
  return level;
}

function normalizeRelativePath(value) {
  if (value == null || value === '') return null;
  const input = String(value).replaceAll('\\', '/').slice(0, 2_048);
  if (path.posix.isAbsolute(input) || input.split('/').includes('..') || input.includes('\0')) throw Object.assign(new Error('Attachment reference path must stay relative to a trusted project'), { statusCode: 400, code: 'session_attachment_path_invalid' });
  return input;
}

export function normalizeAttachmentRefs(value = []) {
  if (!Array.isArray(value)) throw Object.assign(new TypeError('attachmentRefs must be an array'), { statusCode: 400, code: 'session_attachment_refs_invalid' });
  return Object.freeze(value.slice(0, MAX_ATTACHMENT_REFS).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Object.assign(new TypeError(`attachmentRefs[${index}] must be an object`), { statusCode: 400, code: 'session_attachment_ref_invalid' });
    rejectSensitiveKeys(item, `attachmentRefs.${index}`);
    return Object.freeze({
      id: cleanString(item.id, { max: 256, nullable: false }),
      kind: cleanString(item.kind ?? 'reference', { max: 64, nullable: false }),
      name: cleanString(item.name, { max: 512 }),
      projectId: cleanString(item.projectId, { max: 256 }),
      relativePath: normalizeRelativePath(item.relativePath),
      artifactId: cleanString(item.artifactId, { max: 256 })
    });
  }));
}

export function initialSessionRestore(now) {
  return Object.freeze({
    schema: SESSION_RESTORE_SCHEMA,
    version: SESSION_STATE_VERSION,
    activeRoute: '/',
    experienceLevel: 'everyday',
    activeConversationId: null,
    missionId: null,
    projectId: null,
    openArtifactId: null,
    selectedTab: null,
    attachmentRefs: Object.freeze([]),
    view: Object.freeze({ summaryOpen: false }),
    createdAt: now,
    updatedAt: now
  });
}

export function normalizeSessionRestorePatch(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new TypeError('Session restore patch must be an object'), { statusCode: 400, code: 'session_restore_patch_invalid' });
  rejectSensitiveKeys(value);
  const patch = {};
  if ('activeRoute' in value) patch.activeRoute = normalizeRoute(value.activeRoute);
  if ('experienceLevel' in value) patch.experienceLevel = normalizeExperienceLevel(value.experienceLevel);
  for (const key of ['activeConversationId', 'missionId', 'projectId', 'openArtifactId', 'selectedTab']) {
    if (key in value) patch[key] = cleanString(value[key], { max: 512 });
  }
  if ('attachmentRefs' in value) patch.attachmentRefs = normalizeAttachmentRefs(value.attachmentRefs);
  if ('view' in value) {
    if (!value.view || typeof value.view !== 'object' || Array.isArray(value.view)) throw Object.assign(new TypeError('Session view state must be an object'), { statusCode: 400, code: 'session_view_invalid' });
    patch.view = Object.freeze({
      summaryOpen: Boolean(value.view.summaryOpen),
      workspaceScrollTop: Math.max(0, Math.min(10_000_000, Number(value.view.workspaceScrollTop) || 0)),
      sidebarScrollTop: Math.max(0, Math.min(10_000_000, Number(value.view.sidebarScrollTop) || 0))
    });
  }
  return Object.freeze(patch);
}

export function normalizeComposerDraft(value = {}, { scope = 'home' } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new TypeError('Composer draft must be an object'), { statusCode: 400, code: 'composer_draft_invalid' });
  rejectSensitiveKeys(value);
  const objective = String(value.objective ?? '').slice(0, MAX_DRAFT_CHARS);
  const selectionInput = Array.isArray(value.selection) ? value.selection : [objective.length, objective.length];
  const start = Math.max(0, Math.min(objective.length, Number(selectionInput[0]) || 0));
  const end = Math.max(start, Math.min(objective.length, Number(selectionInput[1]) || start));
  const intent = String(value.intent ?? 'ask');
  if (!INTENTS.has(intent)) throw Object.assign(new Error(`Unsupported composer intent: ${intent}`), { statusCode: 400, code: 'composer_intent_invalid' });
  return Object.freeze({
    schema: COMPOSER_DRAFT_SCHEMA,
    version: SESSION_STATE_VERSION,
    scope: cleanString(scope, { max: 128, nullable: false }),
    objective,
    selection: Object.freeze([start, end]),
    projectId: cleanString(value.projectId, { max: 256 }),
    intent,
    modelChoice: cleanString(value.modelChoice ?? 'auto', { max: 512, nullable: false }),
    attachmentRefs: normalizeAttachmentRefs(value.attachmentRefs ?? [])
  });
}
