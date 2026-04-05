import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from './types';

type SupportStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
type SupportPriority = 'low' | 'medium' | 'high' | 'urgent';
type SupportCategory =
  | 'geral'
  | 'acesso'
  | 'financeiro'
  | 'pagamento'
  | 'cadastro'
  | 'tecnico'
  | 'implantacao'
  | 'integracao'
  | 'faturamento'
  | 'outro';

interface SupportTicket {
  id: string;
  protocol: string;
  condoName: string | null;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  description: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  adminUnreadCount: number;
  requesterUnreadCount: number;
  assignedAdmin: { name: string } | null;
}

interface SupportMessage {
  id: string;
  ticketId: string;
  senderRoleSnapshot: string;
  senderNameSnapshot: string;
  message: string;
  attachmentUrl: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<SupportStatus, { label: string; icon: string; color: string; bg: string }> = {
  open: { label: 'Aberto', icon: '🔵', color: '#3b82f6', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'Em Atendimento', icon: '🟣', color: '#8b5cf6', bg: 'bg-violet-50 text-violet-700 border-violet-200' },
  waiting_user: { label: 'Aguardando', icon: '🟡', color: '#f59e0b', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolvido', icon: '🟢', color: '#10b981', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: 'Encerrado', icon: '⚫', color: '#6b7280', bg: 'bg-slate-50 text-slate-600 border-slate-200' }
};

const PRIORITY_CONFIG: Record<SupportPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Média', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' }
};

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  geral: 'Geral',
  acesso: 'Acesso',
  financeiro: 'Financeiro',
  pagamento: 'Pagamentos',
  cadastro: 'Cadastro',
  tecnico: 'Técnico',
  implantacao: 'Implantação',
  integracao: 'Integração',
  faturamento: 'Faturamento',
  outro: 'Outro'
};

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateFloor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - dateFloor.getTime()) / 86400000);

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getAuthToken() {
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
}

function isAdminMessage(role: string) {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'admin' || normalized === 'admin-master';
}

function avatarColor(seed: string) {
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % 100000;
  }
  return palette[hash % palette.length];
}

