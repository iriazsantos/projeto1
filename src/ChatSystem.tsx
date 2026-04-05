import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from './types';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'audio' | 'image' | 'system';
  audioDuration?: number;
  imageUrl?: string;
  timestamp: string;
  read: boolean;
  readAt?: string;
  reactions?: { emoji: string; userId: string }[];
  replyTo?: { id: string; content: string; senderName: string };
  deleted?: boolean;
}

export interface Chat {
  id: string;
  condoId: string;
  type: 'direct' | 'group';
  name?: string;
  participants: string[];
  lastMessage?: ChatMessage;
  createdAt: string;
  groupAvatar?: string;
  mutedBy?: string[];
  adminIds?: string[];
}

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  unit?: string;
  condoId?: string;
  online: boolean;
  lastSeen: string;
  blockedUsers?: string[];
  dontReceiveMessages?: boolean;
}

// ─── STORE GLOBAL DE CHAT ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

let _chats: Chat[] = [
  {
    id: 'chat1', condoId: 'c1', type: 'direct',
    participants: ['u2', 'u4'],
    createdAt: yesterday,
  },
  {
    id: 'chat2', condoId: 'c1', type: 'direct',
    participants: ['u2', 'u5'],
    createdAt: twoDaysAgo,
  },
  {
    id: 'chat3', condoId: 'c1', type: 'group',
    name: '🏢 Condomínio Residencial Aurora',
    participants: ['u2', 'u3', 'u4', 'u5'],
    adminIds: ['u2'],
    createdAt: twoDaysAgo,
  },
  {
    id: 'chat4', condoId: 'c1', type: 'group',
    name: '👷 Equipe da Portaria',
    participants: ['u2', 'u3'],
    adminIds: ['u2'],
    createdAt: twoDaysAgo,
  },
];

let _messages: ChatMessage[] = [
  { id: 'm1', chatId: 'chat1', senderId: 'u2', senderName: 'Carlos Mendes', content: 'Olá Maria! Como você está?', type: 'text', timestamp: yesterday, read: true, readAt: yesterday },
  { id: 'm2', chatId: 'chat1', senderId: 'u4', senderName: 'Maria Silva', content: 'Oi Carlos! Estou bem, obrigada. Queria perguntar sobre a taxa de novembro.', type: 'text', timestamp: yesterday, read: true },
  { id: 'm3', chatId: 'chat1', senderId: 'u2', senderName: 'Carlos Mendes', content: 'Claro! O boleto foi enviado para o seu email. Vencimento dia 10.', type: 'text', timestamp: now, read: false },
  { id: 'm4', chatId: 'chat3', senderId: 'u2', senderName: 'Carlos Mendes', content: '📢 Assembleia geral no dia 20/11 às 19h. Confirme presença!', type: 'text', timestamp: yesterday, read: true },
  { id: 'm5', chatId: 'chat3', senderId: 'u4', senderName: 'Maria Silva', content: 'Confirmado! Estarei presente 👍', type: 'text', timestamp: yesterday, read: true },
  { id: 'm6', chatId: 'chat3', senderId: 'u5', senderName: 'Pedro Costa', content: 'Eu também confirmo presença!', type: 'text', timestamp: now, read: false },
  { id: 'm7', chatId: 'chat2', senderId: 'u2', senderName: 'Carlos Mendes', content: 'Pedro, vi que sua cobrança de outubro está em aberto.', type: 'text', timestamp: twoDaysAgo, read: true },
  { id: 'm8', chatId: 'chat2', senderId: 'u5', senderName: 'Pedro Costa', content: 'Sim, vou regularizar até sexta!', type: 'text', timestamp: twoDaysAgo, read: true },
];

