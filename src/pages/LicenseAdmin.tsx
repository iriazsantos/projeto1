import { useCallback, useEffect, useState } from 'react';

interface CondoData {
  id: string;
  name: string;
  city: string;
  email?: string;
  cnpj?: string;
  licenseValue: number;
  blocked: boolean;
  active: boolean;
}

interface LicenseCharge {
  id: string;
  condoId: string;
  condoName: string;
  description: string;
  amount: number;
  dueDate: string;
  reference: string;
  status: 'paid' | 'pending' | 'overdue';
  viewedBySindico: boolean;
  viewedAt?: string;
  createdAt: string;
  paidAt?: string;
}

interface BackendBilling {
  id: string;
  condoId: string;
  condoName?: string;
  description?: string;
  amount: number;
  dueDate: string;
  billingMonth?: string;
  status: string;
  viewedBySindico?: boolean;
  viewedAt?: string;
  createdAt?: string;
  paidAt?: string;
}

interface Store {
  getCondos: () => CondoData[];
  getLicenseCharges: () => LicenseCharge[];
  addLicenseCharge: (data: any) => void;
  deleteLicenseCharge: (id: string) => void;
  markLicensePaid: (id: string) => void;
  blockCondo: (id: string) => void;
  unblockCondo: (id: string) => void;
}

interface LicenseAdminProps {
  store: Store;
}

function getAuthToken() {
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
}

function mapBackendStatusToLocal(status: string): LicenseCharge['status'] {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') return 'paid';
  if (normalized === 'overdue') return 'overdue';
  return 'pending';
}

