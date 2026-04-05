import { useCallback, useEffect, useMemo, useState } from 'react';

interface LicenseCharge {
  id: string;
  condoId: string;
  condoName: string;
  amount: number;
  dueDate: string;
  reference: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  createdAt: string;
  paidAt?: string;
  viewedBySindico?: boolean;
  gatewayChargeId?: string;
  gatewayStatus?: string;
  pixCode?: string;
  pixQrCode?: string;
  boletoUrl?: string;
  boletoCode?: string;
  paymentMethod?: 'pix' | 'boleto' | 'credit_card' | 'debit_card';
}

interface BillingSnapshot {
  id: string;
  condoId: string;
  description?: string;
  amount: number;
  dueDate: string;
  createdAt?: string;
  paidAt?: string | null;
  billingMonth?: string;
  status: string;
  gatewayStatus?: string | null;
  gatewayChargeId?: string | null;
}

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
}

function mapBillingStatusToPanel(status: string): LicenseCharge['status'] {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') return 'paid';
  if (normalized === 'overdue') return 'overdue';
  if (normalized === 'cancelled') return 'cancelled';
  return 'pending';
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function billingToCharge(billing: BillingSnapshot, condoName: string): LicenseCharge {
  return {
    id: billing.id,
    condoId: billing.condoId,
    condoName,
    amount: Number(billing.amount) || 0,
    dueDate: String(billing.dueDate || '').slice(0, 10),
    reference: billing.billingMonth || String(billing.description || 'Licença INOVATECH').slice(0, 40),
    status: mapBillingStatusToPanel(billing.status),
    createdAt: billing.createdAt || new Date().toISOString(),
    paidAt: billing.paidAt || undefined,
    gatewayStatus: billing.gatewayStatus || undefined,
    gatewayChargeId: billing.gatewayChargeId || undefined,
  };
}

async function emitBillingCharge(params: {
  condoId: string;
  billingId: string;
  method: 'pix' | 'boleto' | 'credit_card' | 'debit_card';
}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente para pagar a licença.');
  }

  const response = await fetch(`/api/master-gateway/condos/${params.condoId}/charge-license`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      billingId: params.billingId,
      method: params.method
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.details || 'Falha ao emitir cobrança no gateway');
  }

  return {
    chargeId: data?.gateway?.chargeId || data?.billing?.id || params.billingId,
    provider: data?.gateway?.provider || null,
    pixCode: data?.gateway?.pixCode || null,
    pixQrCode: data?.gateway?.qrCodeImage || null,
    boletoUrl: data?.gateway?.boletoUrl || null,
    checkoutUrl: data?.gateway?.checkoutUrl || null,
    method: data?.gateway?.method || params.method
  };
}

