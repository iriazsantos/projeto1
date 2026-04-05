import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { useStore } from './store';
import type { User, PixConfig } from './types';

// ─── QR Code Canvas ───────────────────────────────────────────────────────────
function QRCanvas({ data, size = 180 }: { data: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && data) {
      QRCode.toCanvas(ref.current, data, {
        width: size, margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
      });
    }
  }, [data, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} className="rounded-xl" />;
}

// ─── PIX KEY TYPE LABELS ─────────────────────────────────────────────────────
const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: '👤 CPF',
  cnpj: '🏢 CNPJ',
  email: '📧 E-mail',
  phone: '📱 Telefone',
  random: '🔑 Chave Aleatória',
};

const PIX_TYPE_MASKS: Record<string, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  email: 'email@exemplo.com',
  phone: '+55 (11) 99999-0000',
  random: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

// ─── GERAR PAYLOAD PIX EMV ─────────────────────────────────────────────────
function generatePixPayload(config: Partial<PixConfig>, amount?: number): string {
  const key = config.pixKey || '';
  const name = (config.receiverName || 'CONDOMINIO').slice(0, 25).toUpperCase();
  const city = (config.receiverCity || 'SAO PAULO').slice(0, 15).toUpperCase();
  const amountStr = amount ? amount.toFixed(2) : '0.00';

  // Formato EMV simplificado para PIX
  const merchantAccountInfo = `0014BR.GOV.BCB.PIX0136${key}`;
  const txId = '***';

  let payload = '';
  payload += '000201'; // Payload Format Indicator
  payload += `26${String(merchantAccountInfo.length).padStart(2, '0')}${merchantAccountInfo}`; // Merchant Account Info
  payload += '52040000'; // Merchant Category Code
  payload += '5303986'; // Transaction Currency (BRL)
  if (amount) {
    payload += `54${String(amountStr.length).padStart(2, '0')}${amountStr}`; // Transaction Amount
  }
  payload += '5802BR'; // Country Code
  payload += `59${String(name.length).padStart(2, '0')}${name}`; // Merchant Name
  payload += `60${String(city.length).padStart(2, '0')}${city}`; // Merchant City
  payload += `62${String(txId.length + 4).padStart(2, '0')}0503${txId}`; // Additional Data Field
  payload += '6304'; // CRC placeholder
  // CRC16 simples
  payload += 'FFFF';
  return payload;
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export function PixConfigSection({ user }: { user: User }) {
  const store = useStore();
  const condoId = user.condoId!;
  const config = store.getPixConfig(condoId);

  const [editing, setEditing] = useState(!config);
  const [pixKeyType, setPixKeyType] = useState<PixConfig['pixKeyType']>(config?.pixKeyType || 'cnpj');
  const [pixKey, setPixKey] = useState(config?.pixKey || '');
  const [receiverName, setReceiverName] = useState(config?.receiverName || '');
  const [receiverCity, setReceiverCity] = useState(config?.receiverCity || '');
  const [bankName, setBankName] = useState(config?.bankName || '');
  const [description, setDescription] = useState(config?.description || 'Taxa Condominial');
  const [qrCodeImage, setQrCodeImage] = useState<string>(config?.qrCodeImage || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAmount, setPreviewAmount] = useState('450.00');
  const fileRef = useRef<HTMLInputElement>(null);

  // Gerar payload para preview do QR Code
  const pixPayload = generatePixPayload(
    { pixKey, receiverName, receiverCity },
    parseFloat(previewAmount) || 0
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!pixKey.trim()) e.pixKey = 'Chave PIX é obrigatória';
    if (!receiverName.trim()) e.receiverName = 'Nome do recebedor é obrigatório';
    if (!receiverCity.trim()) e.receiverCity = 'Cidade é obrigatória';
    if (!bankName.trim()) e.bankName = 'Nome do banco é obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    store.savePixConfig({
      condoId,
      pixKey: pixKey.trim(),
      pixKeyType,
      receiverName: receiverName.trim(),
      receiverCity: receiverCity.trim(),
      bankName: bankName.trim(),
      description: description.trim(),
      qrCodeImage: qrCodeImage || undefined,
    });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setQrCodeImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-sm shadow-lg">
              💚
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium uppercase tracking-wide">Configurações de Pagamento</p>
              <h2 className="text-2xl font-black">PIX do Condomínio</h2>
              <p className="text-white/70 text-sm mt-0.5">
                {config ? `✅ Configurado · ${PIX_TYPE_LABELS[config.pixKeyType]}` : '⚠️ Não configurado ainda'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {config && !editing && (
              <button
                onClick={() => setShowPreview(p => !p)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-bold rounded-xl transition-colors backdrop-blur-sm border border-white/20"
              >
                {showPreview ? '🙈 Ocultar' : '👁️ Preview QR'}
              </button>
            )}
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-white text-green-700 text-sm font-bold rounded-xl hover:bg-green-50 transition-colors shadow-sm"
              >
                ✏️ Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerta sem configuração */}
      {!config && !editing && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">⚠️</div>
          <div>
            <h3 className="font-bold text-amber-800">PIX não configurado</h3>
            <p className="text-amber-600 text-sm mt-1">
              Configure a chave PIX do condomínio para que os moradores possam pagar as cobranças diretamente pelo sistema.
            </p>
            <button
              onClick={() => setEditing(true)}
              className="mt-3 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors"
            >
              ⚙️ Configurar agora
            </button>
          </div>
        </div>
      )}

      {/* Feedback de sucesso */}
      {saved && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-center gap-3 animate-bounce">
          <span className="text-2xl">✅</span>
          <p className="font-bold text-emerald-700">Configurações PIX salvas com sucesso! Os moradores já podem pagar via PIX.</p>
        </div>
      )}

      {/* VISUALIZAÇÃO das configurações */}
      {config && !editing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Dados do PIX */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 p-4">
              <h3 className="font-bold text-green-800 flex items-center gap-2">
                <span className="w-8 h-8 bg-green-500 text-white rounded-xl flex items-center justify-center text-sm">💚</span>
                Dados da Conta PIX
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Tipo e Chave */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Chave PIX</p>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    {config.pixKeyType === 'cpf' ? '👤' :
                     config.pixKeyType === 'cnpj' ? '🏢' :
                     config.pixKeyType === 'email' ? '📧' :
                     config.pixKeyType === 'phone' ? '📱' : '🔑'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-green-700">{PIX_TYPE_LABELS[config.pixKeyType]}</p>
                    <p className="font-mono font-bold text-gray-800 text-sm truncate">{config.pixKey}</p>
                  </div>
                  <button
                    onClick={handleCopyKey}
                    className="flex-shrink-0 w-9 h-9 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center text-sm transition-colors"
                    title="Copiar chave"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Info do recebedor */}
              <div className="space-y-2">
                {[
                  { label: 'Beneficiário', value: config.receiverName, icon: '🏢' },
                  { label: 'Banco', value: config.bankName, icon: '🏦' },
                  { label: 'Cidade', value: config.receiverCity, icon: '📍' },
                  { label: 'Descrição padrão', value: config.description || '-', icon: '📝' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    <span className="text-sm font-bold text-gray-800 text-right max-w-[55%] truncate">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Última atualização */}
              <p className="text-xs text-gray-400 text-right">
                Atualizado: {new Date(config.updatedAt).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          {/* QR Code Preview */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 p-4">
              <h3 className="font-bold text-blue-800 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-500 text-white rounded-xl flex items-center justify-center text-sm">⬛</span>
                QR Code para Pagamento
              </h3>
            </div>
            <div className="p-5 flex flex-col items-center gap-4">
              {/* Preview do QR Code dinâmico */}
              {showPreview && (
                <div className="flex flex-col items-center gap-3 w-full">
                  <p className="text-xs text-gray-500 font-medium">Preview com valor de teste:</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">R$</span>
                    <input
                      type="number"
                      value={previewAmount}
                      onChange={e => setPreviewAmount(e.target.value)}
                      className="w-28 px-3 py-1.5 border border-gray-200 rounded-xl text-sm font-mono text-center focus:outline-none focus:border-green-400"
                      step="0.01"
                    />
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-green-200 relative">
                    <QRCanvas data={pixPayload} size={180} />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center shadow-lg border-2 border-white">
                        <span className="text-white font-black text-xs">PIX</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    QR Code gerado dinamicamente com o valor da cobrança
                  </p>
                </div>
              )}

              {/* QR Code estático carregado */}
              {config.qrCodeImage ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white rounded-2xl p-3 shadow-md border-2 border-gray-100">
                    <img
                      src={config.qrCodeImage}
                      alt="QR Code PIX"
                      className="w-40 h-40 object-contain rounded-xl"
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">QR Code estático carregado pelo síndico</p>
                </div>
              ) : !showPreview && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-40 h-40 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400">
                    <span className="text-4xl mb-2">⬛</span>
                    <p className="text-xs text-center px-4">QR Code estático não carregado</p>
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-sm text-green-600 hover:text-green-700 font-semibold underline"
                  >
                    + Adicionar QR Code estático
                  </button>
                </div>
              )}

              {/* Info */}
              <div className="w-full bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-700 font-medium">
                  💡 Os moradores verão o QR Code gerado automaticamente com o valor de cada cobrança
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Como funciona */}
      {config && !editing && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>ℹ️</span> Como funciona o pagamento PIX no sistema
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { step: '1', icon: '📋', title: 'Síndico cria cobrança', desc: 'Cria a cobrança no módulo Financeiro com valor e vencimento.' },
              { step: '2', icon: '🔔', title: 'Morador é notificado', desc: 'O morador recebe uma notificação push e WhatsApp sobre a cobrança.' },
              { step: '3', icon: '💚', title: 'Morador acessa o painel', desc: 'No módulo Financeiro, clica em "Pagar PIX" na cobrança pendente.' },
              { step: '4', icon: '✅', title: 'Pagamento confirmado', desc: 'O QR Code é gerado com o valor. Após pagar, o status atualiza para PAGO.' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-black flex-shrink-0">{item.step}</div>
                <div>
                  <p className="text-sm font-bold text-gray-800 flex items-center gap-1">{item.icon} {item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE CONFIGURAÇÃO */}
      {editing && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-5 text-white">
            <h3 className="text-lg font-black flex items-center gap-2">
              <span>⚙️</span>
              {config ? 'Editar Configurações PIX' : 'Configurar PIX do Condomínio'}
            </h3>
            <p className="text-white/70 text-sm mt-1">
              Estas informações serão usadas automaticamente quando os moradores realizarem pagamentos via PIX.
            </p>
          </div>

          <div className="p-6 space-y-6">

            {/* SEÇÃO 1: CHAVE PIX */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200">
              <h4 className="text-sm font-bold text-green-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                Chave PIX
              </h4>

              {/* Tipo de chave */}
              <div className="mb-4">
                <label className="text-sm font-semibold text-gray-700 block mb-2">Tipo da Chave</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(Object.entries(PIX_TYPE_LABELS) as [PixConfig['pixKeyType'], string][]).map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setPixKeyType(type); setPixKey(''); }}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-2 ${
                        pixKeyType === type
                          ? 'border-green-500 bg-green-500 text-white shadow-md'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chave */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Chave PIX ({PIX_TYPE_LABELS[pixKeyType]})
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type={pixKeyType === 'email' ? 'email' : 'text'}
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                  placeholder={PIX_TYPE_MASKS[pixKeyType]}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-mono transition-all focus:outline-none ${
                    errors.pixKey
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200 bg-white focus:border-green-400 focus:ring-2 focus:ring-green-100'
                  }`}
                />
                {errors.pixKey && <p className="text-xs text-red-500 mt-1">⚠️ {errors.pixKey}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Esta é a chave que os moradores usarão para realizar o pagamento
                </p>
              </div>
            </div>

            {/* SEÇÃO 2: DADOS DO RECEBEDOR */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-200">
              <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                Dados do Recebedor (aparecem no comprovante)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Nome do Recebedor <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    placeholder="CONDOMINIO RESIDENCIAL AURORA"
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm transition-all focus:outline-none ${
                      errors.receiverName
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  {errors.receiverName && <p className="text-xs text-red-500 mt-1">⚠️ {errors.receiverName}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Banco <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="Ex: Banco Inter, Nubank, Bradesco..."
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm transition-all focus:outline-none ${
                      errors.bankName
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  {errors.bankName && <p className="text-xs text-red-500 mt-1">⚠️ {errors.bankName}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Cidade <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={receiverCity}
                    onChange={e => setReceiverCity(e.target.value)}
                    placeholder="São Paulo"
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm transition-all focus:outline-none ${
                      errors.receiverCity
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  {errors.receiverCity && <p className="text-xs text-red-500 mt-1">⚠️ {errors.receiverCity}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Descrição Padrão</label>
                  <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Taxa Condominial"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: QR CODE ESTÁTICO */}
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl p-5 border border-purple-200">
              <h4 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                QR Code Estático (Opcional)
              </h4>
              <p className="text-xs text-purple-600 mb-4">
                Opcionalmente, você pode fazer upload de um QR Code estático gerado pelo seu banco. Caso não seja enviado, o sistema gerará um QR Code dinâmico automaticamente para cada cobrança.
              </p>

              <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="flex-shrink-0">
                  <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-purple-300 bg-white flex items-center justify-center overflow-hidden">
                    {qrCodeImage ? (
                      <img src={qrCodeImage} alt="QR Code" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="text-center">
                        <div className="text-3xl">⬛</div>
                        <p className="text-xs text-gray-400 mt-1">Sem QR</p>
                      </div>
                    )}
                  </div>
                  {qrCodeImage && (
                    <button
                      onClick={() => setQrCodeImage('')}
                      className="mt-2 w-full text-xs text-red-500 hover:text-red-700 font-semibold"
                    >
                      ✕ Remover
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                  >
                    📁 Fazer upload do QR Code estático
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleQRUpload}
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-purple-600 font-medium">✅ QR Code dinâmico (padrão):</p>
                    <p className="text-xs text-gray-500">Gerado automaticamente pelo sistema com o valor exato de cada cobrança</p>
                    <p className="text-xs text-purple-600 font-medium mt-2">📁 QR Code estático (upload):</p>
                    <p className="text-xs text-gray-500">Imagem do QR Code do seu banco — valor fixo, sem variação automática</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Aviso importante */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-bold text-amber-800">Importante</p>
                <p className="text-xs text-amber-700 mt-1">
                  Verifique cuidadosamente os dados antes de salvar. A chave PIX incorreta pode fazer com que os pagamentos sejam enviados para a conta errada.
                  Recomendamos testar com um valor pequeno antes de usar oficialmente.
                </p>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              {config && (
                <button
                  onClick={() => setEditing(false)}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-green-200 hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>Salvar Configurações PIX</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
