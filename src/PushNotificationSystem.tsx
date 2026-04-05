import { useState, useEffect, useCallback, useRef } from 'react';

// ─── SONS GERADOS VIA WEB AUDIO API (sem arquivos externos) ──────────────────
class SoundEngine {
  private static ctx: AudioContext | null = null;

  static getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.ctx;
  }

  // Som suave tipo "ding"
  static playDing(freq = 880, duration = 0.6) {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  // Som de mensagem (tipo WhatsApp)
  static playMessage() {
    try {
      const ctx = this.getCtx();
      const freqs = [880, 1100, 1320];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.3);
      });
    } catch {}
  }

  // Som de encomenda (alegre)
  static playDelivery() {
    try {
      const ctx = this.getCtx();
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.18);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.2);
      });
    } catch {}
  }

  // Som de alerta/urgente
  static playAlert() {
    try {
      const ctx = this.getCtx();
      [0, 0.15, 0.3].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.14);
      });
    } catch {}
  }

  // Som financeiro (coin)
  static playFinance() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);

      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1500, ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.2);
          gain2.gain.setValueAtTime(0.2, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.3);
        } catch {}
      }, 150);
    } catch {}
  }

  // Som de sucesso
  static playSuccess() {
    try {
      const ctx = this.getCtx();
      const notes = [523, 659, 784];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    } catch {}
  }

  // Seleciona som por tipo de notificação
  static playForType(type: string) {
    switch (type) {
      case 'delivery': this.playDelivery(); break;
      case 'charge': this.playFinance(); break;
      case 'announcement': this.playDing(660, 0.8); break;
      case 'vote': this.playDing(990, 0.5); break;
      case 'reservation': this.playSuccess(); break;
      case 'complaint': this.playAlert(); break;
      case 'license': this.playAlert(); break;
      case 'market': this.playMessage(); break;
      case 'chat': this.playMessage(); break;
      default: this.playDing(); break;
    }
  }
}

// ─── TIPOS ───────────────────────────────────────────────────────────────────
export interface PushToast {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; glow: string; label: string }> = {
  delivery:     { icon: '📦', color: 'text-amber-600',   bg: 'from-amber-400 to-orange-500',   glow: 'shadow-amber-200',   label: 'Encomenda' },
  charge:       { icon: '💰', color: 'text-emerald-600', bg: 'from-emerald-400 to-green-500',  glow: 'shadow-emerald-200', label: 'Financeiro' },
  announcement: { icon: '📢', color: 'text-blue-600',    bg: 'from-blue-400 to-indigo-500',    glow: 'shadow-blue-200',    label: 'Comunicado' },
  vote:         { icon: '🗳️', color: 'text-purple-600',  bg: 'from-purple-400 to-violet-500',  glow: 'shadow-purple-200',  label: 'Votação' },
  reservation:  { icon: '📅', color: 'text-teal-600',    bg: 'from-teal-400 to-cyan-500',      glow: 'shadow-teal-200',    label: 'Reserva' },
  complaint:    { icon: '⚠️', color: 'text-red-600',     bg: 'from-red-400 to-rose-500',       glow: 'shadow-red-200',     label: 'Denúncia' },
  license:      { icon: '💳', color: 'text-indigo-600',  bg: 'from-indigo-400 to-purple-500',  glow: 'shadow-indigo-200',  label: 'Licença' },
  market:       { icon: '🛒', color: 'text-pink-600',    bg: 'from-pink-400 to-rose-500',      glow: 'shadow-pink-200',    label: 'Marketplace' },
  chat:         { icon: '💬', color: 'text-green-600',   bg: 'from-green-400 to-teal-500',     glow: 'shadow-green-200',   label: 'Chat' },
  system:       { icon: '🔔', color: 'text-gray-600',    bg: 'from-gray-400 to-slate-500',     glow: 'shadow-gray-200',    label: 'Sistema' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

// ─── TOAST INDIVIDUAL ────────────────────────────────────────────────────────
interface ToastItemProps {
  toast: PushToast;
  onClose: (id: string) => void;
  index: number;
}

function ToastItem({ toast, onClose, index }: ToastItemProps) {
  const cfg = TYPE_CONFIG[toast.type] ?? TYPE_CONFIG.system;
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
    const t = setTimeout(() => handleClose(), 6000);
    return () => clearTimeout(t);
  }, []);