function labelInitials(label: string) {
  const cleaned = String(label || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return 'SP';
  return cleaned.slice(0, 2).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export function SupportCenterSection({ user }: { user: User }) {
  const isMaster = user.role === 'admin' || user.role === 'admin-master';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState<SupportCategory>('geral');
  const [newPriority, setNewPriority] = useState<SupportPriority>('medium');
  const [newDescription, setNewDescription] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SupportStatus>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tickets
      .filter((ticket) => {
        if (ticket.status === 'closed') return false;
        if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
        if (!normalizedSearch) return true;
        return (
          ticket.subject.toLowerCase().includes(normalizedSearch) ||
          ticket.protocol.toLowerCase().includes(normalizedSearch) ||
          (ticket.condoName || '').toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [tickets, statusFilter, search]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const canReplySelected = Boolean(selectedTicket && selectedTicket.status !== 'closed');

  const metrics = useMemo(
    () => ({
      total: tickets.filter(t => t.status !== 'closed').length,
      open: tickets.filter((ticket) => ticket.status === 'open').length,
      pending: tickets.filter((ticket) => ticket.status === 'in_progress' || ticket.status === 'waiting_user').length,
      resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
      urgent: tickets.filter((ticket) => ticket.priority === 'urgent').length,
      unread: tickets.reduce((sum, ticket) => sum + (isMaster ? ticket.adminUnreadCount : ticket.requesterUnreadCount), 0)
    }),
    [tickets, isMaster]
  );

  async function loadTickets(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    try {
      const token = getAuthToken();
      if (!token) return;

      const query = new URLSearchParams();
      if (!isMaster) query.set('view', 'mine');

      const endpoint = query.toString() ? `/api/support/tickets?${query.toString()}` : '/api/support/tickets';
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) return;
      const data = await response.json();
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch (error) {
      console.error('Falha ao carregar tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function markTicketRead(ticketId: string) {
    try {
      const token = getAuthToken();
      if (!token) return;
      await fetch(`/api/support/tickets/${ticketId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Falha ao marcar ticket como lido:', error);
    }
  }

  async function loadMessages(ticketId: string) {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) return;
      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      void markTicketRead(ticketId);
      void loadTickets(true);
    } catch (error) {
      console.error('Falha ao carregar mensagens:', error);
    }
  }

  async function handleSendReply() {
    if (!selectedTicketId || !replyText.trim()) return;
    setSending(true);

    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`/api/support/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: replyText.trim(), isInternal: false })
      });

      if (!response.ok) return;
      setReplyText('');
      await loadMessages(selectedTicketId);
      await loadTickets(true);
    } catch (error) {
      console.error('Falha ao enviar resposta:', error);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateTicket() {
    if (!newSubject.trim() || !newDescription.trim()) return;

    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: newSubject.trim(),
          category: newCategory,
          priority: newPriority,
          message: newDescription.trim()
        })
      });

      if (!response.ok) return;
      const data = await response.json();

      setShowNewTicket(false);
      setNewSubject('');
      setNewCategory('geral');
      setNewPriority('medium');
      setNewDescription('');

      await loadTickets(true);
      if (data?.ticket?.id) {
        setSelectedTicketId(data.ticket.id);
      }
    } catch (error) {
      console.error('Falha ao criar ticket:', error);
    }
  }

  async function updateStatus(ticketId: string, status: SupportStatus) {
    if (!isMaster) return;

    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) return;
      await loadTickets(true);
      if (selectedTicketId === ticketId) {
        await loadMessages(ticketId);
      }
    } catch (error) {
      console.error('Falha ao atualizar status:', error);
    }
  }

  useEffect(() => {
    void loadTickets();
    const interval = window.setInterval(() => {
      void loadTickets(true);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [isMaster]);

  useEffect(() => {
    if (!selectedTicketId) return;
    void loadMessages(selectedTicketId);
  }, [selectedTicketId]);

  useEffect(() => {
    if (selectedTicketId && filteredTickets.some((ticket) => ticket.id === selectedTicketId)) return;
    setSelectedTicketId(filteredTickets[0]?.id || null);
  }, [filteredTickets, selectedTicketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Agrupar mensagens por data
  const groupedMessages = useMemo(() => {
    const groups: Array<{ dateKey: string; dateLabel: string; list: SupportMessage[] }> = [];
    messages.forEach((message) => {
      const dateKey = new Date(message.createdAt).toISOString().split('T')[0];
      const existing = groups.find((group) => group.dateKey === dateKey);
      if (existing) {
        existing.list.push(message);
      } else {
        groups.push({
          dateKey,
          dateLabel: formatDateLabel(message.createdAt),
          list: [message]
        });
      }
    });
    return groups;
  }, [messages]);

  return (
    <div className="support-root">
      <div className="support-container">
        {/* ═══ PAINEL ESQUERDO — LISTA DE TICKETS ═══ */}
        <aside className={`support-sidebar ${selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header */}
          <div className="support-sidebar-header">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Suporte</h2>
                <p className="text-xs text-slate-500">Central de atendimento</p>
              </div>
              <button onClick={() => setShowNewTicket(true)}
                className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center text-lg font-bold shadow-md transition-all hover:scale-105"
                title="Novo ticket">
                +
              </button>
            </div>

            {/* Métricas rápidas */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center p-2 rounded-xl bg-blue-50">
                <p className="text-lg font-black text-blue-600">{metrics.open}</p>
                <p className="text-[10px] font-semibold text-blue-500">Abertos</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-violet-50">
                <p className="text-lg font-black text-violet-600">{metrics.pending}</p>
                <p className="text-[10px] font-semibold text-violet-500">Andamento</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-amber-50">
                <p className="text-lg font-black text-amber-600">{metrics.urgent}</p>
                <p className="text-[10px] font-semibold text-amber-500">Urgentes</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-emerald-50">
                <p className="text-lg font-black text-emerald-600">{metrics.resolved}</p>
                <p className="text-[10px] font-semibold text-emerald-500">Resolvidos</p>
              </div>
            </div>

            {/* Busca */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
              <span className="text-slate-400 text-sm">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar ticket..."
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
              {refreshing && <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
            </div>

            {/* Filtros */}
            <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
              {(['all', 'open', 'in_progress', 'waiting_user', 'resolved'] as const).map((status) => (
                <button key={status} onClick={() => setStatusFilter(status)}
                  className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === status
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {status === 'all' ? 'Todos' : STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de tickets */}
          <div className="support-tickets-list">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mr-2" />
                Carregando...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <div className="text-4xl mb-2">📭</div>
                <p className="font-medium">Nenhum ticket</p>
                <p className="text-xs mt-1">Crie um novo chamado</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const active = ticket.id === selectedTicketId;
                const unread = isMaster ? ticket.adminUnreadCount : ticket.requesterUnreadCount;

                return (
                  <button key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`support-ticket-item ${active ? 'active' : ''}`}>
                    <div className="support-ticket-avatar" style={{ background: avatarColor(ticket.subject) }}>
                      {labelInitials(ticket.subject)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`font-semibold text-sm truncate ${active ? 'text-emerald-800' : 'text-slate-800'}`}>
                          {ticket.subject}
                        </p>
                        <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">
                          {formatTimeAgo(ticket.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        #{ticket.protocol} • {ticket.condoName || 'Geral'} • {CATEGORY_LABELS[ticket.category]}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_CONFIG[ticket.status].bg}`}>
                            {STATUS_CONFIG[ticket.status].icon} {STATUS_CONFIG[ticket.status].label}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_CONFIG[ticket.priority].color}`}>
                            {PRIORITY_CONFIG[ticket.priority].label}
                          </span>
                        </div>
                        {unread > 0 && (
                          <span className="support-unread-badge">{unread > 9 ? '9+' : unread}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ═══ PAINEL DIREITO — CONVERSA DO TICKET ═══ */}
        <section className={`support-chat ${selectedTicketId ? 'flex' : 'hidden lg:flex'}`}>
          {!selectedTicket ? (
            <div className="support-empty-state">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-4xl text-white shadow-lg">
                  🎧
                </div>
                <h2 className="text-xl font-bold text-slate-700 mb-2">Central de Suporte</h2>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Selecione um ticket na lista ou crie um novo chamado para iniciar o atendimento.
                </p>
                <button onClick={() => setShowNewTicket(true)}
                  className="mt-4 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm shadow-md transition-all hover:scale-105">
                  + Novo Ticket
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header do chat */}
              <div className="support-chat-header">
                <button onClick={() => setSelectedTicketId(null)}
                  className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 mr-1">
                  ←
                </button>
                <div className="support-ticket-avatar" style={{ background: avatarColor(selectedTicket.subject) }}>
                  {labelInitials(selectedTicket.subject)}
                </div>
                <div className="flex-1 min-w-0 ml-3">
                  <h3 className="font-semibold text-sm text-slate-800 truncate">{selectedTicket.subject}</h3>
                  <p className="text-xs text-slate-500 truncate">
                    #{selectedTicket.protocol} • {selectedTicket.condoName || 'Geral'} • {CATEGORY_LABELS[selectedTicket.category]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isMaster ? (
                    <select value={selectedTicket.status}
                      onChange={(e) => void updateStatus(selectedTicket.id, e.target.value as SupportStatus)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-400">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_CONFIG[selectedTicket.status].bg}`}>
                      {STATUS_CONFIG[selectedTicket.status].icon} {STATUS_CONFIG[selectedTicket.status].label}
                    </span>
                  )}
                  <button onClick={() => void loadTickets(true)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 text-sm">
                    🔄
                  </button>
                </div>
              </div>

              {/* Informações do ticket */}
              <div className="support-ticket-info">
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold ${PRIORITY_CONFIG[selectedTicket.priority].color}`}>
                    Prioridade: {PRIORITY_CONFIG[selectedTicket.priority].label}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600">
                    Criado: {formatDateTime(selectedTicket.createdAt)}
                  </span>
                  {selectedTicket.assignedAdmin?.name && (
                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-600">
                      👤 {selectedTicket.assignedAdmin.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Área de mensagens */}
              <div className="support-messages-area">
                {groupedMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center bg-white/90 backdrop-blur rounded-xl px-6 py-4 shadow-sm border border-slate-100">
                      <div className="text-3xl mb-2">💬</div>
                      <p className="text-sm text-slate-600 font-medium">Sem mensagens ainda</p>
                      <p className="text-xs text-slate-400 mt-1">Envie uma resposta para iniciar</p>
                    </div>
                  </div>
                ) : (
                  <div className="support-messages-list">
                    {groupedMessages.map((group) => (
                      <div key={group.dateKey}>
                        <div className="support-date-divider">
                          <span>{group.dateLabel}</span>
                        </div>

                        {group.list.map((message) => {
                          const fromAdmin = isAdminMessage(message.senderRoleSnapshot);
                          const mine = isMaster ? fromAdmin : !fromAdmin;

                          return (
                            <div key={message.id} className={`support-message-row ${mine ? 'mine' : 'other'}`}>
                              <div className={`support-bubble ${mine ? 'support-bubble-mine' : 'support-bubble-other'}`}>
                                {!mine && (
                                  <p className="support-sender-name">{message.senderNameSnapshot}</p>
                                )}
                                <p className="support-message-text">{message.message}</p>
                                {message.attachmentUrl && (
                                  <a href={message.attachmentUrl} target="_blank" rel="noreferrer"
                                    className={`inline-flex items-center gap-1 mt-1 text-xs font-semibold ${mine ? 'text-white/90 underline' : 'text-indigo-600 underline'}`}>
                                    📎 Anexo
                                  </a>
                                )}
                                <div className="support-message-meta">
                                  <span>{formatTime(message.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="support-composer">
                {!canReplySelected && (
                  <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700">
                    ⚠️ Ticket encerrado. Reabra para continuar a conversa.
                  </div>
                )}
                <div className="support-composer-row">
                  <textarea ref={null} value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendReply();
                      }
                    }}
                    placeholder={canReplySelected ? 'Digite sua resposta...' : 'Ticket fechado'}
                    disabled={!canReplySelected}
                    rows={1}
                    className="support-composer-input"
                    onInput={e => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                    }}
                  />
                  <button onClick={() => void handleSendReply()}
                    disabled={!canReplySelected || sending || !replyText.trim()}
                    className="support-send-btn">
                    {sending ? (
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : '➤'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Modal: Novo Ticket */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ animation: 'slideUp 0.25s ease-out' }}>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Novo Ticket de Suporte</h3>
                  <p className="text-emerald-100 text-xs mt-0.5">Preencha os dados do chamado</p>
                </div>
                <button onClick={() => setShowNewTicket(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white font-bold transition-colors">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Assunto *</label>
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                  placeholder="Descreva brevemente o problema..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Categoria</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value as SupportCategory)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-emerald-400">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Prioridade</label>
                  <select value={newPriority} onChange={e => setNewPriority(e.target.value as SupportPriority)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-emerald-400">
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Descrição *</label>
                <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)}
                  rows={5}
                  placeholder="Descreva seu problema com o máximo de detalhes possível..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setShowNewTicket(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => void handleCreateTicket()}
                disabled={!newSubject.trim() || !newDescription.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Criar Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
