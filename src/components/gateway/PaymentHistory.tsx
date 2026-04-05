import { Payment } from './GatewayTypes';

interface PaymentHistoryProps {
  payments: Payment[];
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  const renderStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '⏳' },
      paid: { bg: 'bg-green-50', text: 'text-green-700', icon: '✓' },
      failed: { bg: 'bg-red-50', text: 'text-red-700', icon: '✕' },
      processing: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '⚙' },
    };
    const c = colors[status] || colors.pending;
    return (
      <span className={`${c.bg} ${c.text} inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold`}>
        {c.icon} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex gap-3 flex-wrap">
        <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors">
          Todos
        </button>
        <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors">
          Pendentes
        </button>
        <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors">
          Pagos
        </button>
        <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors">
          Falhas
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {payments.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Nenhum pagamento encontrado</p>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors cursor-pointer">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{p.customerName}</p>
                  <p className="text-xs text-slate-500">{p.customerEmail}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(p.createdAt).toLocaleDateString('pt-BR')} · {p.gatewayProvider}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-slate-800 text-sm">
                    {p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  {renderStatusBadge(p.status)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
