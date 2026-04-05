import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types';

type LiveStatus = 'on' | 'off';
type ProbeMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'registered';
type StatusFilter = 'ALL' | LiveStatus;

interface RouteLiveItem {
  id: string;
  method: string;
  path: string;
  source: string;
  status: LiveStatus;
  probeMethod: ProbeMethod;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string | null;
  error: string | null;
}

interface RoutesLivePayload {
  timestamp: string;
  server: {
    status: LiveStatus;
    latencyMs: number | null;
    statusCode: number | null;
    checkedAt: string | null;
  };
  summary: {
    total: number;
    on: number;
    off: number;
    registeredOnly: number;
  };
  routes: RouteLiveItem[];
}

const AUTO_REFRESH_MS = 12000;

function getToken() {
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
}

function methodClass(method: string) {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-emerald-100 text-emerald-700';
    case 'POST':
      return 'bg-blue-100 text-blue-700';
    case 'PUT':
      return 'bg-amber-100 text-amber-700';
    case 'PATCH':
      return 'bg-orange-100 text-orange-700';
    case 'DELETE':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function statusClass(status: LiveStatus) {
  return status === 'on'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-rose-100 text-rose-700';
}

function availabilityTone(percent: number) {
  if (percent >= 95) return 'text-emerald-600';
  if (percent >= 80) return 'text-amber-600';
  return 'text-rose-600';
}

export function ApiDashboard({ user: _user }: { user: User }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<RoutesLivePayload | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const refreshRef = useRef<number | null>(null);

  const loadDashboard = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const token = getToken();
      const response = await fetch('/api/admin/routes/live', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Falha ao carregar dashboard do backend');
      }

      const payload = (await response.json()) as RoutesLivePayload;
      setData(payload);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao consultar backend');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  async function handleManualRefresh() {
    setRefreshing(true);
    await loadDashboard(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  useEffect(() => {
    if (refreshRef.current) {
      window.clearInterval(refreshRef.current);
      refreshRef.current = null;
    }

    if (autoRefresh) {
      refreshRef.current = window.setInterval(() => {
        void loadDashboard(false);
      }, AUTO_REFRESH_MS);
    }

    return () => {
      if (refreshRef.current) {
        window.clearInterval(refreshRef.current);
      }
    };
  }, [autoRefresh, loadDashboard]);

  const methods = useMemo(() => {
    const unique = new Set((data?.routes || []).map((route) => route.method.toUpperCase()));
    return ['ALL', ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [data]);

  const filteredRoutes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.routes || []).filter((route) => {
      const matchesSearch = !term
        || route.path.toLowerCase().includes(term)
        || route.source.toLowerCase().includes(term)
        || route.method.toLowerCase().includes(term);
      const matchesMethod = methodFilter === 'ALL' || route.method.toUpperCase() === methodFilter;
      const matchesStatus = statusFilter === 'ALL' || route.status === statusFilter;
      return matchesSearch && matchesMethod && matchesStatus;
    });
  }, [data, search, methodFilter, statusFilter]);

  const availabilityPercent = useMemo(() => {
    const total = data?.summary.total || 0;
    if (!total) return 0;
    return Math.round(((data?.summary.on || 0) / total) * 100);
  }, [data]);

  const availabilityRing = `conic-gradient(#10b981 0% ${availabilityPercent}%, #e2e8f0 ${availabilityPercent}% 100%)`;

  const methodStats = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.routes || []).forEach((route) => {
      const method = route.method.toUpperCase();
      counts.set(method, (counts.get(method) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([method, count]) => ({ method, count }));
  }, [data]);

  const latencyStats = useMemo(() => {
    const latencies = (data?.routes || [])
      .map((route) => route.latencyMs)
      .filter((latency): latency is number => typeof latency === 'number' && latency >= 0);

    const fast = latencies.filter((latency) => latency <= 120).length;
    const medium = latencies.filter((latency) => latency > 120 && latency <= 350).length;
    const slow = latencies.filter((latency) => latency > 350).length;

    const average = latencies.length
      ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
      : null;

    return { fast, medium, slow, average, total: latencies.length };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="api-dashboard-shell rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-600">
        Carregando Dashboard Back-end e APIs...
      </div>
    );
  }

  return (
    <div className="api-dashboard-shell space-y-4 animate-fadeIn">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-800">Dashboard Back-end e APIs</h1>
            <p className="text-xs text-slate-500">
              Rotas reais do servidor com status ON/OFF em tempo real
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${statusClass(data?.server.status || 'off')}`}>
                <span className={`h-2 w-2 rounded-full ${data?.server.status === 'on' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                Servidor {data?.server.status.toUpperCase()}
              </span>
              {data?.server.latencyMs !== null && data?.server.latencyMs !== undefined && (
                <span className="rounded-full bg-slate-100 px-2 py-1">{data.server.latencyMs}ms</span>
              )}
              {data?.timestamp && (
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  Atualizado {new Date(data.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                autoRefresh ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => void handleManualRefresh()}
              disabled={refreshing}
              className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-700 disabled:opacity-60"
            >
              {refreshing ? 'Atualizando...' : 'Atualizar Agora'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total de rotas</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{data?.summary.total ?? 0}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">ON</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{data?.summary.on ?? 0}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">OFF</p>
            <p className="mt-1 text-2xl font-black text-rose-700">{data?.summary.off ?? 0}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Por registro</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{data?.summary.registeredOnly ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800">Disponibilidade</h2>
            <span className={`text-xs font-bold ${availabilityTone(availabilityPercent)}`}>{availabilityPercent}%</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 rounded-full" style={{ background: availabilityRing }}>
              <div className="absolute inset-[10px] flex items-center justify-center rounded-full bg-white">
                <span className="text-lg font-black text-slate-800">{availabilityPercent}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-1.5">
                <span className="font-semibold text-emerald-700">Rotas ON</span>
                <span className="font-black text-emerald-700">{data?.summary.on ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-rose-50 px-2 py-1.5">
                <span className="font-semibold text-rose-700">Rotas OFF</span>
                <span className="font-black text-rose-700">{data?.summary.off ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1.5">
                <span className="font-semibold text-amber-700">Somente registro</span>
                <span className="font-black text-amber-700">{data?.summary.registeredOnly ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800">Métodos Mais Usados</h2>
            <span className="text-xs font-semibold text-slate-500">{methodStats.length} tipos</span>
          </div>
          <div className="space-y-2.5">
            {methodStats.length > 0 ? methodStats.map((item) => {
              const percent = (data?.summary.total || 0) > 0 ? (item.count / (data?.summary.total || 1)) * 100 : 0;
              return (
                <div key={item.method}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className={`rounded-md px-2 py-0.5 font-bold ${methodClass(item.method)}`}>{item.method}</span>
                    <span className="font-bold text-slate-700">{item.count} rotas</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      style={{ width: `${Math.max(5, percent)}%` }}
                    />
                  </div>
                </div>
              );
            }) : (
              <p className="py-6 text-center text-xs text-slate-400">Sem dados de método</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800">Latência</h2>
            <span className="text-xs font-semibold text-slate-500">
              {latencyStats.average != null ? `${latencyStats.average}ms média` : 'sem amostra'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-700">Rápida (até 120ms)</span>
                <span className="font-black text-emerald-700">{latencyStats.fast}</span>
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-700">Média (121-350ms)</span>
                <span className="font-black text-amber-700">{latencyStats.medium}</span>
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-700">Alta (&gt; 350ms)</span>
                <span className="font-black text-rose-700">{latencyStats.slow}</span>
              </div>
            </div>
            <p className="pt-1 text-[11px] text-slate-500">
              Total medido: {latencyStats.total} rota(s) com latência válida.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar rota, modulo ou metodo"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-cyan-400"
          />

          <select
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-cyan-400"
          >
            {methods.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-cyan-400"
          >
            <option value="ALL">Todos os status</option>
            <option value="on">Somente ON</option>
            <option value="off">Somente OFF</option>
          </select>

          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
            Exibindo {filteredRoutes.length} de {data?.summary.total ?? 0}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Método</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Rota</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Módulo</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Probe</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">HTTP</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Latência</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Erro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRoutes.map((route) => (
              <tr key={route.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(route.status)}`}>
                    {route.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${methodClass(route.method)}`}>
                    {route.method}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{route.path}</td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-600">{route.source}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{route.probeMethod}</td>
                <td className="px-3 py-2 text-xs font-bold text-slate-600">{route.statusCode ?? '-'}</td>
                <td className="px-3 py-2 text-xs font-bold text-slate-600">{route.latencyMs ?? '-'}{route.latencyMs != null ? 'ms' : ''}</td>
                <td className="px-3 py-2 text-xs text-rose-600">{route.error || '-'}</td>
              </tr>
            ))}
            {filteredRoutes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">
                  Nenhuma rota encontrada com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

