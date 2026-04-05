import { useMemo } from 'react';
import type { User } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsDashboardProps {
  user: User;
  data: {
    condos: any[];
    users: any[];
    invoices: any[];
    deliveries: any[];
    complaints: any[];
    notifications: any[];
  };
}

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(s: string) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const headerGradients: Record<string, string> = {
  admin: 'from-cyan-600 via-blue-600 to-emerald-500',
  'admin-master': 'from-cyan-600 via-blue-600 to-emerald-500',
  sindico: 'from-blue-600 via-cyan-500 to-teal-500',
  porteiro: 'from-amber-500 via-orange-500 to-rose-500',
  morador: 'from-emerald-500 via-teal-500 to-cyan-500',
};

function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color: string;
}) {
  const colorMap: Record<string, { bg: string; glow: string }> = {
    indigo: { bg: 'from-indigo-500 to-blue-600', glow: 'shadow-indigo-500/30' },
    purple: { bg: 'from-cyan-500 to-blue-500', glow: 'shadow-cyan-500/30' },
    green: { bg: 'from-emerald-500 to-green-600', glow: 'shadow-emerald-500/30' },
    red: { bg: 'from-red-500 to-rose-600', glow: 'shadow-red-500/30' },
    orange: { bg: 'from-orange-500 to-amber-500', glow: 'shadow-orange-500/30' },
    cyan: { bg: 'from-cyan-500 to-teal-500', glow: 'shadow-cyan-500/30' },
  };

  const colors = colorMap[color] || colorMap.indigo;

  return (
    <div className="new-float-card">
      <div className="new-stat-card">
        <div className={`new-stat-icon bg-gradient-to-br ${colors.bg} ${colors.glow}`}>
          {icon}
        </div>
        <div className="new-stat-content">
          <p className="new-stat-label">{label}</p>
          <p className="new-stat-value">{value}</p>
          {sub && <p className="new-stat-sub">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ title, items, icon }: {
  title: string;
  items: { label: string; value: number; total: number; color: string }[];
  icon: string;
}) {
  return (
    <div className="new-float-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => {
          const percent = item.total > 0 ? (item.value / item.total) * 100 : 0;
          const colorMap: Record<string, string> = {
            green: 'from-emerald-500 to-green-500',
            orange: 'from-orange-500 to-amber-500',
            red: 'from-rose-500 to-red-500',
            indigo: 'from-blue-500 to-indigo-500',
            purple: 'from-cyan-500 to-blue-500',
            cyan: 'from-cyan-500 to-teal-500',
          };
          const gradient = colorMap[item.color] || colorMap.indigo;

          return (
            <div key={i}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 sm:text-sm">{item.label}</span>
                <span className="text-xs font-bold text-slate-800 sm:text-sm">
                  {item.value} <span className="font-normal text-slate-400">/ {item.total}</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutCard({
  title,
  icon,
  total,
  segments,
  centerTitle,
}: {
  title: string;
  icon: string;
  total: number;
  segments: DonutSegment[];
  centerTitle: string;
}) {
  const safeTotal = total > 0 ? total : 1;
  const data = segments.filter((s) => s.value > 0);

  return (
    <div className="new-float-card p-4 sm:p-5 flex flex-col">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center flex-1">
        <div className="relative h-44 w-44 shrink-0 sm:-ml-2 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0px 4px 10px ${entry.color}60)` }} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                itemStyle={{ color: '#1e293b' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{centerTitle}</p>
            <p className="text-3xl font-black text-slate-800 tracking-tight leading-none mt-1">{total}</p>
          </div>
        </div>

        <div className="w-full sm:flex-1 space-y-2">
          {segments.map((segment) => {
            const percent = total > 0 ? (segment.value / total) * 100 : 0;
            return (
              <div key={segment.label} className="flex items-center justify-between rounded-[1rem] border border-slate-100 bg-white px-3 py-2.5 shadow-sm transition-all hover:shadow-md hover:scale-[1.02]">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full shadow-[0_0_8px_currentColor] opacity-90" style={{ background: segment.color, color: segment.color }} />
                  <span className="text-sm font-bold text-slate-700">{segment.label}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-800 leading-none">{segment.value}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">{percent.toFixed(0)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TrendChartCard({
  title,
  icon,
  points,
  subtitle,
}: {
  title: string;
  icon: string;
  points: { label: string; value: number }[];
  subtitle: string;
}) {
  const total = points.reduce((sum, point) => sum + point.value, 0);

  return (
    <div className="new-float-card p-4 sm:p-5 flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
        </div>
        <span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-black text-cyan-600 border border-cyan-100 shadow-sm">
          {total} eventos
        </span>
      </div>

      <div className="h-44 w-full -ml-4 mt-2 mb-2 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
            <RechartsTooltip 
              cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px' }}
              labelStyle={{ color: '#64748b', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
              itemStyle={{ color: '#0f172a', fontWeight: '900', fontSize: '16px' }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#0891b2" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              style={{ filter: 'drop-shadow(0px 5px 8px rgba(6, 182, 212, 0.4))' }}
              activeDot={{ r: 6, fill: '#fff', stroke: '#0891b2', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-auto text-xs font-medium text-slate-500 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function ActivityCard({ activities }: { activities: any[] }) {
  const statusColors: Record<string, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div className="new-float-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl">⚡</span>
        <h3 className="text-base font-bold text-slate-800">Atividade Recente</h3>
      </div>
      <div className="space-y-2">
        {activities.length > 0 ? activities.map((activity, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2.5 transition-colors hover:bg-slate-100 sm:gap-3 sm:p-3">
            <span className="text-lg">{activity.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-800 sm:text-sm">{activity.title}</p>
              <p className="text-xs text-slate-500">{activity.description}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {activity.status && <div className={`h-1.5 w-1.5 rounded-full ${statusColors[activity.status] || 'bg-slate-400'}`} />}
              <span className="hidden text-xs text-slate-400 sm:block">{activity.time}</span>
            </div>
          </div>
        )) : (
          <div className="py-6 text-center text-slate-400">
            <span className="mb-1 block text-3xl">📭</span>
            <p className="text-xs sm:text-sm">Sem atividade recente</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CondoListCard({ condos }: { condos: any[] }) {
  return (
    <div className="new-float-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl">🏢</span>
        <h3 className="text-base font-bold text-slate-800">Condomínios</h3>
      </div>
      <div className="space-y-2">
        {condos.slice(0, 5).map((condo) => (
          <div key={condo.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2.5 transition-colors hover:bg-slate-100 sm:gap-3 sm:p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-sm sm:h-10 sm:w-10 sm:text-lg">
              🏢
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">{condo.name}</p>
              <p className="text-xs text-slate-500">{condo.city}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-emerald-600 sm:text-sm">{fmtMoney(condo.monthlyRevenue || 0)}</p>
              <p className="text-xs text-slate-400">{condo.units} unid.</p>
            </div>
          </div>
        ))}
        {condos.length === 0 && (
          <div className="py-6 text-center text-slate-400">
            <span className="mb-1 block text-3xl">🏢</span>
            <p className="text-xs sm:text-sm">Nenhum condomínio</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryListCard({ deliveries }: { deliveries: any[] }) {
  return (
    <div className="new-float-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl">📦</span>
        <h3 className="text-base font-bold text-slate-800">Encomendas</h3>
      </div>
      <div className="space-y-2">
        {deliveries.filter((delivery) => delivery.status === 'waiting').slice(0, 5).map((delivery) => (
          <div key={delivery.id} className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-2.5 sm:gap-3 sm:p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-sm sm:h-10 sm:w-10 sm:text-lg">
              📦
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 sm:text-sm">{delivery.residentName}</p>
              <p className="text-xs text-slate-500">Unid. {delivery.unit}</p>
            </div>
            <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 sm:py-1">Aguardando</span>
          </div>
        ))}
        {deliveries.filter((delivery) => delivery.status === 'waiting').length === 0 && (
          <div className="py-6 text-center text-slate-400">
            <span className="mb-1 block text-3xl">✅</span>
            <p className="text-xs sm:text-sm">Tudo em dia!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationList({ notifications }: { notifications: any[] }) {
  const icons: Record<string, string> = {
    delivery: '📦',
    charge: '💰',
    announcement: '📢',
    maintenance: '🔧',
    reservation: '📅',
  };

  return (
    <div className="new-float-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔔</span>
          <h3 className="text-base font-bold text-slate-800">Notificações</h3>
        </div>
        {notifications.filter((notification) => !notification.read).length > 0 && (
          <span className="rounded-lg bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 sm:py-1">
            {notifications.filter((notification) => !notification.read).length} novas
          </span>
        )}
      </div>
      <div className="space-y-2">
        {notifications.slice(0, 5).map((notification) => (
          <div key={notification.id} className="flex items-start gap-2 rounded-2xl bg-slate-50 p-2.5 transition-colors hover:bg-slate-100 sm:gap-3 sm:p-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-sm sm:h-10 sm:w-10 sm:text-xl">
              {icons[notification.type] || '🔔'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-800 sm:text-sm">{notification.title}</p>
                {!notification.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
              </div>
              <p className="line-clamp-2 text-xs text-slate-500">{notification.message}</p>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="py-6 text-center text-slate-400">
            <span className="mb-1 block text-3xl">🔕</span>
            <p className="text-xs sm:text-sm">Sem notificações</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardHeader({ user, subtitle }: { user: User; subtitle: string }) {
  const gradient = headerGradients[user.role] || headerGradients.morador;

  return (
    <div className="new-float-card mb-4 overflow-hidden p-0">
      <div className={`relative overflow-hidden rounded-[20px] bg-gradient-to-r ${gradient} p-5 text-white sm:p-7`}>
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-white/30 bg-white/20 text-xl font-bold shadow-lg backdrop-blur-sm sm:h-16 sm:w-16 sm:text-2xl">
              {user.photo ? (
                <img src={user.photo} alt={user.name} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                user.name[0].toUpperCase()
              )}
            </div>
            <div>
              <h2 className="mb-0.5 text-xl font-black text-white drop-shadow-sm sm:text-2xl">
                👋 Olá, {user.name.split(' ')[0]}!
              </h2>
              <p className="text-sm font-medium text-white/80">{subtitle}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {user.role === 'morador' && (
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                <span>📦</span>
                <span>Unid. {user.unit}</span>
              </div>
            )}
            {(user.role === 'admin' || user.role === 'admin-master') && (
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                <span>👑</span>
                <span>Admin Master</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildWeekPoints(collections: any[][], fields: string[]): { label: string; value: number }[] {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });

  const key = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const counts = new Map(days.map((date) => [key(date), 0]));

  const bump = (dateRaw: string | undefined) => {
    if (!dateRaw) return;
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) return;
    date.setHours(0, 0, 0, 0);
    const dateKey = key(date);
    if (!counts.has(dateKey)) return;
    counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
  };

  collections.forEach((list) => {
    list.forEach((item) => {
      fields.forEach((field) => bump(item[field]));
    });
  });

  return days.map((date) => ({
    label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    value: counts.get(key(date)) || 0,
  }));
}

export function AnalyticsDashboard({ user, data }: AnalyticsDashboardProps) {
  const { condos, users, invoices, deliveries, complaints, notifications } = data;

  const stats = useMemo(() => {
    const myUsers = user.condoId ? users.filter((entry) => entry.condoId === user.condoId) : users;
    const myInvoices = user.condoId ? invoices.filter((entry) => entry.condoId === user.condoId) : invoices;
    const myDeliveries = user.condoId ? deliveries.filter((entry) => entry.condoId === user.condoId) : deliveries;
    const myComplaints = user.condoId ? complaints.filter((entry) => entry.condoId === user.condoId) : complaints;

    const paid = myInvoices.filter((entry) => entry.status === 'paid').length;
    const pending = myInvoices.filter((entry) => entry.status === 'pending').length;
    const overdue = myInvoices.filter((entry) => entry.status === 'overdue').length;
    const delivered = myDeliveries.filter((entry) => entry.status === 'delivered').length;
    const waiting = myDeliveries.filter((entry) => entry.status === 'waiting').length;
    const totalRevenue = condos.reduce((sum, condo) => sum + (condo.monthlyRevenue || 0), 0);
    const totalPending = condos.reduce((sum, condo) => sum + (condo.pendingCharges || 0), 0);

    const recentActivity = [
      ...myDeliveries.slice(0, 3).map((delivery) => ({
        icon: '📦',
        title: `Encomenda para ${delivery.residentName}`,
        time: delivery.arrivedAt ? fmtDate(delivery.arrivedAt) : 'Recente',
        description: `Unid. ${delivery.unit}`,
        status: delivery.status === 'delivered' ? 'success' as const : 'warning' as const,
      })),
      ...myInvoices.slice(0, 3).map((invoice) => ({
        icon: '💰',
        title: `Cobrança ${invoice.status === 'paid' ? 'paga' : invoice.status === 'overdue' ? 'vencida' : 'pendente'}`,
        time: invoice.dueDate ? fmtDate(invoice.dueDate) : 'Recente',
        description: fmtMoney(invoice.amount),
        status: invoice.status === 'paid' ? 'success' as const : invoice.status === 'overdue' ? 'error' as const : 'warning' as const,
      })),
    ].slice(0, 5);

    const weekPoints = buildWeekPoints(
      [myInvoices, myDeliveries, myComplaints],
      ['createdAt', 'arrivedAt', 'dueDate']
    );

    return {
      totalUsers: myUsers.length,
      residents: myUsers.filter((entry) => entry.role === 'morador').length,
      totalInvoices: myInvoices.length,
      paid,
      pending,
      overdue,
      totalDeliveries: myDeliveries.length,
      delivered,
      waiting,
      totalComplaints: myComplaints.length,
      pendingComplaints: myComplaints.filter((entry) => entry.status === 'pending').length,
      totalRevenue,
      totalPending,
      recentActivity,
      weekPoints,
      myInvoices,
      myDeliveries,
    };
  }, [user, condos, users, invoices, deliveries, complaints]);

  const financeSegments: DonutSegment[] = [
    { label: 'Pagas', value: stats.paid, color: '#10b981' },
    { label: 'Pendentes', value: stats.pending, color: '#f59e0b' },
    { label: 'Vencidas', value: stats.overdue, color: '#f43f5e' },
  ];

  const deliverySegments: DonutSegment[] = [
    { label: 'Entregues', value: stats.delivered, color: '#06b6d4' },
    { label: 'Aguardando', value: stats.waiting, color: '#f97316' },
  ];

  if (user.role === 'admin' || user.role === 'admin-master') {
    return (
      <div className="analytics-dashboard-shell space-y-6">
        <DashboardHeader user={user} subtitle="Visão consolidada de operação e receita" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="🏢" label="Condomínios" value={condos.length} sub={`${condos.filter((condo) => condo.active).length} ativos`} color="indigo" />
          <StatCard icon="👥" label="Usuários" value={users.length} sub="base total cadastrada" color="purple" />
          <StatCard icon="💰" label="Receita Mensal" value={fmtMoney(stats.totalRevenue)} sub="todos os condomínios" color="green" />
          <StatCard icon="⚠️" label="Inadimplência" value={fmtMoney(stats.totalPending)} sub="cobranças pendentes" color="red" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ProgressCard title="Financeiro" icon="💰" items={[
            { label: 'Pagas', value: stats.paid, total: stats.totalInvoices, color: 'green' },
            { label: 'Pendentes', value: stats.pending, total: stats.totalInvoices, color: 'orange' },
            { label: 'Vencidas', value: stats.overdue, total: stats.totalInvoices, color: 'red' },
          ]} />
          <ProgressCard title="Encomendas" icon="📦" items={[
            { label: 'Entregues', value: stats.delivered, total: stats.totalDeliveries, color: 'green' },
            { label: 'Aguardando', value: stats.waiting, total: stats.totalDeliveries, color: 'orange' },
          ]} />
          <ProgressCard title="Denúncias" icon="⚠️" items={[
            { label: 'Total', value: stats.totalComplaints, total: Math.max(stats.totalComplaints, 1), color: 'indigo' },
            { label: 'Pendentes', value: stats.pendingComplaints, total: Math.max(stats.totalComplaints, 1), color: 'red' },
          ]} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DonutCard
            title="Mapa de Cobranças"
            icon="🎯"
            total={stats.totalInvoices}
            segments={financeSegments}
            centerTitle="faturas"
          />
          <TrendChartCard
            title="Tendência Semanal"
            icon="📈"
            points={stats.weekPoints}
            subtitle="Volume diário combinado (financeiro, encomendas e tickets) dos últimos 7 dias."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ActivityCard activities={stats.recentActivity} />
          <CondoListCard condos={condos} />
        </div>
      </div>
    );
  }

  if (user.role === 'sindico') {
    const condo = condos.find((entry) => entry.id === user.condoId);
    const pendingAmount = invoices
      .filter((entry: any) => entry.status === 'pending' && entry.condoId === user.condoId)
      .reduce((sum: number, entry: any) => sum + entry.amount, 0);

    return (
      <div className="analytics-dashboard-shell space-y-6">
        <DashboardHeader user={user} subtitle={condo?.name || 'Gestão do condomínio'} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="👥" label="Moradores" value={stats.residents} color="cyan" />
          <StatCard icon="💰" label="A Receber" value={fmtMoney(pendingAmount)} sub="pendente" color="orange" />
          <StatCard icon="📦" label="Encomendas" value={stats.waiting} sub="aguardando" color="purple" />
          <StatCard icon="⚠️" label="Denúncias" value={stats.pendingComplaints} sub="não lidas" color="red" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ProgressCard title="Financeiro" icon="💰" items={[
            { label: 'Pagas', value: stats.paid, total: stats.totalInvoices, color: 'green' },
            { label: 'Pendentes', value: stats.pending, total: stats.totalInvoices, color: 'orange' },
            { label: 'Vencidas', value: stats.overdue, total: stats.totalInvoices, color: 'red' },
          ]} />
          <DeliveryListCard deliveries={deliveries} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DonutCard
            title="Composição Financeira"
            icon="🧾"
            total={stats.totalInvoices}
            segments={financeSegments}
            centerTitle="faturas"
          />
          <TrendChartCard
            title="Movimento da Semana"
            icon="📊"
            points={stats.weekPoints}
            subtitle="Acompanhamento diário das movimentações do condomínio."
          />
        </div>
      </div>
    );
  }

  if (user.role === 'porteiro') {
    const today = deliveries.filter((delivery) => {
      const todayStr = new Date().toISOString().split('T')[0];
      return delivery.arrivedAt?.startsWith(todayStr);
    });

    return (
      <div className="analytics-dashboard-shell space-y-6">
        <DashboardHeader user={user} subtitle="Controle de encomendas e acessos" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="📦" label="Aguardando" value={stats.waiting} sub="para retirar" color="orange" />
          <StatCard icon="✅" label="Entregues Hoje" value={today.filter((delivery) => delivery.status === 'delivered').length} color="green" />
          <StatCard icon="📬" label="Chegaram Hoje" value={today.length} color="cyan" />
          <StatCard icon="🚪" label="Total Mês" value={stats.totalDeliveries} color="indigo" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DonutCard
            title="Status de Entregas"
            icon="📦"
            total={stats.totalDeliveries}
            segments={deliverySegments}
            centerTitle="entregas"
          />
          <TrendChartCard
            title="Fluxo Semanal"
            icon="📈"
            points={stats.weekPoints}
            subtitle="Pico de movimentação para ajuste de escala da portaria."
          />
        </div>

        <DeliveryListCard deliveries={deliveries} />
      </div>
    );
  }

  const myDeliveries = deliveries.filter((delivery) => delivery.unit === user.unit);
  const myInvoices = invoices.filter((invoice) => invoice.userId === user.id);
  const paidInvoices = myInvoices.filter((invoice) => invoice.status === 'paid');
  const pendingInvoices = myInvoices.filter((invoice) => invoice.status === 'pending');
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  const residentWeekPoints = buildWeekPoints([myInvoices, myDeliveries], ['createdAt', 'arrivedAt', 'dueDate']);
  const residentSegments: DonutSegment[] = [
    { label: 'Pagas', value: paidInvoices.length, color: '#10b981' },
    { label: 'Pendentes', value: pendingInvoices.length, color: '#f59e0b' },
  ];

  return (
    <div className="analytics-dashboard-shell space-y-6">
      <DashboardHeader user={user} subtitle={`Unidade ${user.unit}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon="💰" label="Pendentes" value={pendingInvoices.length} sub={`${paidInvoices.length} pagas`} color="orange" />
        <StatCard icon="📦" label="Encomendas" value={myDeliveries.filter((delivery) => delivery.status === 'waiting').length} sub="aguardando" color="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutCard
          title="Seu Financeiro"
          icon="💳"
          total={myInvoices.length}
          segments={residentSegments}
          centerTitle="faturas"
        />
        <TrendChartCard
          title="Sua Semana"
          icon="📅"
          points={residentWeekPoints}
          subtitle="Movimentações pessoais entre cobranças e entregas."
        />
      </div>

      {unreadNotifications.length > 0 && <NotificationList notifications={unreadNotifications} />}
      {myDeliveries.filter((delivery) => delivery.status === 'waiting').length > 0 && <DeliveryListCard deliveries={myDeliveries} />}
    </div>
  );
}

