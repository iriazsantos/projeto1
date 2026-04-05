import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface PixChargeData {
  chargeId: string;
  amount: number;
  description: string;
  status: 'pending' | 'generated' | 'paid' | 'error';
  qrCode?: string;
  brCode?: string;
  expiration?: string;
  gatewayProvider?: string;
  error?: string;
}

interface PixChargeGeneratorProps {
  chargeId: string;
  amount: number;
  description?: string;
  onGenerated?: (data: PixChargeData) => void;
}

export function PixChargeGenerator({ chargeId, amount, description, onGenerated }: PixChargeGeneratorProps) {
  const [pixData, setPixData] = useState<PixChargeData>({
    chargeId,
    amount,
    description: description || `Cobrança PIX - R$ ${amount.toFixed(2)}`,
    status: 'pending'
  });
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // Gerar QR Code quando os dados PIX estiverem disponíveis
  useEffect(() => {
    if (pixData.qrCode) {
      QRCode.toDataURL(pixData.qrCode, {
        width: 256,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error ao gerar QR Code:', err));
    }
  }, [pixData.qrCode]);

  const generatePixCharge = async () => {
    setLoading(true);
    setPixData(prev => ({ ...prev, status: 'pending', error: undefined }));

    try {
const response = await fetch('/api/gateway/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeId,
          amount,
          description,
          provider: 'asaas',  // Default sandbox
          apiKey: 'acc_asaas_test_key_placeholder',  // Usar config real depois
          method: 'pix',
          condoId: 'c1',  // Default condo seed
          customerEmail: '',
          customerName: '',
          customerCpf: '',
          reference: chargeId
        })
      });

      const data = await response.json();

      if (data.success) {
        const updatedData: PixChargeData = {
          ...pixData,
          status: 'generated',
          qrCode: data.qrCode,
          brCode: data.brCode,
          expiration: data.expiration,
          gatewayProvider: data.pixCharge?.provider || 'unknown'
        };
        
        setPixData(updatedData);
        onGenerated?.(updatedData);
      } else {
        throw new Error(data.message || 'Error ao gerar cobrança PIX');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconhecido';
      setPixData(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));
    } finally {
      setLoading(false);
    }
  };

  const copyBrcode = () => {
    if (pixData.brCode) {
      navigator.clipboard.writeText(pixData.brCode);
      // Poderia adicionar uma notificação aqui
    }
  };

  const formatExpiration = (expiration?: string) => {
    if (!expiration) return '';
    try {
      const date = new Date(expiration);
      return date.toLocaleString('pt-BR');
    } catch {
      return expiration;
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Cobrança PIX</h3>
        <p className="text-slate-400">{pixData.description}</p>
        <p className="text-2xl font-bold text-emerald-400 mt-2">R$ {amount.toFixed(2)}</p>
      </div>

      {pixData.status === 'pending' && !loading && (
        <div className="text-center">
          <button
            onClick={generatePixCharge}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Gerar Cobrança PIX
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Gerando cobrança...</p>
        </div>
      )}

      {pixData.status === 'generated' && (
        <div className="space-y-4">
          {qrCodeUrl && (
            <div className="text-center">
              <img 
                src={qrCodeUrl} 
                alt="QR Code PIX" 
                className="w-64 h-64 mx-auto rounded-xl bg-white p-2"
              />
              <p className="text-sm text-slate-400 mt-2">Escaneie o QR Code acima</p>
            </div>
          )}

          {pixData.brCode && (
            <div className="bg-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-300">Código PIX</span>
                <button
                  onClick={copyBrcode}
                  className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                >
                  Copiar
                </button>
              </div>
              <p className="text-xs text-slate-400 break-all font-mono">
                {pixData.brCode}
              </p>
            </div>
          )}

          {pixData.expiration && (
            <div className="text-center">
              <p className="text-sm text-slate-400">
                Expira em: {formatExpiration(pixData.expiration)}
              </p>
            </div>
          )}

          {pixData.gatewayProvider && (
            <div className="text-center">
              <p className="text-xs text-slate-500">
                Processado via: {pixData.gatewayProvider.toUpperCase()}
              </p>
            </div>
          )}
        </div>
      )}

      {pixData.status === 'error' && (
        <div className="text-center py-4">
          <div className="text-red-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">Error ao gerar cobrança</p>
          </div>
          <p className="text-slate-400 text-sm mb-4">{pixData.error}</p>
          <button
            onClick={generatePixCharge}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      )}
    </div>
  );
}

// Hook para verificar status de pagamentos
export function usePaymentStatus(chargeId: string, checkInterval = 30000) {
  const [status, setStatus] = useState<'pending' | 'paid' | 'cancelled'>('pending');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chargeId || status === 'paid') return;

    const checkStatus = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/license-charges/${chargeId}`);
        if (response.ok) {
          const charge = await response.json();
          setStatus(charge.status);
        }
      } catch (error) {
        console.error('Error ao verificar status:', error);
      } finally {
        setLoading(false);
      }
    };

    // Verificar imediatamente
    checkStatus();

    // Configurar verificação periódica
    const interval = setInterval(checkStatus, checkInterval);

    return () => clearInterval(interval);
  }, [chargeId, status, checkInterval]);

  return { status, loading };
}
