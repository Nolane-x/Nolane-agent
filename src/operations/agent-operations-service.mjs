import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const ACTIVE = new Set(['queued', 'planning', 'running', 'review', 'paused', 'blocked']);

function text(value, max = 500) { return value == null ? null : String(value).slice(0, max); }
function strings(value, max = 128) { return Object.freeze([...(Array.isArray(value) ? value : [])].slice(0, max).map((item) => String(item).slice(0, 240))); }
function bounded(value, max) { return Object.freeze([...(Array.isArray(value) ? value : [])].slice(0, max)); }
function requireText(value, label) { const result = String(value ?? '').trim(); if (!result) throw new TypeError(`${label} is required`); return result; }
function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }

function providerView(item = {}) {
  return freeze({
    id: text(item.id, 128), label: text(item.label, 240), kind: text(item.kind, 80),
    capabilities: strings(item.capabilities), specialties: strings(item.specialties),
    qualityTier: Number.isFinite(Number(item.qualityTier)) ? Number(item.qualityTier) : null,
    costTier: Number.isFinite(Number(item.costTier)) ? Number(item.costTier) : null,
    latencyTier: Number.isFinite(Number(item.latencyTier)) ? Number(item.latencyTier) : null,
    local: item.local === true, available: item.available !== false,
    authenticated: item.authenticated !== false, healthy: item.healthy !== false,
    version: text(item.version, 120), authMode: text(item.authMode, 80), planType: text(item.planType, 80), error: text(item.error, 240),
  });
}

function toolView(item = {}) {
  return freeze({ name: text(item.name, 160), source: text(item.source, 120), tags: strings(item.tags, 32), capability: text(item.capability, 120), description: text(item.description, 500), pinned: item.pinned === true, hasFullSchema: item.hasFullSchema === true });
}

function mcpServerView(item = {}) {
  return freeze({ id: text(item.id, 160), label: text(item.label ?? item.name, 240), kind: text(item.kind, 80), state: text(item.state ?? item.status, 80), serverInfo: item.serverInfo ? freeze({ name: text(item.serverInfo.name, 160), version: text(item.serverInfo.version, 120) }) : null });
}
function mcpToolView(item = {}) { return freeze({ name: text(item.name, 200), originalName: text(item.originalName, 160), serverId: text(item.serverId, 160), description: text(item.description, 500) }); }
function capabilityView(item = {}) { return freeze({ id: text(item.id, 160), risk: text(item.risk, 40), approval: text(item.approval, 40) }); }
function scopeView(scope = {}) { return freeze({ paths: strings(scope.paths), domains: strings(scope.domains), commands: strings(scope.commands), arguments: strings(scope.arguments), repositories: strings(scope.repositories), tools: strings(scope.tools) }); }
function grantView(item = {}) {
  return freeze({ id: text(item.id, 200), principalId: text(item.principalId, 240), capabilities: strings(item.capabilities), effect: text(item.effect, 20), mode: text(item.mode, 20), sessionId: text(item.sessionId, 240), expiresAt: text(item.expiresAt, 80), scope: scopeView(item.scope), reason: text(item.reason, 1_000), expectedImpact: text(item.expectedImpact, 1_000), approvedBy: text(item.approvedBy, 240), createdAt: text(item.createdAt, 80), usesRemaining: item.usesRemaining == null ? null : Number(item.usesRemaining), revokedAt: text(item.revokedAt, 80), revokedBy: text(item.revokedBy, 240), revocationReason: text(item.revocationReason, 1_000), receiptSha256: /^[a-f0-9]{64}$/i.test(String(item.receiptSha256 ?? '')) ? String(item.receiptSha256) : null });
}
function missionView(item = {}) { return freeze({ id: text(item.id, 200), projectId: text(item.projectId, 200), title: text(item.title ?? item.objective, 500), status: text(item.status, 80), providerId: text(item.providerId, 160), createdAt: text(item.createdAt, 80), updatedAt: text(item.updatedAt, 80) }); }
function taskView(item = {}) { return freeze({ id: text(item.id, 200), missionId: text(item.missionId, 200), projectId: text(item.projectId, 200), title: text(item.title ?? item.objective, 500), role: text(item.role, 120), status: text(item.status, 80), providerId: text(item.providerId, 160), createdAt: text(item.createdAt, 80), updatedAt: text(item.updatedAt, 80) }); }
function profileView(item = {}) { return freeze({ id: text(item.id, 160), description: text(item.description, 500), tools: strings(item.tools), exclusiveTools: strings(item.exclusiveTools), mcpServers: strings(item.mcpServers), skills: strings(item.skills), capabilities: strings(item.capabilities), maxTurns: Number(item.maxTurns ?? 0), budgetTokens: Number(item.budgetTokens ?? 0), allowChildAgents: item.allowChildAgents === true, sandboxProfile: text(item.sandboxProfile, 80), source: text(item.source, 500) }); }

