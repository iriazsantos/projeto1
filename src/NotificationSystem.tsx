import { useState, useEffect, useCallback } from 'react';
import type { Notification } from './types';

// ─── TIPOS DE NOTIFICAÇÃO PUSH ─────────────────────────────────────────────
export interface PushNotification {
  id: string;
  title: string;
  message: string;
  type: 'delivery' | 'charge' | 'announcement' | 'vote' | 'reservation' | 'complaint' | 'license' | 'market' | 'system';
  read: boolean;
  createdAt: string;
  avatar?: string;
  action?: string;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; label: string }> = {
  delivery:     { icon: '📦', color: 'text-amber-700',   bg: 'from-amber-500 to-orange-500',   border: 'border-amber-200',   label: 'Encomenda' },
  charge:       { icon: '💰', color: 'text-emerald-700', bg: 'from-emerald-500 to-green-500',  border: 'border-emerald-200', label: 'Financeiro' },
  announcement: { icon: '📢', color: 'text-blue-700',    bg: 'from-blue-500 to-indigo-500',    border: 'border-blue-200',    label: 'Comunicado' },
  vote:         { icon: '🗳️', color: 'text-purple-700',  bg: 'from-purple-500 to-violet-500',  border: 'border-purple-200',  label: 'Votação' },
  reservation:  { icon: '📅', color: 'text-teal-700',    bg: 'from-teal-500 to-cyan-500',      border: 'border-teal-200',    label: 'Reserva' },
  complaint:    { icon: '⚠️', color: 'text-red-700',     bg: 'from-red-500 to-rose-500',       border: 'border-red-200',     label: 'Denúncia' },
  license:      { icon: '💳', color: 'text-indigo-700',  bg: 'from-indigo-500 to-purple-500',  border: 'border-indigo-200',  label: 'Licença' },
  market:       { icon: '🛒', color: 'text-pink-700',    bg: 'from-pink-500 to-rose-500',      border: 'border-pink-200',    label: 'Marketplace' },
  system:       { icon: '🔔', color: 'text-gray-700',    bg: 'from-gray-500 to-slate-500',     border: 'border-gray-200',    label: 'Sistema' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

// ─── TOAST DE NOTIFICAÇÃO PUSH ─────────────────────────────────────────────
interface ToastProps {
  notif: Notification;
  onClose: () => void;
}

export function NotificationToast({ notif, onClose }: ToastProps) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;

  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="flex items-start gap-3 p-4 bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm pointer-events-auto hover:shadow-xl transition-all overflow-hidden relative"
      style={{
        animation: 'slideInRight 0.4s cubic-bezier(0.16,1,0.3,1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Linha colorida no topo */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${cfg.bg}`} />

      {/* Ícone com gradiente */}
      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${cfg.bg} flex items-center justify-center text-xl shadow-lg flex-shrink-0 mt-1`}>
        {cfg.icon}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClose}>
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-gray-400">Agora</span>
        </div>
        <p className="text-sm font-bold text-gray-800 leading-tight">{notif.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>

        {/* Botão WhatsApp (sempre disponível para contato) */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`🔔 ${notif.title}\n${notif.message}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg border border-green-200 transition-colors"
        >
          <span>💬</span> Compartilhar no WhatsApp
        </a>
      </div>

      {/* Fechar */}
      <button
        onClick={onClose}
        className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Barra de progresso */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${cfg.bg}`}
          style={{ animation: 'shrink 6s linear forwards' }}
        />
      </div>
    </div>
  );
}

// ─── CONTAINER DE TOASTS ──────────────────────────────────────────────────
interface ToastContainerProps {
  toasts: Notification[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
      style={{ maxWidth: 380 }}
    >
      {toasts.slice(0, 5).map(t => (
        <NotificationToast key={t.id} notif={t} onClose={() => onRemove(t.id)} />
      ))}
    </div>
  );
}

// ─── PAINEL DE NOTIFICAÇÕES (dropdown) ────────────────────────────────────
interface NotificationPanelProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export function NotificationPanel({ notifications, onMarkRead, onMarkAllRead, onClose }: NotificationPanelProps) {
  const unread = notifications.filter(n => !n.read);
  const tabs = ['Todas', 'Não lidas'];
  const [tab, setTab] = useState('Todas');
  const filtered = tab === 'Não lidas' ? unread : notifications;

  return (
    <div
      className="absolute right-0 top-14 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
      style={{ animation: 'slideUp 0.2s ease-out' }}
    >
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-lg">🔔</div>
          <div>
            <p className="text-white font-bold text-sm">Notificações</p>
            {unread.length > 0 && (
              <p className="text-white/60 text-xs">{unread.length} não lida{unread.length > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-white/60 hover:text-white transition-colors"
            >
              Marcar todas
            </button>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center text-sm font-bold">
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-semibold transition-all ${tab === t ? 'text-indigo-600 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
            {t === 'Não lidas' && unread.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unread.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">🔕</div>
            <p className="text-sm font-medium">Nenhuma notificação</p>
          </div>
        ) : (
          filtered.slice().reverse().map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system;
            return (
              <button
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                className={`w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-indigo-50/40' : ''}`}
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cfg.bg} flex items-center justify-center text-base shadow flex-shrink-0 mt-0.5`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className={`text-sm font-semibold leading-tight ${n.read ? 'text-gray-600' : 'text-gray-900'}`}>{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                </div>
                {!n.read && (
                  <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
        <p className="text-xs text-gray-400">
          {notifications.length} notificação{notifications.length !== 1 ? 'ões' : ''} no total
        </p>
      </div>
    </div>
  );
}

// ─── HOOK para gerenciar toasts ────────────────────────────────────────────
export function useToasts() {
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());

  const addToast = useCallback((notif: Notification) => {
    if (shownIds.has(notif.id)) return;
    setShownIds(prev => new Set([...prev, notif.id]));
    setToasts(prev => [...prev, notif]);
  }, [shownIds]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
