import { resolveApiUrl } from './apiBase';

export interface BackendState {
  core: Record<string, any[]>;
  settings: Record<string, unknown>;
  marketplaceListings: any[];
  supportConversations: any[];
  waUsers: any[];
  waChats: any[];
  waMessages: any[];
  gatewayConfigs: Record<string, any>;
  maintenanceTickets: any[];
  documentsLibrary: any[];
  accessControlLogs: any[];
  lostFoundItems: any[];
}

type RequestError = Error & {
  status?: number;
  payload?: unknown;
};

let backendState: BackendState | null = null;
const listeners = new Set<() => void>();
let persistQueue: Promise<BackendState> = Promise.resolve(null as unknown as BackendState);
let mutationVersion = 0;
let lastPersistedMutationVersion = 0;

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(resolveApiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const raw = await response.text();
  let payload: unknown = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : typeof payload === 'string' && payload
          ? payload
          : `Falha na requisicao ${response.status}`;
    const error = new Error(message) as RequestError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

function cloneState<T>(value: T): T {
  return structuredClone(value);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export async function initBackendState(): Promise<BackendState> {
  backendState = await requestJson<BackendState>('/api/state');
  mutationVersion = 0;
  lastPersistedMutationVersion = 0;
  notify();
  return backendState;
}

export async function refreshBackendState(): Promise<BackendState> {
  return initBackendState();
}

export function getBackendState(): BackendState {
  if (!backendState) {
    throw new Error('Backend state ainda nao foi inicializado.');
  }

  return backendState;
}

export function subscribeBackendState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function replaceBackendState(nextState: BackendState, shouldNotify = true): BackendState {
  backendState = nextState;
  if (shouldNotify) {
    notify();
  }
  return nextState;
}

export function updateBackendState(
  updater: (draft: BackendState) => BackendState | void,
  options?: { persist?: boolean; notify?: boolean },
): BackendState {
  const current = getBackendState();
  const draft = cloneState(current);
  const updated = updater(draft) ?? draft;

  replaceBackendState(updated, options?.notify !== false);
  mutationVersion += 1;

  if (options?.persist !== false) {
    void persistBackendState(updated);
  }

  return updated;
}

export function persistBackendState(snapshot = getBackendState()): Promise<BackendState> {
  const payload = cloneState(snapshot);
  const versionAtSchedule = mutationVersion;
  persistQueue = persistQueue
    .catch(() => payload)
    .then(async () => {
      const saved = await requestJson<BackendState>('/api/state', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      replaceBackendState(saved);
      lastPersistedMutationVersion = Math.max(lastPersistedMutationVersion, versionAtSchedule);
      return saved;
    })
    .catch((error) => {
      console.error('Falha ao persistir estado no backend:', error);
      return getBackendState();
    });

  return persistQueue;
}

function hasUnsavedChanges(): boolean {
  return mutationVersion > lastPersistedMutationVersion;
}

function flushStateOnPageExit(): void {
  if (!backendState || !hasUnsavedChanges()) {
    return;
  }

  const payload = JSON.stringify(backendState);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(resolveApiUrl('/api/state'), new Blob([payload], { type: 'application/json' }));
      if (sent) {
        lastPersistedMutationVersion = mutationVersion;
      }
      return;
    }

    void fetch(resolveApiUrl('/api/state'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).then(() => {
      lastPersistedMutationVersion = mutationVersion;
    });
  } catch (error) {
    console.error('Falha ao tentar flush final do estado:', error);
  }
}

if (typeof window !== 'undefined') {
  const w = window as Window & { __inovatechStateFlushBound?: boolean };
  if (!w.__inovatechStateFlushBound) {
    w.__inovatechStateFlushBound = true;
    window.addEventListener('pagehide', flushStateOnPageExit);
    window.addEventListener('beforeunload', flushStateOnPageExit);
  }
}

export async function loginWithBackend(email: string, password: string): Promise<any> {
  try {
    const response = await fetch(resolveApiUrl('/api/auth'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.token) {
      setAuthToken(data.token);
      console.log('Token salvo:', data.token.substring(0, 20) + '...');
    }

    return data.user ?? null;
  } catch (error) {
    if ((error as RequestError).status === 401) {
      return null;
    }
    throw error;
  }
}
