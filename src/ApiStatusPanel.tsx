﻿import { useEffect, useMemo, useState } from 'react';
import type { User } from './types';

interface ConnectionStatusItem {
  id: string;
  category: 'infra' | 'storage' | 'internal-api' | 'gateway-master' | 'gateway-condo';
  name: string;
  status: 'online' | 'error' | 'warning' | 'not_configured';
}

interface StatusResponse {
  timestamp: string;
  connections: ConnectionStatusItem[];
}

const AUTO_REFRESH_MS = 12000;

function getToken() {
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
}

function statusIcon(status: ConnectionStatusItem['status']) {
  switch (status) {
    case 'online':
      return '✅';
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'not_configured':
      return '⚪';
    default:
      return '⚪';
  }
}

function statusClass(status: ConnectionStatusItem['status']) {
  switch (status) {
    case 'online':
      return 'bg-emerald-50 border-emerald-200';
    case 'error':
      return 'bg-rose-50 border-rose-200';
    case 'warning':
      return 'bg-amber-50 border-amber-200';
    case 'not_configured':
      return 'bg-slate-50 border-slate-200';
    default:
      return 'bg-slate-50 border-slate-200';
  }
}

export function ApiStatusPanel({ user: _user }: { user: User }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<StatusResponse | null>(null);

  async function loadStatus(showLoader = false) {
    try {
      if (showLoader) setLoading(true);
      const token = getToken();
      const response = await fetch('/api/admin/status', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Falha ao carregar status das APIs.');
      }

      const payload = (await response.json()) as StatusResponse;
      setData(payload);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Error ao carregar status das APIs.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function manualRefresh() {
    setRefreshing(true);
    await loadStatus(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadStatus(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadStatus(false);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, []);

  const items = useMemo(() => {
    const all = (data?.connections || []).filter((item) =>
      item.category === 'internal-api' || item.category === 'gateway-master' || item.category === 'gateway-condo'
    );
    return [...all].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [data]);

  const onlineCount = items.filter((item) => item.status === 'online').length;

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-2 py-2 sm:px-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-600">
          Carregando status das APIs...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-2 sm:px-3">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-gray-800">Back-end e APIs</h2>
            <p className="text-[11px] font-semibold text-gray-500">
              {onlineCount}/{items.length} online
            </p>
          </div>
          <button
            onClick={() => void manualRefresh()}
            disabled={refreshing}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
          >
            {refreshing ? '...' : '↻'}
          </button>
        </div>

        {error && (
          <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="px-3 py-5 text-center text-sm text-gray-500">Nenhuma API encontrada.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className={`flex items-center justify-between px-3 py-2 ${statusClass(item.status)}`}>
                <p className="truncate pr-3 text-sm font-semibold text-gray-800">{item.name}</p>
                <span className="text-base" title={item.status}>
                  {statusIcon(item.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