  const handleClose = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onClose(toast.id), 350);
  }, [toast.id, onClose]);

  return (
    <div
      style={{
        transform: visible && !leaving
          ? 'translateX(0) scale(1)'
          : leaving
          ? 'translateX(120%) scale(0.9)'
          : 'translateX(120%) scale(0.9)',
        opacity: visible && !leaving ? 1 : 0,
        transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
        transitionDelay: leaving ? '0ms' : `${index * 60}ms`,
      }}
      className={`relative bg-white rounded-2xl shadow-2xl ${cfg.glow} border border-gray-100/80 overflow-hidden w-full max-w-[360px] cursor-pointer group`}
      onClick={handleClose}
    >
      {/* Barra colorida topo */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${cfg.bg}`} />

      {/* Barra de progresso */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100">
        <div
          className={`h-full bg-gradient-to-r ${cfg.bg} origin-left`}
          style={{ animation: 'shrinkBar 6s linear forwards' }}
        />
      </div>

      <div className="flex items-start gap-3 p-4 pt-5 pb-5">
        {/* Ícone animado */}
        <div
          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.bg} flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}
          style={{ animation: 'iconBounce 0.5s cubic-bezier(0.36,0.07,0.19,0.97)' }}
        >
          {cfg.icon}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-extrabold uppercase tracking-widest ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-gray-400 ml-auto">Agora</span>
          </div>
          <p className="text-sm font-bold text-gray-900 leading-snug">{toast.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{toast.message}</p>
        </div>

        {/* Botão fechar */}
        <button
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Indicador sonoro */}
      <div className="absolute top-3 right-3">
        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${cfg.bg} animate-ping opacity-75`} />
      </div>
    </div>
  );
}

// ─── CONTAINER DE TOASTS ─────────────────────────────────────────────────────
interface ToastContainerProps {
  toasts: PushToast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      className="fixed z-[99999] flex flex-col-reverse gap-3 pointer-events-none"
      style={{
        bottom: '1rem',
        right: '1rem',
        maxWidth: 380,
        width: 'calc(100vw - 2rem)',
      }}
    >
      {toasts.slice(0, 5).map((t, i) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onClose={onRemove} index={i} />
        </div>
      ))}
    </div>
  );
}