async function syncLicenseStatus(params: {
  condoId: string;
  billingId: string;
  syncGateway?: boolean;
}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente para atualizar o status.');
  }

  const response = await fetch(`/api/master-gateway/condos/${params.condoId}/sync-license-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      billingId: params.billingId,
      syncGateway: params.syncGateway !== false,
      maxGatewayChecks: 80
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Falha ao sincronizar status da licença');
  }

  return data;
}

async function listCondoBillings(condoId: string) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const response = await fetch(`/api/master-gateway/condos/${condoId}/sindico-billings?syncGateway=true&maxGatewayChecks=80`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Falha ao carregar cobranças da licença');
  }

  return data;
}

interface LicensePaymentModalProps {
  charge: {
    id: string;
    condoId: string;
    condoName: string;
    amount: number;
    dueDate: string;
    reference: string;
  };
  onClose: () => void;
  onPaid: (chargeId: string) => void;
}

export function LicensePaymentModal({ charge, onClose, onPaid }: LicensePaymentModalProps) {
  const [step, setStep] = useState<'method' | 'generating' | 'pix' | 'boleto' | 'card' | 'success'>('method');
  const [method, setMethod] = useState<'pix' | 'boleto' | 'credit_card' | 'debit_card'>('pix');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(1800);
  const [result, setResult] = useState<{
    chargeId?: string;
    provider?: string | null;
    pixCode?: string | null;
    pixQrCode?: string | null;
    boletoUrl?: string | null;
    checkoutUrl?: string | null;
    method?: 'pix' | 'boleto' | 'credit_card' | 'debit_card';
  }>({});

  useEffect(() => {
    if (step !== 'pix') return;
    const timer = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const checkStatus = useCallback(async (silent = false) => {
    if (!silent) {
      setCheckingStatus(true);
      setStatusMessage('Sincronizando com o banco...');
    }

    try {
      const sync = await syncLicenseStatus({
        condoId: charge.condoId,
        billingId: charge.id,
        syncGateway: true
      });

      const status = String(sync?.billing?.status || '').toLowerCase();
      if (status === 'paid') {
        setStatusMessage('Pagamento confirmado pelo banco. Atualizando painel...');
        setStep('success');
        setTimeout(() => {
          onPaid(charge.id);
          onClose();
        }, 1800);
        return;
      }

      if (status === 'overdue') {
        setStatusMessage('Cobrança ainda em atraso. Assim que o banco confirmar, o status mudará para pago.');
      } else {
        setStatusMessage('Pagamento ainda não confirmado pelo banco. Vamos continuar monitorando.');
      }
    } catch (syncError: any) {
      setStatusMessage(syncError?.message || 'Falha ao consultar status no banco');
    } finally {
      if (!silent) setCheckingStatus(false);
    }
  }, [charge.condoId, charge.id, onClose, onPaid]);

  useEffect(() => {
    if (step !== 'pix' && step !== 'boleto' && step !== 'card') return;
    const interval = setInterval(() => {
      void checkStatus(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [step, checkStatus]);

  const handleGenerate = async () => {
    setError('');
    setStatusMessage('');
    setStep('generating');

    try {
      const generated = await emitBillingCharge({
        condoId: charge.condoId,
        billingId: charge.id,
        method
      });

      setResult(generated);
      if (method === 'pix') {
        setStep('pix');
      } else if (method === 'boleto') {
        setStep('boleto');
      } else {
        setStep('card');
      }
    } catch (emitError: any) {
      setError(emitError?.message || 'Falha ao gerar cobrança no gateway');
      setStep('method');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(17,24,39,0.72)' }}>
      <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-white text-gray-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-base font-bold">Pagamento de Licença</h3>
            <p className="mt-1 text-[11px] text-gray-500">{charge.condoName} · {charge.reference}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>

        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">Valor</p>
          <p className="text-2xl font-black text-gray-900">{formatMoney(charge.amount)}</p>
          <p className="mt-1 text-xs text-gray-500">Vencimento: {formatDate(charge.dueDate)}</p>
          {result.provider && <p className="mt-1 text-xs text-emerald-600">Gateway: {result.provider}</p>}
        </div>

        <div className="space-y-3 p-4">
          {step === 'method' && (
            <>
              {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
              <p className="text-xs text-gray-600">Escolha o método de pagamento:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMethod('pix')}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${method === 'pix' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white text-gray-700'}`}
                >PIX</button>
                <button
                  onClick={() => setMethod('boleto')}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${method === 'boleto' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'}`}
                >Boleto</button>
                <button
                  onClick={() => setMethod('credit_card')}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${method === 'credit_card' ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-300 bg-white text-gray-700'}`}
                >Cartão crédito</button>
                <button
                  onClick={() => setMethod('debit_card')}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${method === 'debit_card' ? 'border-cyan-400 bg-cyan-50 text-cyan-700' : 'border-gray-300 bg-white text-gray-700'}`}
                >Cartão débito</button>
              </div>
              <button
                onClick={handleGenerate}
                className="w-full rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 py-2.5 text-sm font-bold text-white"
              >Gerar cobrança real no gateway</button>
            </>
          )}

          {step === 'generating' && (
            <div className="py-7 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-gray-700" />
              <p className="mt-3 text-xs text-gray-600">Emitindo cobrança no gateway...</p>
            </div>
          )}

          {step === 'pix' && (
            <div className="space-y-3">
              {result.pixQrCode ? (
                <div className="rounded-xl border border-gray-200 bg-white p-2 text-center">
                  <img
                    src={result.pixQrCode}
                    alt="QR Code PIX"
                    className="mx-auto h-44 w-44 rounded"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  O gateway não retornou QR Code PIX real para esta cobrança.
                </div>
              )}
              <div className="break-all rounded-lg border border-gray-300 bg-gray-50 p-2 text-xs text-gray-700">
                {result.pixCode || 'Código PIX não disponível. Gere novamente ou use outro método.'}
              </div>
              {!!result.pixCode && (
                <button
                  onClick={() => handleCopy(result.pixCode || '')}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700"
                >{copied ? 'Código PIX copiado' : 'Copiar código PIX'}</button>
              )}
              {!result.pixCode && !!result.checkoutUrl && (
                <button
                  onClick={() => window.open(result.checkoutUrl || '', '_blank')}
                  className="w-full rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 py-2.5 text-xs font-bold text-white"
                >Abrir cobrança no gateway</button>
              )}
              <div className="text-[11px] text-gray-500">QR válido por: <span className="font-mono text-gray-800">{formatCountdown(countdown)}</span></div>
              <button
                onClick={() => void checkStatus(false)}
                disabled={checkingStatus}
                className="w-full rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              >{checkingStatus ? 'Consultando banco...' : 'Atualizar status do pagamento'}</button>
            </div>
          )}

          {step === 'boleto' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-300 bg-gray-50 p-3 text-xs">
                <p className="font-semibold">Boleto gerado com sucesso</p>
                <p className="mt-1 text-xs text-gray-500">Use o link abaixo para pagar no seu banco.</p>
              </div>
              <button
                onClick={() => (result.boletoUrl || result.checkoutUrl) && window.open(result.boletoUrl || result.checkoutUrl || '', '_blank')}
                disabled={!(result.boletoUrl || result.checkoutUrl)}
                className="w-full rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >Abrir boleto</button>
              <button
                onClick={() => void checkStatus(false)}
                disabled={checkingStatus}
                className="w-full rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              >{checkingStatus ? 'Consultando banco...' : 'Atualizar status do pagamento'}</button>
            </div>
          )}

          {step === 'card' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-300 bg-gray-50 p-3 text-xs">
                <p className="font-semibold">Pagamento com cartão</p>
                <p className="mt-1 text-xs text-gray-500">Abra a cobrança no gateway para pagar com cartão de crédito ou débito.</p>
              </div>
              <button
                onClick={() => result.checkoutUrl && window.open(result.checkoutUrl, '_blank')}
                disabled={!result.checkoutUrl}
                className="w-full rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >Abrir pagamento com cartão</button>
              <button
                onClick={() => void checkStatus(false)}
                disabled={checkingStatus}
                className="w-full rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              >{checkingStatus ? 'Consultando banco...' : 'Atualizar status do pagamento'}</button>
            </div>
          )}

          {statusMessage && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">{statusMessage}</div>
          )}

          {step === 'success' && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-4 text-center">
              <p className="text-lg font-black text-emerald-700">Pagamento Confirmado</p>
              <p className="mt-1 text-xs text-emerald-700">O banco confirmou o pagamento e o sistema atualizou a licença.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface LicensePanelProps {
  charges: LicenseCharge[];
  condoName: string;
  condoId: string;
  onMarkViewed: (chargeId: string) => void;
  onMarkPaid: (chargeId: string) => void;
  onCondoBlockedChange?: (blocked: boolean) => void;
}

export function LicenseSindicoPanel({ charges, condoName, condoId, onMarkViewed, onMarkPaid, onCondoBlockedChange }: LicensePanelProps) {
  const [payingCharge, setPayingCharge] = useState<LicenseCharge | null>(null);
  const [displayCharges, setDisplayCharges] = useState<LicenseCharge[]>(charges);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [blockGraceDays, setBlockGraceDays] = useState(30);
  const [condoBlocked, setCondoBlocked] = useState(false);

  useEffect(() => {
    setDisplayCharges(charges);
  }, [charges]);

  const refreshFromBackend = useCallback(async (silent = false) => {
    const token = getAuthToken();
    if (!token || !condoId) return;

    if (!silent) setLoading(true);

    try {
      const data = await listCondoBillings(condoId);
      const backendBillings = Array.isArray(data?.billings) ? data.billings : [];
      const mappedCharges: LicenseCharge[] = backendBillings.map((billing: BillingSnapshot) => billingToCharge(billing, condoName));

      const backendBlocked = Boolean(data?.condo?.blocked);

      setDisplayCharges(mappedCharges);
      setCondoBlocked((prev) => {
        if (prev !== backendBlocked) {
          onCondoBlockedChange?.(backendBlocked);
        }
        return backendBlocked;
      });
      setBlockGraceDays(Number(data?.config?.blockGraceDays || 30));
      setLastSyncAt(new Date().toISOString());
      setSyncError('');

      const localById = new Map(charges.map((charge) => [charge.id, charge]));
      mappedCharges.forEach((charge: LicenseCharge) => {
        const local = localById.get(charge.id);
        if (charge.status === 'paid' && local?.status !== 'paid') {
          onMarkPaid(charge.id);
        }
        if ((charge.status === 'pending' || charge.status === 'overdue') && !local?.viewedBySindico) {
          onMarkViewed(charge.id);
        }
      });
    } catch (backendError: any) {
      if (!silent) {
        setSyncError(backendError?.message || 'Falha ao sincronizar cobranças com o servidor');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [charges, condoId, condoName, onCondoBlockedChange, onMarkPaid, onMarkViewed]);

  useEffect(() => {
    void refreshFromBackend(false);
    const interval = setInterval(() => {
      void refreshFromBackend(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [refreshFromBackend]);

  const pendingCharges = useMemo(
    () => displayCharges.filter((charge) => charge.status === 'pending' || charge.status === 'overdue'),
    [displayCharges]
  );

  const paidCharges = useMemo(
    () => displayCharges.filter((charge) => charge.status === 'paid'),
    [displayCharges]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-300 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-white">Licença INOVATECH CONNECT</h2>
            <p className="text-xs text-gray-200">{condoName}</p>
            <p className="mt-1 text-xs text-gray-300">Bloqueio automático após {blockGraceDays} dia(s) de atraso após o vencimento.</p>
            {lastSyncAt && <p className="mt-1 text-[11px] text-gray-400">Última atualização: {new Date(lastSyncAt).toLocaleTimeString('pt-BR')}</p>}
          </div>
          <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${pendingCharges.length > 0 ? 'border-red-400 bg-red-100/90 text-red-700' : 'border-emerald-400 bg-emerald-100/90 text-emerald-700'}`}>
            {pendingCharges.length > 0 ? `${pendingCharges.length} pendente(s)` : 'Em dia'}
          </div>
        </div>
      </div>

      {condoBlocked && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">
          Condomínio bloqueado por inadimplência da licença. O acesso volta automaticamente após o banco confirmar o pagamento.
        </div>
      )}

      {syncError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
          {syncError}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => void refreshFromBackend(false)}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-60"
        >{loading ? 'Sincronizando...' : 'Atualizar agora'}</button>
      </div>

      {pendingCharges.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-800">Cobranças pendentes</h3>
          {pendingCharges.map((charge) => {
            const dueDate = new Date(charge.dueDate);
            const daysLate = Number.isNaN(dueDate.getTime())
              ? 0
              : Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000));
            const isOverdue = daysLate > 0 || charge.status === 'overdue';
            const daysToBlock = Math.max(0, blockGraceDays - daysLate);

            return (
              <div key={charge.id} className={`rounded-2xl border p-3 ${isOverdue ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{charge.reference}</p>
                    <p className="text-xs text-gray-600">Vencimento: {formatDate(charge.dueDate)}</p>
                    <p className="mt-1 text-base font-black text-gray-900">{formatMoney(charge.amount)}</p>
                    {isOverdue && (
                      <p className="mt-1 text-xs text-red-600">
                        {daysLate} dia(s) em atraso · {daysToBlock > 0 ? `faltam ${daysToBlock} dia(s) para bloqueio` : 'prazo de bloqueio excedido'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setPayingCharge(charge)}
                    className="rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 px-4 py-1.5 text-xs font-bold text-white"
                  >Pagar agora</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paidCharges.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-800">Histórico de pagamentos</h3>
          {paidCharges.map((charge) => (
            <div key={charge.id} className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-2.5">
              <div>
                <p className="text-xs font-semibold text-emerald-800">{charge.reference}</p>
                <p className="text-[11px] text-emerald-700">Pago em: {formatDate(charge.paidAt)}</p>
              </div>
              <p className="text-sm font-bold text-emerald-700">{formatMoney(charge.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {displayCharges.length === 0 && (
        <div className="rounded-xl border border-gray-300 bg-white p-5 text-center text-sm text-gray-500">
          Nenhuma cobrança encontrada para este condomínio.
        </div>
      )}

      {payingCharge && (
        <LicensePaymentModal
          charge={payingCharge}
          onClose={() => setPayingCharge(null)}
          onPaid={(billingId) => {
            onMarkPaid(billingId);
            void refreshFromBackend(false);
            setPayingCharge(null);
          }}
        />
      )}
    </div>
  );
}
