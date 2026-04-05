interface GatewaySettingsProps {
  configProvider: string;
  setConfigProvider: (val: string) => void;
  configEnv: string;
  setConfigEnv: (val: string) => void;
  configBlockGraceDays: string;
  setConfigBlockGraceDays: (val: string) => void;
  configBillingDay?: string;
  setConfigBillingDay?: (val: string) => void;
  configDefaultLicenseValue?: string;
  setConfigDefaultLicenseValue?: (val: string) => void;
  configAutoGenerateBillings?: boolean;
  setConfigAutoGenerateBillings?: (val: boolean) => void;
  configRecurrenceDay?: string;
  setConfigRecurrenceDay?: (val: string) => void;
  configAutoIssueCharges?: boolean;
  setConfigAutoIssueCharges?: (val: boolean) => void;
  configAutoIssueMethod?: 'pix' | 'boleto';
  setConfigAutoIssueMethod?: (val: 'pix' | 'boleto') => void;
  configApiKey: string;
  setConfigApiKey: (val: string) => void;
  hasSavedApiKey?: boolean;
  configError: string;
  configSuccess: string;
  testingConnection: boolean;
  testConnection: () => void;
  loading: boolean;
  saveGatewayConfig: () => void;
  canSave?: boolean;
  canRemove?: boolean;
  removeGatewayConfig?: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start justify-between rounded-xl border p-3 text-left transition ${
        checked
          ? 'border-slate-400 bg-slate-100'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
      }`}
    >
      <div>
        <p className="font-semibold text-slate-800">{label}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <span
        className={`mt-1 inline-flex h-6 w-11 rounded-full p-1 transition ${
          checked ? 'bg-slate-700' : 'bg-slate-300'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

export function GatewaySettings({
  configProvider,
  setConfigProvider,
  configEnv,
  setConfigEnv,
  configBlockGraceDays,
  setConfigBlockGraceDays,
  configBillingDay = '5',
  setConfigBillingDay = () => undefined,
  configDefaultLicenseValue = '299',
  setConfigDefaultLicenseValue = () => undefined,
  configAutoGenerateBillings = true,
  setConfigAutoGenerateBillings = () => undefined,
  configRecurrenceDay = '25',
  setConfigRecurrenceDay = () => undefined,
  configAutoIssueCharges = false,
  setConfigAutoIssueCharges = () => undefined,
  configAutoIssueMethod = 'boleto',
  setConfigAutoIssueMethod = () => undefined,
  configApiKey,
  setConfigApiKey,
  hasSavedApiKey = false,
  configError,
  configSuccess,
  testingConnection,
  testConnection,
  loading,
  saveGatewayConfig,
  canSave = Boolean(configApiKey || hasSavedApiKey),
  canRemove = false,
  removeGatewayConfig
}: GatewaySettingsProps) {
  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-gray-100 p-4">
        <h3 className="mb-1 text-sm font-black text-slate-800">Operacao financeira da plataforma</h3>
        <p className="text-xs text-slate-600">
          Defina o gateway principal, o vencimento da licenca e a rotina recorrente que gera as cobrancas mensais
          para todos os condominios ativos.
        </p>
      </div>

      <div className="grid gap-4">
        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Provider</label>
            <select
              value={configProvider}
              onChange={(e) => setConfigProvider(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="asaas">Asaas (PIX e boleto)</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Ambiente</label>
            <select
              value={configEnv}
              onChange={(e) => setConfigEnv(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Producao</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Valor padrao da licenca</label>
            <input
              type="number"
              min={1}
              step="0.01"
              value={configDefaultLicenseValue}
              onChange={(e) => setConfigDefaultLicenseValue(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="mt-1 text-[11px] text-slate-500">Usado como valor base nos novos condominios.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Dia de vencimento</label>
            <input
              type="number"
              min={1}
              max={28}
              value={configBillingDay}
              onChange={(e) => setConfigBillingDay(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="mt-1 text-[11px] text-slate-500">Dia do proximo mes em que a licenca vence.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Dias para bloqueio automatico</label>
            <input
              type="number"
              min={0}
              max={365}
              value={configBlockGraceDays}
              onChange={(e) => setConfigBlockGraceDays(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="mt-1 text-[11px] text-slate-500">Apos esse prazo de atraso, o condominio pode ser bloqueado.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Dia do ciclo recorrente</label>
            <input
              type="number"
              min={1}
              max={28}
              value={configRecurrenceDay}
              onChange={(e) => setConfigRecurrenceDay(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Dia do mes em que o sistema gera a competencia mensal automaticamente.
            </p>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <Toggle
            checked={configAutoGenerateBillings}
            onChange={setConfigAutoGenerateBillings}
            label="Recorrencia mensal ativa"
            description="Cria automaticamente a cobranca da licenca para todos os condominios ativos."
          />

          <Toggle
            checked={configAutoIssueCharges}
            onChange={setConfigAutoIssueCharges}
            label="Emitir no gateway automaticamente"
            description="Ao gerar a competencia, o sistema tambem cria a cobranca no gateway sem acao manual."
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Metodo da emissao automatica</label>
            <select
              value={configAutoIssueMethod}
              onChange={(e) => setConfigAutoIssueMethod(e.target.value as 'pix' | 'boleto')}
              disabled={!configAutoIssueCharges}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="boleto">Boleto</option>
              <option value="pix">PIX</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Para recorrencia operacional, boleto e PIX sao os metodos suportados automaticamente.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Como a automacao funciona</p>
            <p className="mt-2 text-xs text-slate-600">
              No dia do ciclo, o sistema verifica a competencia do mes, gera as cobrancas que ainda nao existem e,
              se ativado, emite cada uma no gateway.
            </p>
          </div>
        </section>

        <section>
          <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Chave de API</label>
          <input
            type="password"
            value={configApiKey}
            onChange={(e) => setConfigApiKey(e.target.value)}
            placeholder={hasSavedApiKey ? 'Deixe em branco para manter a chave atual' : 'Cole a chave de API aqui'}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            {hasSavedApiKey
              ? 'Uma chave ja esta salva. Preencha apenas se quiser trocar.'
              : 'A chave e usada para testar conexao e emitir cobrancas reais no gateway.'}
          </p>
        </section>
      </div>

      {configError && (
        <div className="mt-6 rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">{configError}</div>
      )}

      {configSuccess && (
        <div className="mt-6 rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">{configSuccess}</div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={testConnection}
          disabled={testingConnection || !configApiKey}
          className="w-full sm:min-w-[160px] sm:flex-1 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {testingConnection ? 'Testando...' : 'Testar conexao'}
        </button>

        <button
          onClick={saveGatewayConfig}
          disabled={loading || !canSave}
          className="w-full sm:min-w-[160px] sm:flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {loading ? 'Salvando...' : 'Salvar configuracao'}
        </button>

        {canRemove && removeGatewayConfig && (
          <button
            onClick={removeGatewayConfig}
            disabled={loading}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

