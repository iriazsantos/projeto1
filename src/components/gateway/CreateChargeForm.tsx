import React from 'react';
import { CreatePaymentForm, GatewayConfig } from './GatewayTypes';

interface CreateChargeFormProps {
  gateway: GatewayConfig | null;
  paymentForm: CreatePaymentForm;
  setPaymentForm: React.Dispatch<React.SetStateAction<CreatePaymentForm>>;
  paymentError: string;
  creatingPayment: boolean;
  paymentResponse: any;
  createPayment: () => void;
  onConfigureClick: () => void;
}

export function CreateChargeForm({
  gateway, paymentForm, setPaymentForm, paymentError, creatingPayment, paymentResponse, createPayment, onConfigureClick
}: CreateChargeFormProps) {
  if (!gateway) {
    return (
      <div className="p-6 sm:p-8 text-center py-12">
        <p className="text-slate-600 text-lg mb-4">Configure um gateway antes de criar cobranças</p>
        <button
          onClick={onConfigureClick}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
        >
          Ir para Configuração
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-5">
      {/* Payment Response */}
      {paymentResponse && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <h4 className="font-bold text-green-900 mb-4">✓ Cobrança Criada com Sucesso!</h4>
          {paymentResponse.gateway?.pixCode && (
            <div>
              <p className="text-sm text-green-700 mb-3">Código PIX (Copie):</p>
              <textarea
                value={paymentResponse.gateway.pixCode}
                readOnly
                className="w-full px-3 py-2 bg-white border border-green-200 rounded-lg text-xs font-mono mb-3 h-24"
              />
              {paymentResponse.gateway.qrCodeImage && (
                <div className="text-center">
                  <img src={paymentResponse.gateway.qrCodeImage} alt="QR Code" className="w-48 h-48 mx-auto" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Nome do cliente"
          value={paymentForm.customerName}
          onChange={(e) => setPaymentForm({ ...paymentForm, customerName: e.target.value })}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="email"
          placeholder="Email do cliente"
          value={paymentForm.customerEmail}
          onChange={(e) => setPaymentForm({ ...paymentForm, customerEmail: e.target.value })}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="text"
          placeholder="CPF (000.000.000-00)"
          value={paymentForm.customerCpf}
          onChange={(e) => setPaymentForm({ ...paymentForm, customerCpf: e.target.value })}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="number"
          placeholder="Valor (R$)"
          value={paymentForm.amount}
          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Metodo de Pagamento</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(['pix', 'boleto', 'credit_card', 'debit_card'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setPaymentForm({ ...paymentForm, method })}
              className={`p-3 rounded-lg font-semibold text-sm transition-all ${
                paymentForm.method === method
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {method === 'pix' ? 'PIX' : method === 'boleto' ? 'Boleto' : method === 'credit_card' ? 'Cartao credito' : 'Cartao debito'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <textarea
          placeholder="Descrição da cobrança (opcional)"
          value={paymentForm.description}
          onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          rows={3}
        />
      </div>

      {paymentError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{paymentError}</div>
      )}

      <button
        onClick={createPayment}
        disabled={creatingPayment}
        className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors disabled:cursor-not-allowed text-lg"
      >
        {creatingPayment ? '⏳ Criando...' : '➕ Criar Cobrança'}
      </button>
    </div>
  );
}
