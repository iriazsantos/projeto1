import { useState, useEffect, useCallback } from 'react';
import type { User } from './types';
import { GatewayConfig, GatewayStatus, Payment, CreatePaymentForm, Condominium } from './components/gateway/GatewayTypes';
import { GatewayDashboard } from './components/gateway/GatewayDashboard';
import { GatewaySettings } from './components/gateway/GatewaySettings';
import { CreateChargeForm } from './components/gateway/CreateChargeForm';
import { PaymentHistory } from './components/gateway/PaymentHistory';

export function PaymentGatewayUI({ user, overrideCondoId }: { user: User; overrideCondoId?: string }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'create' | 'history'>('dashboard');
  const [gateway, setGateway] = useState<GatewayConfig | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCondoId, setSelectedCondoId] = useState<string>(overrideCondoId || user.condoId || '');
  const [condos, setCondos] = useState<Condominium[]>([]);
  const [showCondoSelector, setShowCondoSelector] = useState(false);

  // Config form state
  const [configProvider, setConfigProvider] = useState<string>('asaas');
  const [configApiKey, setConfigApiKey] = useState('');
  const [configEnv, setConfigEnv] = useState<string>('sandbox');
  const [configBlockGraceDays, setConfigBlockGraceDays] = useState<string>('30');
  const [testingConnection, setTestingConnection] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSuccess, setConfigSuccess] = useState('');

  // Payment form state
  const [paymentForm, setPaymentForm] = useState<CreatePaymentForm>({
    amount: '',
    customerName: '',
    customerEmail: '',
    customerCpf: '',
    method: 'pix',
    description: '',
  });
  const [paymentError, setPaymentError] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentResponse, setPaymentResponse] = useState<any>(null);

  const isAdminMaster = user.role === 'admin-master' || user.role === 'admin';
  const workingCondoId = selectedCondoId || user.condoId;

  // Load condominium list for Admin Master
  useEffect(() => {
    if (isAdminMaster) loadCondominiums();
  }, [isAdminMaster]);

  const loadCondominiums = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/condos', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setCondos(data.condominiums || data);
      }
    } catch (err) {
      console.error('Error ao carregar condomínios:', err);
    }
  };

  // Load gateway config and payments
  useEffect(() => {
    if (workingCondoId) {
      loadGatewayConfig();
      loadPayments();
      loadGatewayStatus();

      const interval = setInterval(() => {
        loadGatewayStatus();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [workingCondoId]);

  const loadGatewayConfig = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/gateway/configs?condoId=${workingCondoId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.configs && data.configs.length > 0) setGateway(data.configs[0]);
      }
    } catch (err) {
      console.error('Error ao carregar config:', err);
    }
  }, [workingCondoId]);

  const loadPayments = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/gateway/payments?condoId=${workingCondoId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch (err) {
      console.error('Error ao carregar pagamentos:', err);
    }
  }, [workingCondoId]);

  const loadGatewayStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/gateway/status?condoId=${workingCondoId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.statuses && data.statuses.length > 0) setGatewayStatus(data.statuses[0]);
      }
    } catch (err) {
      console.error('Error ao carregar status:', err);
    }
  }, [workingCondoId]);

  const testConnection = async () => {
    if (!configApiKey) { setConfigError('API Key é obrigatória'); return; }
    setTestingConnection(true); setConfigError(''); setConfigSuccess('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/gateway/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: configProvider, apiKey: configApiKey, environment: configEnv }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfigSuccess(`✓ Conexão testada com sucesso! (${data.latency || 0}ms)`);
      } else {
        const data = await res.json();
        setConfigError(data.error || 'Falha na conexão');
      }
    } catch (err: any) {
      setConfigError(err.message || 'Error ao testar conexão');
    } finally {
      setTestingConnection(false);
    }
  };

  const saveGatewayConfig = async () => {
    if (!configApiKey) { setConfigError('API Key é obrigatória'); return; }
    setLoading(true); setConfigError(''); setConfigSuccess('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/gateway/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: configProvider, apiKey: configApiKey, environment: configEnv, condoId: workingCondoId }),
      });
      if (res.ok) {
        const data = await res.json();
        setGateway(data.config);
        setConfigSuccess('✓ Gateway configurado com sucesso!');
        setConfigApiKey('');
        loadGatewayStatus();
        setTimeout(() => setActiveTab('dashboard'), 1500);
      } else {
        const data = await res.json();
        setConfigError(data.error || 'Error ao salvar configuração');
      }
    } catch (err: any) {
      setConfigError(err.message || 'Error ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const createPayment = async () => {
    const errors = [];
    if (!paymentForm.amount) errors.push('Valor é obrigatório');
    if (!paymentForm.customerName) errors.push('Nome é obrigatório');
    if (!paymentForm.customerEmail) errors.push('Email é obrigatório');
    if (!paymentForm.customerCpf) errors.push('CPF é obrigatório');
    if (errors.length > 0) { setPaymentError(errors.join(', ')); return; }

    setCreatingPayment(true); setPaymentError(''); setPaymentResponse(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/gateway/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          condoId: workingCondoId,
          amount: parseFloat(paymentForm.amount),
          customerName: paymentForm.customerName,
          customerEmail: paymentForm.customerEmail,
          customerCpf: paymentForm.customerCpf,
          method: paymentForm.method,
          description: paymentForm.description || 'Cobrança INOVATECH CONNECT',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentResponse(data);
        setPaymentForm({ amount: '', customerName: '', customerEmail: '', customerCpf: '', method: 'pix', description: '' });
        loadPayments();
        loadGatewayStatus();
      } else {
        const data = await res.json();
        setPaymentError(data.error || 'Error ao criar cobrança');
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Error ao criar cobrança');
    } finally {
      setCreatingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* HEADER COM SELETOR DE CONDOMÍNIO */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              💳 Gateway de Pagamento
            </h1>
            {isAdminMaster && (
              <button
                onClick={() => setShowCondoSelector(!showCondoSelector)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm"
              >
                🏢 {selectedCondoId ? 'Trocar Condomínio' : 'Selecionar Condomínio'}
              </button>
            )}
          </div>
          <p className="text-slate-600 mt-1">Gerencie cobranças e configure gateways de pagamento</p>
        </div>

        {/* CONDOMINIUM SELECTOR PARA ADMIN MASTER */}
        {isAdminMaster && showCondoSelector && (
          <div className="mb-6 bg-white rounded-lg shadow-lg p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4">🏢 Selecione um Condomínio</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {condos.map(condo => (
                <button
                  key={condo.id}
                  onClick={() => {
                    setSelectedCondoId(condo.id);
                    setShowCondoSelector(false);
                    setActiveTab('dashboard');
                  }}
                  className={`p-3 rounded-lg text-left font-medium transition-all ${
                    selectedCondoId === condo.id
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {condo.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-2 mb-6 flex-wrap border-b border-slate-200">
          {[
            { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
            { id: 'config', label: '⚙️ Configuração', icon: '⚙' },
            { id: 'create', label: '➕ Nova Cobrança', icon: '➕' },
            { id: 'history', label: '📜 Histórico', icon: '📜' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {activeTab === 'dashboard' && (
            <GatewayDashboard
              gateway={gateway}
              gatewayStatus={gatewayStatus}
              payments={payments}
              onConfigureClick={() => setActiveTab('config')}
            />
          )}

          {activeTab === 'config' && (
            <GatewaySettings
              configProvider={configProvider}
              setConfigProvider={setConfigProvider}
              configEnv={configEnv}
              setConfigEnv={setConfigEnv}
              configBlockGraceDays={configBlockGraceDays}
              setConfigBlockGraceDays={setConfigBlockGraceDays}
              configApiKey={configApiKey}
              setConfigApiKey={setConfigApiKey}
              configError={configError}
              configSuccess={configSuccess}
              testingConnection={testingConnection}
              testConnection={testConnection}
              loading={loading}
              saveGatewayConfig={saveGatewayConfig}
            />
          )}

          {activeTab === 'create' && (
            <CreateChargeForm
              gateway={gateway}
              paymentForm={paymentForm}
              setPaymentForm={setPaymentForm}
              paymentError={paymentError}
              creatingPayment={creatingPayment}
              paymentResponse={paymentResponse}
              createPayment={createPayment}
              onConfigureClick={() => setActiveTab('config')}
            />
          )}

          {activeTab === 'history' && (
            <PaymentHistory payments={payments} />
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentGatewayUI;
