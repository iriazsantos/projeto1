import { useEffect, useState } from 'react';
import type { User } from './types';
import type { GatewayConfig, GatewayStatus } from './components/gateway/GatewayTypes';
import { GatewayDashboard } from './components/gateway/GatewayDashboard';
import { GatewaySettings } from './components/gateway/GatewaySettings';

export function PaymentGatewayUI({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config'>('dashboard');
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const [configProvider, setConfigProvider] = useState<string>('asaas');
  const [configApiKey, setConfigApiKey] = useState('');
  const [configEnv, setConfigEnv] = useState<string>('production');
  const [configBlockGraceDays, setConfigBlockGraceDays] = useState<string>('30');
  const [configBillingDay, setConfigBillingDay] = useState<string>('5');
  const [configDefaultLicenseValue, setConfigDefaultLicenseValue] = useState<string>('299');
  const [configAutoGenerateBillings, setConfigAutoGenerateBillings] = useState(true);
  const [configRecurrenceDay, setConfigRecurrenceDay] = useState<string>('25');
  const [configAutoIssueCharges, setConfigAutoIssueCharges] = useState(false);
  const [configAutoIssueMethod, setConfigAutoIssueMethod] = useState<'pix' | 'boleto'>('boleto');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSuccess, setConfigSuccess] = useState('');

  const isAdmin = user.role === 'admin' || user.role === 'admin-master';
  const canSaveConfig = Boolean(configApiKey || hasSavedApiKey);

  useEffect(() => {
    void loadMasterGatewayConfig();
  }, []);

  const getToken = () => localStorage.getItem('auth_token') || localStorage.getItem('authToken');

  const resetConfigState = () => {
    setGatewayConfig(null);
    setConfigApiKey('');
    setConfigProvider('asaas');
    setConfigEnv('production');
    setConfigBlockGraceDays('30');
    setConfigBillingDay('5');
    setConfigDefaultLicenseValue('299');
    setConfigAutoGenerateBillings(true);
    setConfigRecurrenceDay('25');
    setConfigAutoIssueCharges(false);
    setConfigAutoIssueMethod('boleto');
    setHasSavedApiKey(false);
    setIsConnected(false);
    setLastCheck(null);
  };

  const loadMasterGatewayConfig = async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/master-gateway/master/config', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      if (!data.configured) {
        resetConfigState();
        return;
      }

      setGatewayConfig(data.config);
      setConfigProvider(data.config.provider || 'asaas');
      setConfigEnv(data.config.environment || 'production');
      setConfigBlockGraceDays(String(data.config.blockGraceDays ?? 30));
      setConfigBillingDay(String(data.config.billingDay ?? 5));
      setConfigDefaultLicenseValue(String(data.config.defaultLicenseValue ?? 299));
      setConfigAutoGenerateBillings(Boolean(data.config.autoGenerateBillings ?? true));
      setConfigRecurrenceDay(String(data.config.recurrenceDay ?? 25));
      setConfigAutoIssueCharges(Boolean(data.config.autoIssueCharges ?? false));
      setConfigAutoIssueMethod(data.config.autoIssueMethod === 'pix' ? 'pix' : 'boleto');
      setHasSavedApiKey(true);
      setConfigApiKey('');
      setIsConnected(Boolean(data.config.isActive));
      setLastCheck(data.config.lastHealthCheck ? new Date(data.config.lastHealthCheck) : null);
    } catch (err) {
      console.error('Error ao carregar config:', err);
    }
  };

  const testConnection = async () => {
    if (!configApiKey) {
      setConfigError('Informe a API Key para testar a conexao.');
      return;
    }

    setTestingConnection(true);
    setConfigError('');
    setConfigSuccess('');

    try {
      const token = getToken();
      const res = await fetch('/api/gateway/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider: configProvider,
          apiKey: configApiKey,
          environment: configEnv
        })
      });

      const data = await res.json();
      if (data.connected) {
        setConfigSuccess(`Conexao validada com sucesso (${data.latency || 0}ms).`);
        setIsConnected(true);
        setLastCheck(new Date());
      } else {
        setConfigError(data.message || 'Falha na conexao com o gateway.');
        setIsConnected(false);
      }
    } catch (err: any) {
      setConfigError(err.message || 'Falha ao testar conexao.');
      setIsConnected(false);
    } finally {
      setTestingConnection(false);
    }
  };

  const saveGatewayConfig = async () => {
    if (!canSaveConfig) {
      setConfigError('Informe a API Key ou mantenha uma configuracao ja salva.');
      return;
    }

    setLoading(true);
    setConfigError('');
    setConfigSuccess('');

    try {
      const token = getToken();
      const res = await fetch('/api/master-gateway/master/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider: configProvider,
          apiKey: configApiKey || undefined,
          environment: configEnv,
          defaultLicenseValue: Number.parseFloat(configDefaultLicenseValue || '299') || 299,
          billingDay: Number.parseInt(configBillingDay || '5', 10) || 5,
          blockGraceDays: Number.parseInt(configBlockGraceDays || '30', 10) || 30,
          autoGenerateBillings: configAutoGenerateBillings,
          recurrenceDay: Number.parseInt(configRecurrenceDay || '25', 10) || 25,
          autoIssueCharges: configAutoIssueCharges,
          autoIssueMethod: configAutoIssueMethod
        })
      });

      const data = await res.json();
      if (res.ok) {
        setConfigSuccess('Configuracao salva com sucesso.');
        setHasSavedApiKey(true);
        await loadMasterGatewayConfig();
        setTimeout(() => setActiveTab('dashboard'), 1200);
      } else {
        setConfigError(data.error || 'Falha ao salvar configuracao.');
      }
    } catch (err: any) {
      setConfigError(err.message || 'Falha ao salvar configuracao.');
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async () => {
    if (!confirm('Remover a configuracao master do gateway? Novas cobrancas nao poderao ser emitidas ate configurar novamente.')) {
      return;
    }

    setLoading(true);
    setConfigError('');
    setConfigSuccess('');

    try {
      const token = getToken();
      const res = await fetch('/api/master-gateway/master/config', {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (res.ok) {
        resetConfigState();
        setConfigSuccess('Configuracao removida com sucesso.');
        setActiveTab('config');
      } else {
        const data = await res.json();
        setConfigError(data.error || 'Error ao remover configuracao.');
      }
    } catch (err) {
      setConfigError('Error de conexao ao remover configuracao.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-700">
        Acesso permitido apenas para administracao da plataforma.
      </div>
    );
  }

  const dummyStatus: GatewayStatus | null = gatewayConfig ? {
    id: gatewayConfig.id,
    provider: gatewayConfig.provider,
    isConnected,
    lastHealthCheck: lastCheck?.toISOString() || new Date().toISOString(),
    lastSuccessfulRequest: new Date().toISOString(),
    requestsSent: 0,
    requestsReceived: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    consecutiveFailures: 0,
    lastError: '',
    lastErrorAt: '',
    trafficPercentage: 100
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 pb-6">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 px-6 py-8 shadow-2xl border border-white/10">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
            <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">Financeiro Master</p>
              <h1 className="mt-1 text-xl font-black text-white sm:text-2xl">Configuracao de Gateway de Pagamento</h1>
              <p className="mt-1 text-xs text-white/80 sm:text-sm">
                Ajuste o gateway raiz, a recorrencia mensal e a emissao automatica no padrao visual do painel.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white">
                Ambiente: {configEnv === 'production' ? 'Producao' : 'Sandbox'}
              </span>
              <span className={`rounded-full border px-3 py-1 ${isConnected ? 'border-white/35 bg-white/20 text-white' : 'border-white/20 bg-black/10 text-white/85'}`}>
                {isConnected ? 'Gateway conectado' : 'Gateway pendente'}
              </span>
            </div>
          </div>
        </header>

        <div className="mt-6 premium-card p-2">
          <div className="mb-2 flex flex-wrap gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'config', label: 'Configuracao Master' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'dashboard' | 'config')}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {activeTab === 'dashboard' && (
              <GatewayDashboard
                gateway={gatewayConfig}
                gatewayStatus={dummyStatus}
                payments={[]}
                onConfigureClick={() => setActiveTab('config')}
                onDeleteClick={deleteConfig}
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
                configBillingDay={configBillingDay}
                setConfigBillingDay={setConfigBillingDay}
                configDefaultLicenseValue={configDefaultLicenseValue}
                setConfigDefaultLicenseValue={setConfigDefaultLicenseValue}
                configAutoGenerateBillings={configAutoGenerateBillings}
                setConfigAutoGenerateBillings={setConfigAutoGenerateBillings}
                configRecurrenceDay={configRecurrenceDay}
                setConfigRecurrenceDay={setConfigRecurrenceDay}
                configAutoIssueCharges={configAutoIssueCharges}
                setConfigAutoIssueCharges={setConfigAutoIssueCharges}
                configAutoIssueMethod={configAutoIssueMethod}
                setConfigAutoIssueMethod={setConfigAutoIssueMethod}
                configApiKey={configApiKey}
                setConfigApiKey={setConfigApiKey}
                hasSavedApiKey={hasSavedApiKey}
                configError={configError}
                configSuccess={configSuccess}
                testingConnection={testingConnection}
                testConnection={testConnection}
                loading={loading}
                saveGatewayConfig={saveGatewayConfig}
                canSave={canSaveConfig}
                canRemove={Boolean(gatewayConfig)}
                removeGatewayConfig={deleteConfig}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