// ─── PAINEL DE NOTIFICAÇÕES ───────────────────────────────────────────────────
interface NotificationPanelProps {
  notifications: PushToast[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export function NotificationPanel({ notifications, onMarkRead, onMarkAllRead, onClose }: NotificationPanelProps) {
  const unread = notifications.filter(n => !n.read);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const filtered = tab === 'unread' ? unread : notifications;

  return (
    <div
      className="absolute right-0 top-14 w-96 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
      style={{ animation: 'slideDown 0.25s cubic-bezier(0.16,1,0.3,1)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-xl">🔔</div>
            {unread.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unread.length > 9 ? '9+' : unread.length}
              </span>
            )}
          </div>
          <div>
            <p className="text-white font-bold text-sm">Notificações</p>
            <p className="text-white/50 text-[11px]">{unread.length} não lida{unread.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button onClick={onMarkAllRead} className="text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10">
              Limpar tudo
            </button>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50/50">
        {(['all', 'unread'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === t ? 'text-indigo-600 border-b-2 border-indigo-500 bg-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'all' ? '📋 Todas' : '🔵 Não lidas'}
            {t === 'unread' && unread.length > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[16px] text-center">{unread.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <div className="text-5xl mb-3">🔕</div>
            <p className="text-sm font-semibold">Nenhuma notificação</p>
            <p className="text-xs mt-1 text-gray-300">Você está em dia!</p>
          </div>
        ) : (
          [...filtered].reverse().map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system;
            return (
              <button
                key={n.id}
                onClick={() => { onMarkRead(n.id); }}
                className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors relative ${!n.read ? 'bg-indigo-50/30' : ''}`}
              >
                {!n.read && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                )}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.bg} flex items-center justify-center text-lg shadow flex-shrink-0 mt-0.5`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className={`text-sm leading-tight ${n.read ? 'text-gray-500 font-medium' : 'text-gray-900 font-bold'}`}>{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <p className="text-[11px] text-gray-400">{notifications.length} notificação{notifications.length !== 1 ? 'ões' : ''}</p>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[11px] text-gray-400">Online</span>
        </div>
      </div>
    </div>
  );
}

// ─── HOOK DE TOASTS COM SOM ──────────────────────────────────────────────────
export function useToasts() {
  const [toasts, setToasts] = useState<PushToast[]>([]);
  const shownIds = useRef<Set<string>>(new Set());

  const addToast = useCallback((notif: PushToast) => {
    if (shownIds.current.has(notif.id)) return;
    shownIds.current.add(notif.id);
    // Toca o som correspondente ao tipo
    SoundEngine.playForType(notif.type);
    // Vibração no celular (se suportado)
    if (navigator.vibrate) {
      const patterns: Record<string, number[]> = {
        delivery: [200, 100, 200],
        charge: [300, 100, 300],
        complaint: [100, 50, 100, 50, 100],
        default: [200],
      };
      navigator.vibrate(patterns[notif.type] || patterns.default);
    }
    setToasts(prev => [...prev.slice(-4), notif]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

// ─── BANNER PWA INSTALAÇÃO PARA CELULAR ──────────────────────────────────────
interface PWABannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

function PWABanner({ onInstall, onDismiss }: PWABannerProps) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[99998] safe-area-bottom"
      style={{ animation: 'slideUpFull 0.5s cubic-bezier(0.16,1,0.3,1)' }}
    >
      {/* Blur backdrop */}
      <div className="relative bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-2xl">
        {/* Barra decorativa */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <div className="px-4 py-4 flex items-center gap-4">
          {/* Logo */}
          <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg flex-shrink-0 border-2 border-gray-100">
            <img
              src="https://i.ibb.co/8gDjLbjg/logotipo2.png"
              alt="INOVATECH"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-2xl">🏢</div>';
              }}
            />
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-gray-900">Instalar INOVATECH CONNECT</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {isIOS
                ? 'Toque em compartilhar e depois "Adicionar à Tela de Início"'
                : 'Instale o app para acesso rápido, notificações e uso offline!'}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <span>⚡</span> Rápido
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <span>📴</span> Offline
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <span>🔔</span> Notificações
              </span>
            </div>
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {!isIOS && (
              <button
                onClick={onInstall}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
              >
                Instalar
              </button>
            )}
            <button
              onClick={onDismiss}
              className="px-4 py-1.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
            >
              {isIOS ? 'Entendi' : 'Agora não'}
            </button>
          </div>
        </div>

        {/* iOS: instrução visual */}
        {isIOS && (
          <div className="px-4 pb-4 flex items-center gap-3 bg-blue-50 mx-4 mb-4 rounded-xl border border-blue-100">
            <span className="text-2xl">📤</span>
            <div>
              <p className="text-xs font-bold text-blue-800">Como instalar no iPhone/iPad:</p>
              <p className="text-xs text-blue-600 mt-0.5">
                1. Toque no ícone de compartilhar <strong>⬆️</strong> no Safari<br/>
                2. Role e toque em <strong>"Adicionar à Tela de Início"</strong><br/>
                3. Toque em <strong>"Adicionar"</strong> no canto superior direito
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INDICADOR DE PERMISSÃO DE NOTIFICAÇÃO ───────────────────────────────────
interface NotifPermissionProps {
  onAllow: () => void;
  onDismiss: () => void;
}

function NotifPermissionBanner({ onAllow, onDismiss }: NotifPermissionProps) {
  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[99997] w-full max-w-sm px-4"
      style={{ animation: 'slideDown 0.4s cubic-bezier(0.16,1,0.3,1)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="text-white font-bold text-sm">Ativar Notificações</p>
            <p className="text-white/70 text-xs">Nunca perca uma atualização importante</p>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 mb-4">
            {['📦 Encomendas', '💰 Cobranças', '📢 Comunicados', '🗳️ Votações'].map(item => (
              <div key={item} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-600">{item}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAllow}
              className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              ✅ Permitir notificações
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2.5 bg-gray-100 text-gray-500 text-sm font-semibold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
            >
              Não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL DO SISTEMA PWA + PUSH ───────────────────────────────
interface PWANotifSystemProps {
  isLoggedIn: boolean;
  toasts: PushToast[];
  onRemoveToast: (id: string) => void;
  notifications: PushToast[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  showPanel: boolean;
  onClosePanel: () => void;
}

export function PWANotifSystem({
  isLoggedIn,
  toasts,
  onRemoveToast,
  notifications,
  onMarkRead,
  onMarkAllRead,
  showPanel,
  onClosePanel,
}: PWANotifSystemProps) {
  const [showPWA, setShowPWA] = useState(false);
  const [showNotifPermission, setShowNotifPermission] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  // Detectar evento de instalação PWA
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) { setInstalled(true); return; }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Mostrar banner após 3 segundos de uso
      setTimeout(() => setShowPWA(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall as any);
    window.addEventListener('appinstalled', () => { setInstalled(true); setShowPWA(false); });

    // iOS: mostrar instruções após 3s
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (isIOS && isSafari && !dismissed) {
      setTimeout(() => setShowPWA(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall as any);
  }, []);

  // Pedir permissão de notificação após login
  useEffect(() => {
    if (!isLoggedIn) return;
    const notifDismissed = localStorage.getItem('notif-permission-dismissed');
    if (notifDismissed) return;
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => setShowNotifPermission(true), 5000);
    }
  }, [isLoggedIn]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
    }
    setShowPWA(false);
  };

  const handleDismissPWA = () => {
    setShowPWA(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  const handleAllowNotif = async () => {
    setShowNotifPermission(false);
    if ('Notification' in window) {
      await Notification.requestPermission();
    }
  };

  const handleDismissNotif = () => {
    setShowNotifPermission(false);
    localStorage.setItem('notif-permission-dismissed', 'true');
  };

  return (
    <>
      {/* Toasts de notificação com som */}
      <ToastContainer toasts={toasts} onRemove={onRemoveToast} />

      {/* Dashboard de notificações */}
      {showPanel && (
        <NotificationPanel
          notifications={notifications}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onClose={onClosePanel}
        />
      )}

      {/* Banner de instalação PWA */}
      {showPWA && !installed && (
        <PWABanner onInstall={handleInstall} onDismiss={handleDismissPWA} />
      )}

      {/* Banner de permissão de notificações */}
      {showNotifPermission && isLoggedIn && (
        <NotifPermissionBanner onAllow={handleAllowNotif} onDismiss={handleDismissNotif} />
      )}
    </>
  );
}

// ─── HOOK PARA NOTIFICAÇÕES NATIVAS DO BROWSER ───────────────────────────────
export function useBrowserNotification() {
  const sendNative = useCallback((title: string, message: string, icon?: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body: message,
        icon: icon || 'https://i.ibb.co/8gDjLbjg/logotipo2.png',
        badge: 'https://i.ibb.co/8gDjLbjg/logotipo2.png',
        vibrate: [200, 100, 200],
        tag: Date.now().toString(),
      } as NotificationOptions);
    } catch {}
  }, []);

  return { sendNative };
}