let _chatUsers: ChatUser[] = [
  { id: 'u1', name: 'Admin Master', role: 'admin', condoId: undefined, online: true, lastSeen: now, dontReceiveMessages: false },
  { id: 'u2', name: 'Carlos Mendes', role: 'sindico', unit: 'AP 01', condoId: 'c1', online: true, lastSeen: now, dontReceiveMessages: false },
  { id: 'u3', name: 'João Porteiro', role: 'porteiro', condoId: 'c1', online: false, lastSeen: new Date(Date.now() - 3600000).toISOString(), dontReceiveMessages: false },
  { id: 'u4', name: 'Maria Silva', role: 'morador', unit: '101-A', condoId: 'c1', online: true, lastSeen: now, dontReceiveMessages: false },
  { id: 'u5', name: 'Pedro Costa', role: 'morador', unit: '202-B', condoId: 'c1', online: false, lastSeen: new Date(Date.now() - 1800000).toISOString(), dontReceiveMessages: false },
];

// ─── FUNÇÕES DO STORE ─────────────────────────────────────────────────────────
export function getChatStore() {
  return {
    getChats: (userId: string, condoId: string) =>
      _chats.filter(c => c.condoId === condoId && c.participants.includes(userId)),

    getMessages: (chatId: string) =>
      _messages.filter(m => m.chatId === chatId),

    getChatUser: (userId: string) =>
      _chatUsers.find(u => u.id === userId),

    getChatUsers: (condoId: string) =>
      _chatUsers.filter(u => u.condoId === condoId || u.role === 'admin'),

    sendMessage: (chatId: string, senderId: string, senderName: string, content: string, type: ChatMessage['type'] = 'text', extra?: Partial<ChatMessage>) => {
      const msg: ChatMessage = {
        id: 'm' + uid(), chatId, senderId, senderName, content, type,
        timestamp: new Date().toISOString(), read: false, ...extra,
      };
      _messages = [..._messages, msg];
      // Atualizar last message no chat
      _chats = _chats.map(c => c.id === chatId ? { ...c, lastMessage: msg } : c);
      return msg;
    },

    markRead: (chatId: string, userId: string) => {
      _messages = _messages.map(m =>
        m.chatId === chatId && m.senderId !== userId && !m.read
          ? { ...m, read: true, readAt: new Date().toISOString() }
          : m
      );
    },

    addReaction: (msgId: string, emoji: string, userId: string) => {
      _messages = _messages.map(m => {
        if (m.id !== msgId) return m;
        const reactions = m.reactions ?? [];
        const existing = reactions.find(r => r.userId === userId && r.emoji === emoji);
        return {
          ...m,
          reactions: existing
            ? reactions.filter(r => !(r.userId === userId && r.emoji === emoji))
            : [...reactions, { emoji, userId }],
        };
      });
    },

    deleteMessage: (msgId: string) => {
      _messages = _messages.map(m => m.id === msgId ? { ...m, deleted: true, content: 'Mensagem apagada' } : m);
    },

    getOrCreateDirectChat: (userId1: string, userId2: string, condoId: string): Chat => {
      const existing = _chats.find(c =>
        c.type === 'direct' &&
        c.participants.includes(userId1) &&
        c.participants.includes(userId2)
      );
      if (existing) return existing;
      const newChat: Chat = {
        id: 'chat' + uid(), condoId, type: 'direct',
        participants: [userId1, userId2],
        createdAt: new Date().toISOString(),
      };
      _chats = [..._chats, newChat];
      return newChat;
    },

    createGroup: (condoId: string, name: string, participants: string[], adminId: string): Chat => {
      const newChat: Chat = {
        id: 'chat' + uid(), condoId, type: 'group', name,
        participants, adminIds: [adminId],
        createdAt: new Date().toISOString(),
      };
      _chats = [..._chats, newChat];
      return newChat;
    },

    toggleDontReceiveMessages: (userId: string) => {
      _chatUsers = _chatUsers.map(u =>
        u.id === userId ? { ...u, dontReceiveMessages: !u.dontReceiveMessages } : u
      );
    },

    setOnline: (userId: string, online: boolean) => {
      _chatUsers = _chatUsers.map(u =>
        u.id === userId
          ? { ...u, online, lastSeen: online ? new Date().toISOString() : u.lastSeen }
          : u
      );
    },

    getUnreadCount: (userId: string, condoId: string): number => {
      const userChats = _chats.filter(c => c.condoId === condoId && c.participants.includes(userId));
      let count = 0;
      userChats.forEach(chat => {
        count += _messages.filter(m => m.chatId === chat.id && m.senderId !== userId && !m.read).length;
      });
      return count;
    },
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Ontem';
  if (days < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: '👨‍💼 Admin', sindico: '🏢 Síndico',
    porteiro: '🚪 Porteiro', morador: '🏠 Morador',
  };
  return map[role] ?? role;
}

function getAvatarColor(name: string): string {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-blue-600',
    'from-amber-500 to-yellow-500',
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md', online }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; online?: boolean }) {
  const sizes = { xs: 'w-7 h-7 text-xs', sm: 'w-9 h-9 text-sm', md: 'w-11 h-11 text-base', lg: 'w-14 h-14 text-lg' };
  const dotSizes = { xs: 'w-2 h-2', sm: 'w-2.5 h-2.5', md: 'w-3 h-3', lg: 'w-3.5 h-3.5' };
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center text-white font-bold`}>
        {name[0].toUpperCase()}
      </div>
      {online !== undefined && (
        <div className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full border-2 border-white ${online ? 'bg-emerald-400' : 'bg-gray-300'}`} />
      )}
    </div>
  );
}

