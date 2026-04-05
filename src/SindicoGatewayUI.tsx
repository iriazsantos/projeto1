import { useState, useEffect } from 'react';
import type { User } from './types';

interface GatewayConfig {
  id?: string;
  provider: string;
  environment?: string;
  isActive?: boolean;
  configured: boolean;
}

interface Resident {
  id: string;
  name: string;
  email: string;
  unit: string;
}

export function SindicoGatewayUI({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'create_charge'>('dashboard');
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Config
  const [provider, setProvider] = useState<'asaas' | 'mercadopago'>('asaas');
  const [apiKey, setApiKey] = useState('');
  const [env, setEnv] = useState<'sandbox' | 'production'>('production');

  // Form Charge
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedResident, setSelectedResident] = useState('ALL');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Taxa Condominial');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    loadConfig();
    loadResidents();
  }, []);

  const getToken = () => localStorage.getItem('auth_token');

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/sindico-gateway/config', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        const activeConfig = data?.configs?.[0];
        if (activeConfig) {
          setConfig({
            id: activeConfig.id,
            provider: activeConfig.provider,
            environment: activeConfig.environment,
            isActive: activeConfig.isActive,
            configured: true
          });
          setProvider(activeConfig.provider);
          setEnv(activeConfig.environment || 'production');
        } else {
          setConfig({ provider, configured: false });
        }
      }
    } catch (err) {
      console.error('Error ao carregar config do síndico:', err);
    }
  };

  const loadResidents = async () => {
    if (!user.condoId) return;
    try {
      const res = await fetch(`/api/users/by-condo/${user.condoId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResidents(data.filter((u: any) => u.role === 'morador' && u.active));
      }
    } catch (err) {
      console.error('Error ao carregar moradores:', err);
    }
  };

  const saveConfig = async () => {
    if (!apiKey) {
      setError('API Key é obrigatória');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/sindico-gateway/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ provider, apiKey, environment: env })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Gateway configurado com sucesso! Agora você pode cobrar os moradores.');
        loadConfig();
      } else {
        setError(data.error || 'Falha ao salvar configuração');
      }
    } catch (err: any) {
      setError('Error de conexão ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const createCharge = async () => {
    if (!selectedResident || !amount || !dueDate) {
      setError('Preencha todos os campos da cobrança');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const endpoint = selectedResident === 'ALL' 
        ? '/api/sindico-gateway/create-mass-charge'
        : '/api/sindico-gateway/create-charge';
        
      const body = selectedResident === 'ALL'
        ? { amount: parseFloat(amount), description, dueDate }
        : { residentId: selectedResident, amount: parseFloat(amount), description, dueDate };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (res.ok) {
        if (selectedResident === 'ALL') {
          const count = data?.created?.length ?? data?.count ?? 0;
          setSuccess(`Cobranças geradas com sucesso para ${count} moradores!`);
        } else {
          const chargeLink = data?.gateway?.boletoUrl || data?.gateway?.pixCode || data?.invoiceUrl;
          setSuccess(`Cobrança gerada com sucesso! ${chargeLink ? 'Cobrança pronta para envio.' : 'Envie o comprovante ao morador.'}`);
        }
        setAmount('');
        setSelectedResident('ALL');
      } else {
        setError(data.error || 'Falha ao gerar cobrança');
      }
    } catch (err: any) {
      setError('Error de conexão ao gerar cobrança');
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async () => {
    if (!confirm('Tem certeza que deseja remover a configuração do gateway? Você não poderá mais gerar cobranças até configurar novamente.')) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/sindico-gateway/config', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        setConfig({ provider, configured: false });
        setApiKey('');
        setSuccess('Configuração removida com sucesso!');
        setActiveTab('config');
      } else {
        const data = await res.json();
        setError(data.error || 'Error ao remover configuração');
      }
    } catch (err) {
      setError('Error de conexão ao remover configuração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              🏠 Financeiro do Condomínio
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie as cobranças dos seus moradores de forma isolada e segura.
            </p>
          </div>
          <div className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 ${
            config?.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            <div className={`w-3 h-3 rounded-full ${config?.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {config?.configured ? 'Gateway Ativo' : 'Gateway Pendente'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {(['dashboard', 'create_charge', 'config'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-white shadow text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'dashboard' ? '📊 Visão Geral' : tab === 'create_charge' ? '💰 Nova Cobrança' : '⚙️ Configuração'}
          </button>
        ))}
      </div>

      {/* Alertas globais da aba atual */}
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">❌ {error}</div>}
      {success && <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">✅ {success}</div>}

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center relative">
          {config?.configured ? (
            <div className="space-y-4">
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => setActiveTab('config')} 
                  className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Editar Configuração"
                >
                  ✏️
                </button>
                <button 
                  onClick={deleteConfig} 
                  disabled={loading}
                  className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Remover Gateway"
                >
                  🗑️
                </button>
              </div>
              
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
              <h3 className="text-xl font-bold">Seu Gateway está pronto!</h3>
              <p className="text-gray-500">Você está conectado usando <b>{config.provider.toUpperCase()}</b>.</p>
              <p className="text-sm text-gray-400">Todo o dinheiro das cobranças irá direto para a sua conta.</p>
              <button onClick={() => setActiveTab('create_charge')} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">
                Criar Primeira Cobrança
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
              <h3 className="text-xl font-bold">Configure seu Gateway</h3>
              <p className="text-gray-500">Para começar a cobrar os moradores, você precisa configurar a chave da sua conta (Asaas ou Mercado Pago).</p>
              <button onClick={() => setActiveTab('config')} className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600">
                Ir para Configurações
              </button>
            </div>
          )}
        </div>
      )}

      {/* Criar Cobrança */}
      {activeTab === 'create_charge' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Gerar Nova Cobrança (Morador)</h3>
          
          {!config?.configured ? (
            <div className="p-4 bg-amber-50 text-amber-700 rounded-xl">⚠️ Configure o gateway na aba "Configuração" antes de gerar cobranças.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Morador <span className="text-red-500">*</span></label>
                  <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50">
                    <option value="ALL">🌟 Cobrar todos os moradores ({residents.length})</option>
                    <optgroup label="Cobrança Individual">
                      {residents.map(r => (
                        <option key={r.id} value={r.id}>{r.name} (Unidade {r.unit || 'N/A'})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Valor (R$) <span className="text-red-500">*</span></label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 border rounded-xl bg-gray-50" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Taxa Condominial - Maio/2024" className="w-full p-3 border rounded-xl bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Vencimento <span className="text-red-500">*</span></label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50" />
                </div>
              </div>
              <div className="col-span-full pt-4 border-t">
                <button 
                  onClick={createCharge} 
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors text-lg shadow-lg"
                >
                  {loading ? 'Gerando cobrança...' : 'Gerar Boleto / PIX'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Configuração */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Sua Conta de Recebimento</h3>
          <p className="text-sm text-gray-500 mb-6">Insira a API Key da conta do condomínio. Todo o dinheiro cairá diretamente lá, sem passar pela plataforma.</p>
          
          <div className="max-w-2xl space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Provedor</label>
                <select value={provider} onChange={e => setProvider(e.target.value as any)} className="w-full p-3 border rounded-xl">
                  <option value="asaas">Asaas</option>
                  <option value="mercadopago">Mercado Pago</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ambiente</label>
                <select value={env} onChange={e => setEnv(e.target.value as any)} className="w-full p-3 border rounded-xl">
                  <option value="production">🚀 Produção (Real)</option>
                  <option value="sandbox">🧪 Sandbox (Teste)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">API Key do Condomínio <span className="text-red-500">*</span></label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Cole a chave de API aqui..." className="w-full p-3 border rounded-xl font-mono text-sm" />
            </div>
            
            <div className="pt-4 border-t flex flex-wrap gap-3">
              <button
                onClick={saveConfig}
                disabled={loading || !apiKey}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Configuração Segura'}
              </button>
              {config?.configured && (
                <button
                  onClick={deleteConfig}
                  disabled={loading}
                  className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  Remover Gateway
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

