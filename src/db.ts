import { getBackendState, initBackendState, persistBackendState, updateBackendState } from './backendState';

export const DATA_STORES = [
  'users',
  'condos',
  'invoices',
  'deliveries',
  'notifications',
  'announcements',
  'commonAreas',
  'reservations',
  'votes',
  'complaints',
  'employees',
  'pixConfigs',
  'marketItems',
  'documents',
  'maintenanceRequests',
  'accessLogs',
  'lostFound',
  'supportMessages',
  'licenseCharges',
] as const;

export type DataStore = typeof DATA_STORES[number];

let _db: IDBPDatabase | null = null;

type IDBPDatabase = true;

function core() {
  return getBackendState().core;
}

function cloneList<T>(list: T[]): T[] {
  return structuredClone(list);
}

async function applyAndPersist(updater: Parameters<typeof updateBackendState>[0]): Promise<void> {
  const snapshot = updateBackendState(updater, { persist: false });
  await persistBackendState(snapshot);
}

export async function initDB(): Promise<void> {
  await initBackendState();
  _db = true;
}

function db(): IDBPDatabase {
  if (!_db) throw new Error('Backend state not initialized. Call initDB() first.');
  return _db;
}

export async function dbGetAll<T>(store: DataStore): Promise<T[]> {
  db();
  return cloneList(core()[store] as T[]);
}

export async function dbPut<T extends { id: string }>(store: DataStore, item: T): Promise<void> {
  db();
  await applyAndPersist((state) => {
    const list = [...(state.core[store] as T[])];
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) list[index] = item;
    else list.push(item);
    state.core[store] = list;
  });
}

export async function dbPutAll<T extends { id: string }>(store: DataStore, items: T[]): Promise<void> {
  db();
  if (items.length === 0) return;
  await applyAndPersist((state) => {
    const list = [...(state.core[store] as T[])];
    items.forEach((item) => {
      const index = list.findIndex((entry) => entry.id === item.id);
      if (index >= 0) list[index] = item;
      else list.push(item);
    });
    state.core[store] = list;
  });
}

export async function dbDelete(store: DataStore, id: string): Promise<void> {
  db();
  await applyAndPersist((state) => {
    state.core[store] = (state.core[store] as { id: string }[]).filter((item) => item.id !== id);
  });
}

export async function dbClear(store: DataStore): Promise<void> {
  db();
  await applyAndPersist((state) => {
    state.core[store] = [];
  });
}

export async function dbGetSetting<T>(key: string): Promise<T | null> {
  db();
  const value = getBackendState().settings[key];
  return (value ?? null) as T | null;
}

export async function dbPutSetting(key: string, value: unknown): Promise<void> {
  db();
  await applyAndPersist((state) => {
    state.settings[key] = value;
  });
}

export function idbPut<T extends { id: string }>(store: DataStore, item: T): void {
  void dbPut(store, item).catch((err: unknown) => console.error(`[API] put "${store}" failed:`, err));
}

export function idbDelete(store: DataStore, id: string): void {
  void dbDelete(store, id).catch((err: unknown) => console.error(`[API] delete "${store}/${id}" failed:`, err));
}

export function idbPutSetting(key: string, value: unknown): void {
  void dbPutSetting(key, value).catch((err: unknown) => console.error(`[API] putSetting "${key}" failed:`, err));
}