// ─── AUDIO RECORDER ───────────────────────────────────────────────────────────
function AudioRecorder({ onSend, onCancel }: { onSend: (duration: number) => void; onCancel: () => void }) {
  const [recording, setRecording] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRecording(false);
    onSend(seconds);
  };

  return (
    <div className="flex items-center gap-3 flex-1 bg-red-50 rounded-2xl px-4 py-2 border border-red-200">
      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
      <span className="text-red-600 font-bold text-sm flex-1">
        {recording ? 'Gravando...' : 'Gravado'} {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
      </span>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
      <button onClick={stop} className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors">
        ⏹
      </button>
    </div>
  );
}

// ─── EMOJI PICKER ─────────────────────────────────────────────────────────────
const EMOJIS = ['😀', '😂', '😍', '🥰', '😊', '😎', '🤩', '😢', '😭', '😡', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '✅', '⚠️', '🏠', '💰', '📦', '📢', '🗳️'];

function EmojiPicker({ onSelect }: { onSelect: (e: string) => void }) {
  return (
    <div className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 z-50 w-64"
      style={{ animation: 'slideUp 0.2s ease-out' }}>
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map(e => (
          <button key={e} onClick={() => onSelect(e)}
            className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-gray-100 transition-colors">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── REACTION EMOJIS ─────────────────────────────────────────────────────────
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];

// ─── AUDIO MESSAGE BUBBLE ─────────────────────────────────────────────────────
function AudioBubble({ duration, isMine }: { duration?: number; isMine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const dur = duration ?? 5;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = () => {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setProgress(0);
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += 100 / (dur * 10);
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPlaying(false);
        setProgress(0);
      }
    }, 100);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <button onClick={toggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow transition-all ${isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-indigo-100 hover:bg-indigo-200'}`}>
        {playing ? '⏸' : '▶️'}
      </button>
      <div className="flex-1 space-y-1">
        {/* Waveform simulado */}
        <div className="flex items-center gap-0.5 h-8">
          {Array.from({ length: 20 }).map((_, i) => {
            const h = 4 + Math.sin(i * 0.8) * 8 + Math.random() * 4;
            const filled = (i / 20) * 100 <= progress;
            return (
              <div key={i} className={`w-1 rounded-full transition-all ${filled ? (isMine ? 'bg-white' : 'bg-indigo-500') : (isMine ? 'bg-white/40' : 'bg-gray-300')}`}
                style={{ height: `${h}px` }} />
            );
          })}
        </div>
        <p className={`text-xs ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
          {String(Math.floor(dur / 60)).padStart(2, '0')}:{String(dur % 60).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showAvatar, chatUser, onReact, onDelete, onReply }: {
  msg: ChatMessage; isMine: boolean; showAvatar: boolean;
  chatUser?: ChatUser;
  onReact: (msgId: string, emoji: string) => void;
  onDelete: (msgId: string) => void;
  onReply: (msg: ChatMessage) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const groupedReactions = msg.reactions?.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isMine && (
        <div className="mb-1 flex-shrink-0">
          {showAvatar ? (
            <Avatar name={msg.senderName} size="sm" online={chatUser?.online} />
          ) : (
            <div className="w-9 h-9" />
          )}
        </div>
      )}

      <div className={`max-w-[75%] sm:max-w-[65%] space-y-1 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Nome (grupos) */}
        {!isMine && showAvatar && (
          <p className="text-xs font-bold text-indigo-600 px-1">{msg.senderName}</p>
        )}

        {/* Reply */}
        {msg.replyTo && !msg.deleted && (
          <div className={`px-3 py-1.5 rounded-xl border-l-4 text-xs max-w-full ${isMine ? 'bg-indigo-700/30 border-white/50 text-white/80' : 'bg-gray-100 border-indigo-400 text-gray-600'}`}>
            <p className="font-bold">{msg.replyTo.senderName}</p>
            <p className="truncate">{msg.replyTo.content}</p>
          </div>
        )}

        {/* Balão */}
        <div
          className={`relative px-4 py-2.5 rounded-2xl shadow-sm cursor-pointer
            ${isMine
              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-md'
              : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
            }
            ${msg.deleted ? 'opacity-60 italic' : ''}
          `}
          onMouseEnter={() => !msg.deleted && setShowActions(true)}
          onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
        >
          {/* Conteúdo */}
          {msg.deleted ? (
            <p className="text-sm">🚫 Mensagem apagada</p>
          ) : msg.type === 'audio' ? (
            <AudioBubble duration={msg.audioDuration} isMine={isMine} />
          ) : msg.type === 'image' && msg.imageUrl ? (
            <div className="space-y-1">
              <img src={msg.imageUrl} alt="imagem" className="rounded-xl max-w-full max-h-64 object-cover" />
              {msg.content && <p className="text-sm">{msg.content}</p>}
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
          )}

          {/* Tempo + checks */}
          <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-xs ${isMine ? 'text-white/60' : 'text-gray-400'}`}>
              {formatTime(msg.timestamp)}
            </span>
            {isMine && !msg.deleted && (
              <span className={`text-xs ${msg.read ? 'text-blue-300' : 'text-white/60'}`}>
                {msg.read ? '✓✓' : '✓'}
              </span>
            )}
          </div>

          {/* Ações ao hover */}
          {showActions && !msg.deleted && (
            <div className={`absolute top-0 ${isMine ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} flex items-center gap-1 px-2`}>
              <div className="flex items-center gap-1 bg-white rounded-xl shadow-lg border border-gray-100 p-1">
                <button onClick={() => setShowReactions(p => !p)}
                  className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-colors text-sm">
                  😊
                </button>
                <button onClick={() => onReply(msg)}
                  className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors text-sm">
                  ↩️
                </button>
                {isMine && (
                  <button onClick={() => { if (confirm('Apagar mensagem?')) onDelete(msg.id); }}
                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm">
                    🗑️
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reaction picker */}
          {showReactions && (
            <div className={`absolute bottom-full mb-2 ${isMine ? 'right-0' : 'left-0'} bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 flex gap-1 z-50`}>
              {QUICK_REACTIONS.map(e => (
                <button key={e} onClick={() => { onReact(msg.id, e); setShowReactions(false); }}
                  className="w-9 h-9 flex items-center justify-center text-xl hover:bg-gray-100 rounded-xl transition-all hover:scale-125">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reações */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className={`flex items-center gap-1 px-1 flex-wrap ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-xs shadow-sm hover:shadow-md transition-all hover:scale-105">
                <span>{emoji}</span>
                {count > 1 && <span className="font-bold text-gray-600">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CALL MODAL ───────────────────────────────────────────────────────────────
function CallModal({ type, participant, onEnd }: {
  type: 'audio' | 'video';
  participant: string;
  onEnd: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setConnecting(false), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (connecting) return;
    const i = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(i);
  }, [connecting]);

  const dur = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95)' }}>
      {/* Animated rings */}
      {connecting && (
        <>
          <div className="absolute w-48 h-48 rounded-full border-2 border-white/10 animate-ping" />
          <div className="absolute w-64 h-64 rounded-full border border-white/5 animate-ping" style={{ animationDelay: '0.5s' }} />
        </>
      )}

      <div className="text-center space-y-6 relative z-10">
        {/* Avatar */}
        <div className="relative mx-auto w-24 h-24">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getAvatarColor(participant)} flex items-center justify-center text-4xl text-white font-bold shadow-2xl`}>
            {participant[0]}
          </div>
          {connecting && <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />}
        </div>

        <div>
          <h2 className="text-2xl font-black text-white">{participant}</h2>
          <p className="text-white/60 text-sm mt-1">
            {connecting ? (type === 'video' ? '📹 Iniciando vídeo...' : '📞 Chamando...') : dur}
          </p>
        </div>

        {/* Video preview (simulado) */}
        {type === 'video' && !connecting && (
          <div className="w-48 h-32 bg-gray-900/50 rounded-2xl border border-white/10 flex items-center justify-center mx-auto">
            <span className="text-4xl">📹</span>
          </div>
        )}

        {/* Controles */}
        <div className="flex items-center justify-center gap-5">
          {type === 'video' && (
            <>
              <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition-all">
                📷
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition-all">
                🔇
              </button>
            </>
          )}
          {type === 'audio' && (
            <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition-all">
              🔇
            </button>
          )}
          <button
            onClick={onEnd}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-2xl shadow-2xl shadow-red-900 transition-all hover:scale-110 active:scale-95">
            📵
          </button>
          {type === 'audio' && (
            <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition-all">
              🔊
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NEW CHAT MODAL ───────────────────────────────────────────────────────────
function NewChatModal({ currentUser, users, onStartChat, onCreateGroup, onClose }: {
  currentUser: User;
  users: ChatUser[];
  onStartChat: (userId: string) => void;
  onCreateGroup: (name: string, participants: string[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'select' | 'group'>('select');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const others = users.filter(u => u.id !== currentUser.id);

  const handleGroup = () => {
    if (!groupName.trim() || selected.length < 1) return;
    onCreateGroup(groupName.trim(), [currentUser.id, ...selected]);
    onClose();
  };

  const toggleSelect = (id: string) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
        style={{ animation: 'slideUp 0.3s ease-out' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex gap-2">
            <button onClick={() => setMode('select')}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${mode === 'select' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              💬 Nova Conversa
            </button>
            <button onClick={() => setMode('group')}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${mode === 'group' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              👥 Novo Grupo
            </button>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 font-bold">✕</button>
        </div>

        {mode === 'group' && (
          <div className="px-5 pt-4">
            <input value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder="Nome do grupo..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm mb-2" />
            {selected.length > 0 && (
              <p className="text-xs text-indigo-600 font-semibold mb-2">{selected.length} selecionado(s)</p>
            )}
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {others.map(u => (
            <button key={u.id}
              onClick={() => mode === 'select' ? onStartChat(u.id) : toggleSelect(u.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left hover:bg-gray-50 ${mode === 'group' && selected.includes(u.id) ? 'bg-indigo-50 border border-indigo-200' : ''}`}>
              <Avatar name={u.name} size="md" online={u.online} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{u.name}</p>
                <p className="text-xs text-gray-400">{getRoleLabel(u.role)}{u.unit ? ` · Unid. ${u.unit}` : ''}</p>
              </div>
              {mode === 'group' && (
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${selected.includes(u.id) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'}`}>
                  {selected.includes(u.id) && '✓'}
                </div>
              )}
              {u.dontReceiveMessages && mode === 'select' && (
                <span className="text-xs text-red-400 font-semibold flex-shrink-0">🚫</span>
              )}
            </button>
          ))}
        </div>

        {mode === 'group' && (
          <div className="p-4 border-t border-gray-100">
            <button onClick={handleGroup} disabled={!groupName.trim() || selected.length < 1}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:from-indigo-600 hover:to-purple-700 transition-all text-sm shadow-lg">
              ✅ Criar Grupo ({selected.length + 1} pessoas)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CHAT WINDOW ──────────────────────────────────────────────────────────────
function ChatWindow({ chat, currentUser, allUsers, onBack }: {
  chat: Chat;
  currentUser: User;
  allUsers: ChatUser[];
  onBack: () => void;
}) {
  const store = getChatStore();
  const [messages, setMessages] = useState<ChatMessage[]>(() => store.getMessages(chat.id));
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [call, setCall] = useState<'audio' | 'video' | null>(null);
  const [, forceUpdate] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setMessages([...store.getMessages(chat.id)]);
    forceUpdate(n => n + 1);
  }, [chat.id]);

  useEffect(() => {
    store.markRead(chat.id, currentUser.id);
    refresh();
  }, [chat.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simular recebimento de mensagens em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      const newMsgs = store.getMessages(chat.id);
      if (newMsgs.length !== messages.length) {
        setMessages([...newMsgs]);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [chat.id, messages.length]);

  const otherParticipants = chat.participants
    .filter(id => id !== currentUser.id)
    .map(id => allUsers.find(u => u.id === id))
    .filter(Boolean) as ChatUser[];

  const displayName = chat.type === 'group'
    ? (chat.name ?? 'Grupo')
    : (otherParticipants[0]?.name ?? 'Usuário');

  const isOtherOnline = chat.type === 'direct' && otherParticipants[0]?.online;
  const lastSeen = chat.type === 'direct' && otherParticipants[0]?.lastSeen
    ? formatLastSeen(otherParticipants[0].lastSeen)
    : null;

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Verificar se receptor não quer receber mensagens (apenas direto)
    if (chat.type === 'direct' && otherParticipants[0]?.dontReceiveMessages) {
      alert(`${otherParticipants[0].name} optou por não receber mensagens.`);
      return;
    }

    store.sendMessage(chat.id, currentUser.id, currentUser.name, trimmed, 'text',
      replyTo ? { replyTo: { id: replyTo.id, content: replyTo.content, senderName: replyTo.senderName } } : {}
    );
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
    refresh();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendAudio = (duration: number) => {
    store.sendMessage(chat.id, currentUser.id, currentUser.name, '🎤 Mensagem de voz', 'audio', { audioDuration: duration });
    setRecording(false);
    refresh();
  };

  const sendImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      store.sendMessage(chat.id, currentUser.id, currentUser.name, '', 'image', { imageUrl: ev.target?.result as string });
      refresh();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReact = (msgId: string, emoji: string) => {
    store.addReaction(msgId, emoji, currentUser.id);
    refresh();
  };

  const handleDelete = (msgId: string) => {
    store.deleteMessage(msgId);
    refresh();
  };

  // Agrupar mensagens por data
  const grouped: { date: string; msgs: ChatMessage[] }[] = [];
  messages.forEach(m => {
    const d = m.timestamp.split('T')[0];
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== d) {
      grouped.push({ date: d, msgs: [m] });
    } else {
      last.msgs.push(m);
    }
  });

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Call modal */}
      {call && (
        <CallModal
          type={call}
          participant={displayName}
          onEnd={() => setCall(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600 transition-colors md:hidden">
          ←
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {chat.type === 'group' ? (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl text-white font-bold flex-shrink-0">
              👥
            </div>
          ) : (
            <Avatar name={displayName} size="md" online={isOtherOnline} />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 text-sm truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">
              {chat.type === 'group'
                ? `${chat.participants.length} participantes`
                : isOtherOnline
                  ? '🟢 online agora'
                  : lastSeen ? `visto por último ${lastSeen}` : ''
              }
            </p>
          </div>
        </div>
        {/* Ações */}
        <div className="flex items-center gap-1">
          <button onClick={() => setCall('audio')}
            className="w-9 h-9 rounded-xl hover:bg-green-50 flex items-center justify-center text-green-600 hover:text-green-700 transition-all text-lg"
            title="Ligação de voz">
            📞
          </button>
          <button onClick={() => setCall('video')}
            className="w-9 h-9 rounded-xl hover:bg-blue-50 flex items-center justify-center text-blue-600 hover:text-blue-700 transition-all text-lg"
            title="Videochamada">
            📹
          </button>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-1"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}>
        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Separador de data */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm font-medium">
                {formatDateSeparator(date + 'T12:00:00')}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {msgs.map((m, i) => {
              const isMine = m.senderId === currentUser.id;
              const showAvatar = !isMine && (i === 0 || msgs[i - 1]?.senderId !== m.senderId);
              const chatUser = allUsers.find(u => u.id === m.senderId);
              return (
                <div key={m.id} className="mb-1">
                  <MessageBubble
                    msg={m} isMine={isMine} showAvatar={showAvatar}
                    chatUser={chatUser}
                    onReact={handleReact}
                    onDelete={handleDelete}
                    onReply={setReplyTo}
                  />
                </div>
              );
            })}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
            <div className="text-5xl mb-3">💬</div>
            <p className="font-semibold">Nenhuma mensagem ainda</p>
            <p className="text-sm mt-1">Seja o primeiro a dizer olá!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="bg-white border-t border-l-4 border-indigo-400 px-4 py-2 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-indigo-600">{replyTo.senderName}</p>
            <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-3 py-3 relative">
        {showEmoji && <EmojiPicker onSelect={e => { setInput(p => p + e); setShowEmoji(false); inputRef.current?.focus(); }} />}

        {recording ? (
          <AudioRecorder onSend={sendAudio} onCancel={() => setRecording(false)} />
        ) : (
          <div className="flex items-center gap-2">
            {/* Emoji */}
            <button onClick={() => setShowEmoji(p => !p)}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">
              😊
            </button>

            {/* Imagem */}
            <input ref={fileRef} type="file" accept="image/*" onChange={sendImage} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">
              📎
            </button>

            {/* Input de texto */}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Digite uma mensagem..."
              className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm transition-all"
            />

            {/* Enviar / Áudio */}
            {input.trim() ? (
              <button onClick={send}
                className="w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all text-lg">
                ➤
              </button>
            ) : (
              <button onClick={() => setRecording(true)}
                className="w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all text-lg">
                🎤
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CHAT LIST SIDEBAR ────────────────────────────────────────────────────────
function ChatListPanel({ currentUser, allUsers, onSelectChat, selectedChatId, onNewChat }: {
  currentUser: User;
  allUsers: ChatUser[];
  onSelectChat: (chat: Chat) => void;
  selectedChatId?: string;
  onNewChat: () => void;
}) {
  const store = getChatStore();
  const [chats, setChats] = useState<Chat[]>(() => store.getChats(currentUser.id, currentUser.condoId ?? 'c1'));
  const [search, setSearch] = useState('');
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setChats([...store.getChats(currentUser.id, currentUser.condoId ?? 'c1')]);
      forceUpdate(n => n + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [currentUser.id, currentUser.condoId]);

  const getDisplayName = (chat: Chat) => {
    if (chat.type === 'group') return chat.name ?? 'Grupo';
    const otherId = chat.participants.find(id => id !== currentUser.id);
    return allUsers.find(u => u.id === otherId)?.name ?? 'Usuário';
  };

  const getUnread = (chat: Chat) => {
    return store.getMessages(chat.id).filter(m => m.senderId !== currentUser.id && !m.read).length;
  };

  const getLastMsg = (chat: Chat) => {
    const msgs = store.getMessages(chat.id);
    return msgs[msgs.length - 1];
  };

  const filtered = chats.filter(c => getDisplayName(c).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-gray-900">💬 Mensagens</h2>
          <button onClick={onNewChat}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all text-lg">
            ✏️
          </button>
        </div>
        {/* Busca */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
        </div>
      </div>

      {/* Lista de chats */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm">Nenhuma conversa</p>
          </div>
        ) : (
          filtered.map(chat => {
            const name = getDisplayName(chat);
            const lastMsg = getLastMsg(chat);
            const unread = getUnread(chat);
            const isSelected = chat.id === selectedChatId;
            const otherId = chat.type === 'direct' ? chat.participants.find(id => id !== currentUser.id) : undefined;
            const otherUser = otherId ? allUsers.find(u => u.id === otherId) : undefined;

            return (
              <button key={chat.id} onClick={() => onSelectChat(chat)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all text-left border-b border-gray-50 ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}>
                {chat.type === 'group' ? (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl text-white font-bold flex-shrink-0">
                    👥
                  </div>
                ) : (
                  <Avatar name={name} size="md" online={otherUser?.online} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-bold text-sm truncate ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>{name}</p>
                    {lastMsg && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(lastMsg.timestamp)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-gray-500 truncate">
                      {lastMsg
                        ? (lastMsg.deleted ? '🚫 Mensagem apagada'
                          : lastMsg.type === 'audio' ? '🎤 Mensagem de voz'
                          : lastMsg.type === 'image' ? '📷 Foto'
                          : (lastMsg.senderId === currentUser.id ? 'Você: ' : '') + lastMsg.content)
                        : 'Nenhuma mensagem'
                      }
                    </p>
                    {unread > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 bg-indigo-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-bounce">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── MAIN CHAT SECTION ────────────────────────────────────────────────────────
export function ChatSection({ user }: { user: User }) {
  const store = getChatStore();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [dontReceive, setDontReceive] = useState(() => {
    return store.getChatUser(user.id)?.dontReceiveMessages ?? false;
  });
  const [, forceUpdate] = useState(0);

  const allUsers = store.getChatUsers(user.condoId ?? 'c1');

  useEffect(() => {
    store.setOnline(user.id, true);
    return () => { store.setOnline(user.id, false); };
  }, [user.id]);

  const handleStartChat = (userId: string) => {
    const chat = store.getOrCreateDirectChat(user.id, userId, user.condoId ?? 'c1');
    setSelectedChat(chat);
    setShowNewChat(false);
    forceUpdate(n => n + 1);
  };

  const handleCreateGroup = (name: string, participants: string[]) => {
    const chat = store.createGroup(user.condoId ?? 'c1', name, participants, user.id);
    // Mensagem de sistema
    store.sendMessage(chat.id, user.id, user.name, `${user.name} criou o grupo "${name}"`, 'system');
    setSelectedChat(chat);
    setShowNewChat(false);
    forceUpdate(n => n + 1);
  };

  const toggleDontReceive = () => {
    store.toggleDontReceiveMessages(user.id);
    setDontReceive(p => !p);
  };

  return (
    <div className="h-[calc(100vh-80px)] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex">
      {/* Lista de chats (sempre visível no desktop, oculta no mobile quando chat aberto) */}
      <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 flex-shrink-0`}>
        {/* Banner "não quero mensagens" */}
        {user.role === 'morador' && (
          <div className={`mx-3 mt-3 px-4 py-2.5 rounded-xl border flex items-center gap-3 ${dontReceive ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <span className="text-xl">{dontReceive ? '🚫' : '💬'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-700">
                {dontReceive ? 'Não recebendo mensagens' : 'Recebendo mensagens'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {dontReceive ? 'Outros não podem te enviar mensagens' : 'Qualquer morador pode te enviar'}
              </p>
            </div>
            <button onClick={toggleDontReceive}
              className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${dontReceive ? 'bg-red-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${dontReceive ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        )}
        <ChatListPanel
          currentUser={user}
          allUsers={allUsers}
          onSelectChat={setSelectedChat}
          selectedChatId={selectedChat?.id}
          onNewChat={() => setShowNewChat(true)}
        />
      </div>

      {/* Chat window */}
      <div className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            currentUser={user}
            allUsers={allUsers}
            onBack={() => setSelectedChat(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-bold text-gray-600 mb-2">INOVATECH CONNECT</h3>
            <p className="text-sm text-center max-w-xs">Selecione uma conversa para começar ou clique em ✏️ para iniciar uma nova.</p>
          </div>
        )}
      </div>

      {/* Modal novo chat */}
      {showNewChat && (
        <NewChatModal
          currentUser={user}
          users={allUsers}
          onStartChat={handleStartChat}
          onCreateGroup={handleCreateGroup}
          onClose={() => setShowNewChat(false)}
        />
      )}
    </div>
  );
}
