import type { GatewayConfig, GatewayStatus, Payment } from './GatewayTypes';
import { Card, Badge, Button, ProgressBar, EmptyState, SectionHeader, StatsRow } from '../ui';

interface GatewayDashboardProps {
  gateway: GatewayConfig | null;
  gatewayStatus: GatewayStatus | null;
  payments: Payment[];
  onConfigureClick: () => void;
  onDeleteClick?: () => void;
}

function formatRecurringMonth(value?: string | null) {
  if (!value) return 'Não processado';
  const [year, month] = String(value).split('-');
  if (!year || !month) return value;
  return `${month}/${year}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ============================================
// GATEWAY STATUS CARD
// ============================================

function GatewayStatusCard({ gateway, gatewayStatus, onConfigureClick }: {
  gateway: GatewayConfig | null;
  gatewayStatus: GatewayStatus | null;
  onConfigureClick: () => void;
}) {
  if (!gateway) {
    return (
      <Card className="p-6 h-full flex flex-col justify-center">
        <EmptyState
          icon="🔌"
          title="Gateway não configurado"
          description="Configure seu gateway de pagamento para começar"
          action={
            <Button onClick={onConfigureClick} icon="⚙️" size="sm">
              Configurar agora
            </Button>
          }
        />
      </Card>
    );
  }

  const automationStatus = gateway?.autoGenerateBillings ? 'Ativa' : 'Desligada';
  const issueStatus = gateway?.autoIssueCharges
    ? `Sim, por ${gateway.autoIssueMethod === 'pix' ? 'PIX' : 'boleto'}`
    : 'Não';

  return (
    <Card variant="gradient" gradient="from-slate-50 to-gray-100" className="p-5 h-full" hover={false}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
            🔌
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{gateway.name || gateway.provider}</h3>
            <p className="text-xs text-slate-500">Gateway de Pagamento</p>
          </div>
        </div>
        <Badge 
          variant={gatewayStatus?.isConnected ? 'success' : 'error'} 
          icon={gatewayStatus?.isConnected ? '✓' : '✕'}
        >
          {gatewayStatus?.isConnected ? 'Conectado' : 'Desconectado'}
        </Badge>
      </div>

      <div className="space-y-3 mt-4">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <StatsRow
            label="Ambiente"
            value={
              <span className={`font-bold ${gateway.environment === 'production' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {gateway.environment.toUpperCase()}
              </span>
            }
            icon="🌐"
          />
        </div>

        <StatsRow 
          label="Recorrência" 
          value={automationStatus} 
          icon="🔄"
          trend={automationStatus === 'Ativa' ? 'up' : 'neutral'}
        />
        
        <StatsRow 
          label="Dia do ciclo" 
          value={`Dia ${gateway.recurrenceDay ?? 25}`} 
          icon="📅"
        />
        
        <StatsRow 
          label="Vencimento" 
          value={`Dia ${gateway.billingDay ?? 5}`} 
          icon="⏰"
        />
        
        <StatsRow 
          label="Emissão automática" 
          value={issueStatus} 
          icon="📄"
        />
        
        <StatsRow 
          label="Último ciclo" 
          value={formatRecurringMonth(gateway.lastRecurringRunMonth)} 
          icon="📊"
        />
      </div>
    </Card>
  );
}

// ============================================
// FINANCIAL SUMMARY CARD
// ============================================

function FinancialSummaryCard({ payments, gatewayStatus }: {
  payments: Payment[];
  gatewayStatus: GatewayStatus | null;
}) {
  const totalPaid = payments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const totalPending = payments
    .filter((payment) => payment.status === 'pending')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const totalAmount = totalPaid + totalPending;
  const paidPercent = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

  return (
    <Card variant="gradient" gradient="from-emerald-50 to-teal-100" className="p-5 h-full" hover={false}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg">
          💰
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Resumo Financeiro</h3>
          <p className="text-xs text-slate-500">Visão geral dos pagamentos</p>
        </div>
      </div>

      <div className="space-y-4 mt-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Total Pago</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalPaid)}</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Pendentes</p>
          <p className="text-2xl font-black text-amber-600">{formatCurrency(totalPending)}</p>
        </div>

        <div className="pt-2">
          <ProgressBar 
            value={paidPercent} 
            color="gradient" 
            size="lg" 
            showLabel 
            label="Progresso de pagamentos"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="text-xs text-slate-500">Cobranças listadas</span>
          <Badge variant="neutral">{payments.length}</Badge>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="text-xs text-slate-500">Monitoramento</span>
          <Badge 
            variant={gatewayStatus?.lastHealthCheck ? 'success' : 'warning'}
            icon={gatewayStatus?.lastHealthCheck ? '✓' : '⏳'}
          >
            {gatewayStatus?.lastHealthCheck ? 'Ativo' : 'Aguardando'}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// PAYMENT LIST
// ============================================

function PaymentList({ payments }: { payments: Payment[] }) {
  const statusConfig: Record<string, { badge: 'success' | 'warning' | 'error' | 'neutral'; label: string; icon: string }> = {
    paid: { badge: 'success', label: 'Pago', icon: '✓' },
    pending: { badge: 'warning', label: 'Pendente', icon: '⏳' },
    failed: { badge: 'error', label: 'Falhou', icon: '✕' },
    refunded: { badge: 'neutral', label: 'Reembolsado', icon: '↩️' },
  };

  return (
    <Card className="p-5">
      <SectionHeader 
        title="💳 Últimos Pagamentos" 
        subtitle={`${payments.length} cobranças`}
      />

      <div className="mt-4 space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {payments.length === 0 ? (
          <EmptyState 
            icon="📭" 
            title="Sem pagamentos" 
            description="Nenhum pagamento registrado ainda"
          />
        ) : (
          payments.slice(0, 10).map((payment) => {
            const config = statusConfig[payment.status] || statusConfig.pending;
            
            return (
              <div
                key={payment.id}
                className="group flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md hover:border-slate-200 border border-transparent transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{payment.customerName}</p>
                    <p className="text-xs text-slate-400 truncate">{payment.customerEmail}</p>
                  </div>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">{formatCurrency(payment.amount)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {payment.createdAt ? fmtDate(payment.createdAt) : ''}
                    </p>
                  </div>
                  <Badge variant={config.badge} size="sm" icon={config.icon}>
                    {config.label}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export function GatewayDashboard({
  gateway,
  gatewayStatus,
  payments,
  onConfigureClick,
  onDeleteClick
}: GatewayDashboardProps) {
  return (
    <div className="p-4 sm:p-5 space-y-4 animate-fade-in">
      {/* Status Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <GatewayStatusCard 
          gateway={gateway} 
          gatewayStatus={gatewayStatus} 
          onConfigureClick={onConfigureClick}
        />
        <FinancialSummaryCard 
          payments={payments} 
          gatewayStatus={gatewayStatus}
        />
      </div>

      {/* Payment List */}
      <PaymentList payments={payments} />

      {/* Delete Button (if provided) */}
      {onDeleteClick && gateway && (
        <div className="flex justify-end pt-2">
          <Button 
            variant="danger" 
            size="sm" 
            onClick={onDeleteClick}
            icon="🗑️"
          >
            Remover gateway
          </Button>
        </div>
      )}
    </div>
  );
}