export class AgentOperationsService {
  constructor({ version, providers, adaptiveIntelligence = null, operatingPlane = null, toolCatalog = null, mcpRegistry = null, capabilityRegistry = null, capabilityLedger = null, store, limits = {} } = {}) {
    if (!providers?.publicView) throw new TypeError('AgentOperationsService providers are required');
    if (!store?.listMissions || !store?.listTasks) throw new TypeError('AgentOperationsService store is required');
    this.version = String(version ?? '0.0.0'); this.providers = providers; this.adaptiveIntelligence = adaptiveIntelligence; this.operatingPlane = operatingPlane; this.toolCatalog = toolCatalog; this.mcpRegistry = mcpRegistry; this.capabilityRegistry = capabilityRegistry; this.capabilityLedger = capabilityLedger; this.store = store;
    this.limits = Object.freeze({ providers: Math.min(128, Number(limits.providers) || 64), tools: Math.min(2_000, Number(limits.tools) || 1_000), mcp: Math.min(2_000, Number(limits.mcp) || 1_000), grants: Math.min(2_000, Number(limits.grants) || 1_000), work: Math.min(2_000, Number(limits.work) || 1_000), profiles: Math.min(256, Number(limits.profiles) || 128) });
  }

  async snapshot({ projectId, principalId } = {}) {
    const project = requireText(projectId, 'projectId');
    const principal = requireText(principalId, 'An authenticated principal');
    const [adaptive, operating, mcpTools] = await Promise.all([
      this.adaptiveIntelligence?.status?.() ?? null,
      this.operatingPlane?.status?.() ?? null,
      this.mcpRegistry?.listTools?.().catch(() => []) ?? [],
    ]);
    let profiles = []; let profilesState = this.operatingPlane?.listProfiles ? 'ready' : 'unavailable'; let profilesReason = null;
    if (this.operatingPlane?.listProfiles) {
      try { profiles = await this.operatingPlane.listProfiles(project); }
      catch (error) { profilesState = 'blocked'; profilesReason = String(error?.code ?? 'PROFILE_INVENTORY_UNAVAILABLE').slice(0, 120); }
    }
    const providers = bounded(this.providers.publicView().map(providerView), this.limits.providers);
    const tools = bounded((this.toolCatalog?.summaries?.() ?? []).map(toolView), this.limits.tools);
    const servers = bounded((this.mcpRegistry?.publicView?.() ?? []).map(mcpServerView), this.limits.mcp);
    const normalizedMcpTools = bounded(mcpTools.map(mcpToolView), this.limits.mcp);
    const definitions = bounded((this.capabilityRegistry?.list?.() ?? []).map(capabilityView), 128);
    const grants = bounded((this.capabilityLedger?.listGrants?.() ?? []).map(grantView), this.limits.grants);
    const missions = bounded(this.store.listMissions({ projectId: project }).map(missionView), this.limits.work);
    const tasks = bounded(this.store.listTasks({ projectId: project }).map(taskView), this.limits.work);
    const safeProfiles = bounded(profiles.map(profileView), this.limits.profiles);
    const base = {
      schema: 'forge.agent-operations-center.v1', version: this.version, projectId: project, principalId: principal,
      generatedAt: new Date().toISOString(),
      summary: freeze({
        providers: providers.length,
        providersReady: providers.filter((item) => item.available && item.authenticated && item.healthy).length,
        tools: tools.length, pinnedTools: tools.filter((item) => item.pinned).length,
        mcpServers: servers.length, mcpTools: normalizedMcpTools.length,
        capabilityDefinitions: definitions.length,
        activeGrants: grants.filter((item) => !item.revokedAt && (item.usesRemaining == null || item.usesRemaining > 0)).length,
        missions: missions.length, activeMissions: missions.filter((item) => ACTIVE.has(item.status)).length,
        tasks: tasks.length, activeTasks: tasks.filter((item) => ACTIVE.has(item.status)).length,
        profiles: safeProfiles.length,
      }),
      providers, tools,
      mcp: freeze({ servers, tools: normalizedMcpTools }),
      capabilities: definitions, grants,
      planes: freeze({ adaptive, operating }),
      agents: freeze({ missions, tasks, profiles: safeProfiles, profilesState, profilesReason }),
    };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
