import { randomUUID } from 'node:crypto';
function req(value, name) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${name} is required`); return text; }
function freeze(value) { return Object.freeze(value); }
function notFound() { throw Object.assign(new Error('SCIM resource not found'), { statusCode: 404, code: 'scim-not-found' }); }
function freezeUser(record) { return freeze({ ...record, schemas: freeze([...(record.schemas ?? [])]), name: freeze({ ...(record.name ?? {}) }), emails: freeze((record.emails ?? []).map((item) => freeze({ ...item }))), meta: freeze({ ...(record.meta ?? {}) }) }); }
function freezeGroup(record) { return freeze({ ...record, schemas: freeze([...(record.schemas ?? [])]), members: freeze((record.members ?? []).map((item) => freeze({ ...item }))), meta: freeze({ ...(record.meta ?? {}) }) }); }
function listResponse(resources, startIndex, count) { const start = Math.max(0, Number(startIndex) - 1); const size = Math.max(0, Math.min(1000, Number(count) || 100)); return freeze({ schemas: freeze(['urn:ietf:params:scim:api:messages:2.0:ListResponse']), totalResults: resources.length, startIndex: start + 1, itemsPerPage: Math.min(size, Math.max(0, resources.length - start)), Resources: freeze(resources.slice(start, start + size)) }); }

export class ScimService {
  constructor({ clock = () => Date.now(), storage = null } = {}) {
    this.clock = clock; this.storage = storage;
    const restored = storage?.loadState?.() ?? { users: [], groups: [] };
    this.users = new Map(restored.users.map((record) => [`${record.organizationId}:${record.id}`, freezeUser(record)]));
    this.groups = new Map(restored.groups.map((record) => [`${record.organizationId}:${record.id}`, freezeGroup(record)]));
  }
  #key(org, id) { return `${req(org, 'organizationId')}:${req(id, 'id')}`; }
  #assertUniqueUserName(organizationId, userName, exceptId = null) { for (const user of this.users.values()) if (user.organizationId === organizationId && user.id !== exceptId && user.userName === userName) throw Object.assign(new Error('SCIM userName already exists'), { statusCode: 409, code: 'scim-username-conflict' }); }
  createUser(organizationId, input = {}) {
    const org = req(organizationId, 'organizationId'); const id = String(input.id ?? randomUUID()); const now = new Date(this.clock()).toISOString(); const userName = req(input.userName, 'userName').toLowerCase();
    this.#assertUniqueUserName(org, userName);
    const user = freezeUser({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id, organizationId: org, userName, active: input.active !== false, name: input.name ?? {}, emails: input.emails ?? [], meta: { resourceType: 'User', created: now, lastModified: now } });
    this.users.set(this.#key(org, id), user); this.storage?.saveUser?.(user); return user;
  }
  getUser(organizationId, id) { const user = this.users.get(this.#key(organizationId, id)); if (!user) notFound(); return user; }
  replaceUser(organizationId, id, input = {}) {
    const old = this.getUser(organizationId, id); const now = new Date(this.clock()).toISOString(); const userName = req(input.userName ?? old.userName, 'userName').toLowerCase(); this.#assertUniqueUserName(old.organizationId, userName, old.id);
    const user = freezeUser({ ...old, userName, active: input.active ?? old.active, name: input.name ?? old.name, emails: input.emails ?? old.emails, meta: { ...old.meta, lastModified: now } });
    this.users.set(this.#key(organizationId, id), user); this.storage?.saveUser?.(user); return user;
  }
  deleteUser(organizationId, id) { return this.replaceUser(organizationId, id, { active: false }); }
  listUsers(organizationId, { startIndex = 1, count = 100 } = {}) { return listResponse([...this.users.values()].filter((u) => u.organizationId === organizationId), startIndex, count); }
  createGroup(organizationId, input = {}) { const id = String(input.id ?? randomUUID()); const org = req(organizationId, 'organizationId'); const members = (input.members ?? []).map((m) => { this.getUser(org, m.value); return { value: String(m.value), display: m.display ? String(m.display) : undefined }; }); const now = new Date(this.clock()).toISOString(); const group = freezeGroup({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'], id, organizationId: org, displayName: req(input.displayName, 'displayName'), members, meta: { resourceType: 'Group', created: now, lastModified: now } }); this.groups.set(this.#key(org, id), group); this.storage?.saveGroup?.(group); return group; }
  getGroup(organizationId, id) { const group = this.groups.get(this.#key(organizationId, id)); if (!group) notFound(); return group; }
  replaceGroup(organizationId, id, input = {}) { const old = this.getGroup(organizationId, id); const members = (input.members ?? old.members).map((m) => { this.getUser(organizationId, m.value); return { value: String(m.value), display: m.display ? String(m.display) : undefined }; }); const group = freezeGroup({ ...old, displayName: req(input.displayName ?? old.displayName, 'displayName'), members, meta: { ...old.meta, lastModified: new Date(this.clock()).toISOString() } }); this.groups.set(this.#key(organizationId, id), group); this.storage?.saveGroup?.(group); return group; }
  deleteGroup(organizationId, id) { const group = this.getGroup(organizationId, id); this.groups.delete(this.#key(organizationId, id)); this.storage?.deleteGroup?.(organizationId, id); return group; }
  listGroups(organizationId, { startIndex = 1, count = 100 } = {}) { return listResponse([...this.groups.values()].filter((g) => g.organizationId === organizationId), startIndex, count); }
}
