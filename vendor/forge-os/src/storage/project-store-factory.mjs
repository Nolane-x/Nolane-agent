import path from 'node:path';
import { ProjectStore } from '../core/project-store.mjs';
import { SqliteProjectStore } from './sqlite-project-store.mjs';

export function createProjectStore({ backend = 'sqlite', dataDir = path.resolve('.forgeos-data'), sqliteFile = null, jsonOptions = {}, sqliteOptions = {} } = {}) {
  if (backend === 'sqlite') return new SqliteProjectStore(sqliteFile ?? path.join(path.resolve(dataDir), 'forgeos.sqlite'), sqliteOptions);
  if (backend === 'json') return new ProjectStore(path.resolve(dataDir), jsonOptions);
  throw new TypeError(`Unsupported project storage backend: ${backend}`);
}