export function LicenseAdmin({ store }: LicenseAdminProps) {
  const localCondos = store.getCondos();
  const localCharges = store.getLicenseCharges();

  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [liveCondos, setLiveCondos] = useState<CondoData[] | null>(null);
  const [liveCharges, setLiveCharges] = useState<LicenseCharge[] | null>(null);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);
  const [syncingChargeId, setSyncingChargeId] = useState<string | null>(null);
  const [selectedCondoId, setSelectedCondoId] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reference, setReference] = useState('');
  const [filterCondo, setFilterCondo] = useState('all');

  const condos = liveCondos ?? localCondos;
  const charges = liveCharges ?? localCharges;

  const filtered = filterCondo === 'all' ? charges : charges.filter((c) => c.condoId === filterCondo);

  const statusColors: Record<LicenseCharge['status'], string> = {
    paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    overdue: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  const statusLabels: Record<LicenseCharge['status'], string> = {
    paid: 'Pago',
    pending: 'Pendente',
    overdue: 'Vencido',
  };

  const totalPending = charges.filter((c) => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPaid = charges.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalCharges = charges.length;

  const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');

  const loadLiveData = useCallback(async (silent = false) => {
    const token = getAuthToken();
    if (!token) {
      if (!silent) {
        setLiveCondos(null);
        setLiveCharges(null);
        setSyncError('');
      }
      return;
    }

    if (!silent) setSyncing(true);

    try {
      const [condosRes, billingsRes] = await Promise.all([
        fetch('/api/master-gateway/condos', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/master-gateway/billings', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const condosData = await condosRes.json().catch(() => ({}));
      const billingsData = await billingsRes.json().catch(() => ({}));

      if (!condosRes.ok) {
        throw new Error(condosData?.error || 'Falha ao carregar condominios do banco');
      }
      if (!billingsRes.ok) {
        throw new Error(billingsData?.error || 'Falha ao carregar cobrancas do banco');
      }

      const nextCondos: CondoData[] = Array.isArray(condosData?.condos)
        ? condosData.condos.map((condo: any) => ({
            id: String(condo.id),
            name: String(condo.name || ''),
            city: String(condo.city || ''),
            email: condo.email || undefined,
            cnpj: condo.cnpj || undefined,
            licenseValue: Number(condo.licenseValue) || 0,
            blocked: Boolean(condo.blocked),
            active: condo.active !== false,
          }))
        : [];

      const nextCharges: LicenseCharge[] = (Array.isArray(billingsData?.billings) ? billingsData.billings : []).map((billing: BackendBilling) => ({
        id: String(billing.id),
        condoId: String(billing.condoId),
        condoName: String(billing.condoName || ''),
        description: String(billing.description || 'Licenca INOVATECH CONNECT'),
        amount: Number(billing.amount) || 0,
        dueDate: String(billing.dueDate || '').slice(0, 10),
        reference: String(
          billing.billingMonth
          || billing.description
          || 'Licenca INOVATECH CONNECT'
        ),
        status: mapBackendStatusToLocal(billing.status),
        viewedBySindico: Boolean(billing.viewedBySindico),
        viewedAt: billing.viewedAt || undefined,
        createdAt: String(billing.createdAt || new Date().toISOString()),
        paidAt: billing.paidAt || undefined,
      }));

      setLiveCondos(nextCondos);
      setLiveCharges(nextCharges);
      setSyncError('');
    } catch (error: any) {
      if (!silent) {
        setSyncError(error?.message || 'Falha ao sincronizar dados do banco');
      }
    } finally {
      if (!silent) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadLiveData(false);
    const interval = setInterval(() => {
      void loadLiveData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [loadLiveData]);

  const handleSave = async () => {
    const condo = condos.find((c) => c.id === selectedCondoId);
    if (!condo || !desc.trim() || !amount || !dueDate || !reference.trim()) return;

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    const createdLocalCharge = {
      condoId: selectedCondoId,
      condoName: condo.name,
      description: desc.trim(),
      amount: parsedAmount,
      dueDate,
      reference: reference.trim(),
      status: 'pending' as const,
      viewedBySindico: false,
    };

    const token = getAuthToken();
    let syncedBillingId: string | undefined;
    let syncedCreatedAt: string | undefined;

    if (token) {
      try {
        const manualBillingRes = await fetch(`/api/master-gateway/condos/${selectedCondoId}/manual-license-billing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            description: desc.trim(),
            amount: parsedAmount,
            dueDate,
            customerName: condo.name,
            customerEmail: condo.email || null,
            customerCnpj: condo.cnpj || null,
          }),
        });

        const manualBillingData = await manualBillingRes.json();
        if (!manualBillingRes.ok) {
          throw new Error(manualBillingData?.error || 'Falha ao salvar cobranca no banco');
        }

        syncedBillingId = manualBillingData?.billing?.id;
        syncedCreatedAt = manualBillingData?.billing?.createdAt;

        if (!syncedBillingId) {
          throw new Error('Resposta invalida ao criar cobranca no banco');
        }

        try {
          const chargeRes = await fetch(`/api/master-gateway/condos/${selectedCondoId}/charge-license`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              billingId: syncedBillingId,
              method: 'pix',
            }),
          });
          await chargeRes.json();
        } catch {
          // falha no gateway nao bloqueia cadastro local
        }
      } catch {
        alert('Falha ao criar cobranca no banco/gateway');
        return;
      }
    }

    if (!token || liveCharges === null) {
      store.addLicenseCharge({
        ...createdLocalCharge,
        id: syncedBillingId,
        createdAt: syncedCreatedAt,
      });
    } else {
      void loadLiveData(true);
    }

    setShowForm(false);
    setSelectedCondoId('');
    setDesc('');
    setAmount('');
    setDueDate('');
    setReference('');
  };

  const handleMarkPaid = async (id: string) => {
    const charge = store.getLicenseCharges().find((c) => c.id === id);
    const fallbackCharge = charges.find((c) => c.id === id);
    const selectedCharge = charge || fallbackCharge;
    const condo = condos.find((c) => c.id === selectedCharge?.condoId);
    const msg = condo?.blocked
      ? `Confirmar pagamento da licenca de "${selectedCharge?.condoName}"?\n\nO condominio sera desbloqueado automaticamente.`
      : `Confirmar pagamento da licenca de "${selectedCharge?.condoName}"?`;
    if (confirm(msg)) {
      const token = getAuthToken();
      if (!token || id.startsWith('lic')) {
        store.markLicensePaid(id);
        return;
      }

      if (!selectedCharge?.condoId) {
        alert('Nao foi possivel identificar o condominio desta cobranca.');
        return;
      }

      setSyncingChargeId(id);
      try {
        const syncRes = await fetch(`/api/master-gateway/condos/${selectedCharge.condoId}/sync-license-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            billingId: id,
            syncGateway: true,
            maxGatewayChecks: 120,
          }),
        });

        const syncData = await syncRes.json().catch(() => null);
        if (!syncRes.ok) {
          throw new Error(syncData?.error || 'Falha ao consultar status no banco');
        }

        const normalizedStatus = String(syncData?.billing?.status || '').toLowerCase();
        if (normalizedStatus !== 'paid') {
          alert('Pagamento ainda nao foi confirmado pelo banco. Tente novamente em instantes.');
        }

        if (normalizedStatus === 'paid') {
          store.markLicensePaid(id);
        }

        await loadLiveData(true);
      } catch (error: any) {
        alert(error?.message || 'Falha ao atualizar status do pagamento');
      } finally {
        setSyncingChargeId(null);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const charge = store.getLicenseCharges().find((c) => c.id === id) || charges.find((c) => c.id === id);
    if (!charge) return;

    if (!confirm(`Excluir cobranca "${charge.reference}"?`)) return;

    const token = getAuthToken();
    if (!token) {
      alert('Sessao expirada. Faca login novamente para remover no banco.');
      return;
    }

    setDeletingChargeId(id);

    try {
      const attemptDelete = async (billingId: string) => {
        const res = await fetch(`/api/master-gateway/billings/${billingId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
      };

      let deleteTargetId = id;
      let deleteResult = await attemptDelete(deleteTargetId);

      if (!deleteResult.ok && deleteResult.status === 404) {
        const listRes = await fetch(
          `/api/master-gateway/condos/${charge.condoId}/sindico-billings?syncGateway=false&limit=200`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const listData = await listRes.json().catch(() => null);

        const sameDay = (a: string, b: string) => {
          const da = new Date(a);
          const db = new Date(b);
          if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
          return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
        };

        const billings = Array.isArray(listData?.billings) ? listData.billings : [];
        const fallbackMatch = billings
          .filter((b: any) => {
            const sameAmount = Number(b?.amount) === Number(charge.amount);
            const sameDueDate = sameDay(String(b?.dueDate || ''), charge.dueDate);
            const sameDescription = String(b?.description || '').trim() === charge.description.trim();
            return sameAmount && sameDueDate && sameDescription;
          })
          .sort((a: any, b: any) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))[0];

        if (fallbackMatch?.id && fallbackMatch.id !== id) {
          deleteTargetId = fallbackMatch.id;
          deleteResult = await attemptDelete(deleteTargetId);
        }
      }

      if (!deleteResult.ok) {
        if (deleteResult.status === 404 && id.startsWith('lic')) {
          store.deleteLicenseCharge(id);
          return;
        }
        throw new Error(deleteResult?.data?.error || 'Nao foi possivel remover a cobranca no banco');
      }

      store.deleteLicenseCharge(id);
      await loadLiveData(true);
    } catch (error: any) {
      alert(error?.message || 'Falha ao remover cobranca');
    } finally {
      setDeletingChargeId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 pb-6">
      <header className="mb-5 bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-5">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-black text-white sm:text-2xl">Cobrancas de Licenca</h1>
              <p className="mt-0.5 text-xs text-white/80 sm:text-sm">Gestao de licencas do painel administrativo</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/30 sm:w-auto"
            >
              <span>+</span> Nova Cobranca
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <StatCardCompact icon="$" label="Total" value={totalCharges} sub="cobrancas" />
            <StatCardCompact icon="OK" label="Recebido" value={fmtMoney(totalPaid)} sub="pagas" />
            <StatCardCompact icon="!" label="A Receber" value={fmtMoney(totalPending)} sub="pendente" />
          </div>
        </div>
      </header>

      {syncing && (
        <div className="mx-auto mb-3 max-w-6xl px-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
            Sincronizando cobrancas e status com o banco...
          </div>
        </div>
      )}

      {syncError && (
        <div className="mx-auto mb-3 max-w-6xl px-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            {syncError}
          </div>
        </div>
      )}

      <div className="mx-auto mb-4 max-w-6xl px-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700">Status por Condominio</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {condos.map((condo) => {
            const condoCharges = charges.filter((c) => c.condoId === condo.id);
            const hasOverdue = condoCharges.some((c) => c.status === 'overdue');
            const hasPending = condoCharges.some((c) => c.status === 'pending');
            const lastCharge = [...condoCharges].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

            const isBlocked = condo.blocked;
            const statusColor = isBlocked
              ? 'from-rose-500 to-red-600 border-rose-200'
              : hasOverdue
                ? 'from-orange-500 to-amber-600 border-orange-200'
                : hasPending
                  ? 'from-amber-400 to-orange-500 border-amber-200'
                  : 'from-emerald-500 to-teal-600 border-emerald-200';

            return (
              <div
                key={condo.id}
                className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${statusColor} p-3 text-white shadow-sm transition-all hover:shadow-md`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold">{condo.name}</h3>
                    <p className="truncate text-[11px] text-white/80">{condo.city}</p>
                  </div>
                  <span className="ml-1 whitespace-nowrap rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm">
                    {isBlocked ? 'Bloqueado' : hasOverdue ? 'Vencido' : hasPending ? 'Pendente' : 'Em dia'}
                  </span>
                </div>

                <div className="mb-2 text-[11px] text-white/85">
                  <p>Licenca: {fmtMoney(condo.licenseValue)}/mes</p>
                  {lastCharge && (
                    <p className="mt-0.5 truncate">
                      Ref: {lastCharge.reference}
                      {lastCharge.viewedBySindico && <span className="ml-1">Visto</span>}
                    </p>
                  )}
                </div>

                {isBlocked ? (
                  <button
                    onClick={() => {
                      if (confirm(`Desbloquear "${condo.name}"?`)) {
                        store.unblockCondo(condo.id);
                      }
                    }}
                    className="w-full rounded-lg bg-white/20 px-2.5 py-1.5 text-[11px] font-bold backdrop-blur-sm transition-all hover:bg-white/30"
                  >
                    Desbloquear
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (confirm(`Bloquear "${condo.name}"?`)) {
                        store.blockCondo(condo.id);
                      }
                    }}
                    className="w-full rounded-lg bg-white/20 px-2.5 py-1.5 text-[11px] font-bold backdrop-blur-sm transition-all hover:bg-white/30"
                  >
                    Bloquear
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-3 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-bold text-white">Todas as Cobrancas</h3>
              <select
                value={filterCondo}
                onChange={(e) => setFilterCondo(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm focus:border-white focus:outline-none sm:w-auto"
              >
                <option value="all" className="text-gray-900">
                  Todos os condominios
                </option>
                {condos.map((c) => (
                  <option key={c.id} value={c.id} className="text-gray-900">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600">Condominio</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600">Descricao</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600">Ref.</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600">Valor</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600">Vencimento</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600">Status</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600">Visto</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((charge) => {
                    const condo = condos.find((c) => c.id === charge.condoId);

                    return (
                      <tr key={charge.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{charge.condoName}</p>
                            {condo?.blocked && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                Bloqueado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="max-w-xs truncate text-xs text-gray-600">{charge.description}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {charge.reference}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs font-bold text-gray-900">{fmtMoney(charge.amount)}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs text-gray-700">{fmtDate(charge.dueDate)}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColors[charge.status]}`}
                          >
                            {statusLabels[charge.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {charge.viewedBySindico ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              Visto
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                              Nao visto
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {charge.status !== 'paid' && (
                              <button
                                onClick={() => handleMarkPaid(charge.id)}
                                disabled={syncingChargeId === charge.id}
                                className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Marcar como pago"
                              >
                                {syncingChargeId === charge.id ? '...' : 'PAGO'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(charge.id)}
                              disabled={deletingChargeId === charge.id}
                              className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                              title="Excluir"
                            >
                              {deletingChargeId === charge.id ? '...' : 'REMOVER'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <span className="text-3xl">-</span>
                <p className="mt-2 text-xs font-semibold">Nenhuma cobranca encontrada</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Nova Cobranca</p>
                  <h3 className="text-base font-bold text-white">Licenca INOVATECH</h3>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-white/30 bg-white/20 p-1.5 text-white backdrop-blur-sm transition-all hover:bg-white/30"
                >
                  X
                </button>
              </div>
            </div>

            <div className="max-h-[78dvh] space-y-3 overflow-y-auto px-4 py-3 text-gray-900 sm:max-h-[66vh]">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <p className="text-xs font-bold text-gray-700">Cobranca de Licenca</p>
                <p className="text-[11px] text-gray-600">Visivel para o sindico do condominio selecionado.</p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-gray-700">Condominio *</label>
                <select
                  value={selectedCondoId}
                  onChange={(e) => {
                    setSelectedCondoId(e.target.value);
                    const condo = condos.find((c) => c.id === e.target.value);
                    if (condo) {
                      setAmount(String(condo.licenseValue));
                      const now = new Date();
                      const monthRef = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      const ref = monthRef.charAt(0).toUpperCase() + monthRef.slice(1);
                      setReference(ref);
                      setDesc(`Licenca INOVATECH CONNECT - ${ref}`);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                >
                  <option value="">Selecionar...</option>
                  {condos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({fmtMoney(c.licenseValue)}/mes)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-gray-700">Referencia *</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  placeholder="Ex: Novembro/2026"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-gray-700">Descricao *</label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  placeholder="Licenca INOVATECH CONNECT..."
                />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-gray-700">Valor (R$) *</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    placeholder="299.00"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-gray-700">Vencimento *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <div className="flex items-start gap-2">
                  <span className="text-base">!</span>
                  <div>
                    <p className="text-[11px] font-bold text-amber-800">Bloqueio automatico</p>
                    <p className="mt-0.5 text-[11px] text-amber-700">
                      Condominios vencidos serao bloqueados apos o periodo configurado.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 sm:flex-row">
              <button
                onClick={() => setShowForm(false)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 transition-all hover:bg-gray-100 sm:flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="w-full rounded-lg bg-gradient-to-r from-gray-700 to-gray-900 px-3 py-1.5 text-[11px] font-bold text-white shadow transition-all hover:shadow-lg sm:flex-1"
              >
                Criar Cobranca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCardCompact({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white/20 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">{label}</p>
          <p className="text-base font-black text-white">{value}</p>
          {sub && <p className="mt-0.5 text-[10px] text-white/70">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
