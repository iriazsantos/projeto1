import { useEffect, useState } from 'react';

type Condo = {
  id: string;
  name: string;
  city?: string;
  units?: number;
  residents?: number;
};

type GatewayConfig = {
  id: string;
  provider: string;
  name: string;
  environment: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProviderId = 'asaas' | 'mercadopago' | 'stripe';

const PROVIDERS = [
  { id: 'asaas' as ProviderId, name: 'Asaas', hint: 'PIX e Boleto', color: 'from-green-500 to-emerald-600', icon: '💚', bg: 'bg-green-50' },
  { id: 'mercadopago' as ProviderId, name: 'Mercado Pago', hint: 'PIX, Boleto e Cartão', color: 'from-blue-400 to-cyan-500', icon: '💙', bg: 'bg-blue-50' },
  { id: 'stripe' as ProviderId, name: 'Stripe', hint: 'Cartão de Crédito', color: 'from-violet-500 to-purple-600', icon: '💜', bg: 'bg-violet-50' },
];

function getToken() {
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Falha ${response.status}`);
  }

  return data as T;
}

export function GatewayConfigSection() {
  const [condos, setCondos] = useState<Condo[]>([]);
  const [selectedCondoId, setSelectedCondoId] = useState('');
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [provider, setProvider] = useState<ProviderId>('asaas');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    const loadCondos = async () => {
      try {
        const data = await fetchJson<Condo[]>('/api/condos');
        setCondos(data);
        if (data.length > 0) setSelectedCondoId(data[0].id);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'Falha ao carregar condomínios');
        setFeedbackType('error');
      } finally {
        setLoading(false);
      }
    };
    void loadCondos();
  }, []);

  useEffect(() => {
    if (!selectedCondoId) return;
    const loadConfigs = async () => {
      try {
        const data = await fetchJson<{ success: boolean; configs: GatewayConfig[] }>(`/api/gateway/configs?condoId=${selectedCondoId}`);
        setConfigs(data.configs || []);
      } catch (error) {
        setConfigs([]);
      }
    };
    void loadConfigs();
  }, [selectedCondoId]);

  const selectedCondo = condos.find(c => c.id === selectedCondoId);

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setFeedback('Informe a API Key para testar a conexão.');
      setFeedbackType('error');
      return;
    }
    setTesting(true);
    setFeedback('');
    try {
      const result = await fetchJson<{ connected: boolean; latency?: number; message?: string }>('/api/gateway/test-connection', {
        method: 'POST',
        body: JSON.stringify({ provider, apiKey: apiKey.trim(), environment }),
      });
      setFeedback(result.connected ? `✅ Conexão estabelecida com sucesso${result.latency ? ` (${result.latency}ms)` : ''}.` : (result.message || 'Falha na conexão.'));
      setFeedbackType(result.connected ? 'success' : 'error');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao testar conexão');
      setFeedbackType('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCondoId) {
      setFeedback('Selecione um condomínio.');
      setFeedbackType('error');
      return;
    }
    if (!apiKey.trim()) {
      setFeedback('Informe a API Key.');
      setFeedbackType('error');
      return;
    }
    setSaving(true);
    setFeedback('');
    try {
      await fetchJson('/api/gateway/configs', {
        method: 'POST',
        body: JSON.stringify({ condoId: selectedCondoId, provider, apiKey: apiKey.trim(), environment }),
      });
      const data = await fetchJson<{ success: boolean; configs: GatewayConfig[] }>(`/api/gateway/configs?condoId=${selectedCondoId}`);
      setConfigs(data.configs || []);
      setApiKey('');
      setFeedback('✅ Gateway configurado com sucesso!');
      setFeedbackType('success');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao salvar');
      setFeedbackType('error');
    } finally {
      setSaving(false);
    }
  };

  const selectedProvider = PROVIDERS.find(p => p.id === provider);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">💳 Gateway de Pagamento</h2>
            <p className="text-sm text-gray-500 mt-1">Configure as formas de pagamento do seu condomínio</p>
          </div>
          {selectedCondo && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl text-white shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl">🏢</div>
              <div>
                <p className="text-xs font-semibold text-white/80">Condomínio</p>
                <p className="font-bold">{selectedCondo.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuração */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
          {/* Header do Card */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-4">
            <h3 className="text-lg font-bold text-white">⚙️ Configurar Gateway</h3>
            <p className="text-xs text-white/80 mt-0.5">Escolha o provedor e configure sua chave</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Condomínio */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">🏢 Condomínio</label>
              <select
                value={selectedCondoId}
                onChange={e => setSelectedCondoId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <option value="">Selecione...</option>
                {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Provedores */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">💳 Provedor de Pagamento</label>
              <div className="grid gap-3">
                {PROVIDERS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setProvider(item.id)}
                    className={`relative p-4 rounded-2xl border-2 transition-all duration-200 ${
                      provider === item.id
                        ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-lg scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl shadow-lg`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.hint}</p>
                      </div>
                      {provider === item.id && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold">✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ambiente */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">🌐 Ambiente</label>
              <div className="flex gap-3">
                {(['sandbox', 'production'] as const).map(env => (
                  <button
                    key={env}
                    type="button"
                    onClick={() => setEnvironment(env)}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      environment === env
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {env === 'sandbox' ? '🧪 Sandbox' : '🚀 Produção'}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">🔑 API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Cole sua chave de API aqui..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`p-4 rounded-xl border-2 ${
                feedbackType === 'success'
                  ? 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                <p className="text-sm font-semibold">{feedback}</p>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? '⏳ Testando...' : '🧪 Testar Conexão'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '⏳ Salvando...' : '💾 Salvar Configuração'}
              </button>
            </div>
          </div>
        </div>

        {/* Gateways Salvos */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
          {/* Header do Card */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-4">
            <h3 className="text-lg font-bold text-white">📋 Gateways Configurados</h3>
            <p className="text-xs text-white/80 mt-0.5">Configurações salvas para este condomínio</p>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-3">Carregando...</p>
              </div>
            ) : !selectedCondoId ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <span className="text-4xl mb-3">🏢</span>
                <p className="text-sm">Selecione um condomínio</p>
              </div>
            ) : configs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-sm">Nenhum gateway configurado</p>
                <p className="text-xs mt-1">Configure seu primeiro gateway ao lado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {configs.map(config => {
                  const prov = PROVIDERS.find(p => p.id === config.provider);
                  return (
                    <div key={config.id} className={`p-4 rounded-2xl border-2 ${prov?.bg || 'bg-gray-50'} border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-200`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${prov?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center text-xl shadow-lg`}>
                            {prov?.icon || '💳'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{config.name}</p>
                            <p className="text-xs text-gray-500">{config.provider} · {config.environment}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                          config.isActive
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {config.isActive ? '✓ Ativo' : '✕ Inativo'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>📅 {new Date(config.updatedAt).toLocaleDateString('pt-BR')}</span>
                        <span>🕐 {new Date(config.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
