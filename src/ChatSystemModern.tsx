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
        c.type === 'direct' && c.participants.includes(userId1) && c.participants.includes(userId2)
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

    updatePresence: (userId: string, online: boolean) => {
      _chatUsers = _chatUsers.map(u =>
        u.id === userId ? { ...u, online, lastSeen: online ? new Date().toISOString() : u.lastSeen } : u
      );
    },

    getUnreadCount: (userId: string, condoId: string) => {
      const userChats = _chats.filter(c => c.condoId === condoId && c.participants.includes(userId));
      let count = 0;
      userChats.forEach(chat => {
        count += _messages.filter(m => m.chatId === chat.id && m.senderId !== userId && !m.read).length;
      });
      return count;
    },
  };
}

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return d.toLocaleDateString('pt-BR', { weekday: 'long' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatLastSeen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'agora mesmo';
  if (diff < 60) return `há ${diff} min`;
  if (diff < 1440) return `há ${Math.floor(diff / 60)} horas`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅'];

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md', online }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; online?: boolean }) {
  const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-base', lg: 'w-14 h-14 text-lg', xl: 'w-16 h-16 text-xl' };
  const colors = ['from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600', 'from-purple-400 to-purple-600', 'from-orange-400 to-orange-600', 'from-pink-400 to-pink-600'];
  const colorIndex = name.length % colors.length;

  return (
    <div className="relative">
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md`}>
        {name.charAt(0).toUpperCase()}
      </div>
      {online && (
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
      )}
    </div>
  );
}

// ─── CHAT LIST ITEM ───────────────────────────────────────────────────────────
function ChatListItem({ chat, currentUser, allUsers, isSelected, onClick }: {
  chat: Chat;
  currentUser: User;
  allUsers: ChatUser[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const store = getChatStore();
  const otherParticipants = chat.participants.filter(id => id !== currentUser.id);
  const otherUser = otherParticipants[0] ? allUsers.find(u => u.id === otherParticipants[0]) : null;

  const displayName = chat.type === 'group'
    ? (chat.name ?? 'Grupo do Condomínio')
    : (otherUser?.name ?? 'Usuário');

  const lastMsg = chat.lastMessage;
  const unreadCount = store
    .getMessages(chat.id)
    .filter(m => m.senderId !== currentUser.id && !m.read).length;

  const isOtherOnline = chat.type === 'direct' && otherUser?.online;
  const lastMessageText = lastMsg?.deleted
    ? 'Mensagem apagada'
    : lastMsg?.type === 'image'
      ? '📷 Imagem'
      : lastMsg?.content ?? 'Sem mensagens';

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition-all duration-200 ${
        isSelected
          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-l-indigo-500'
          : 'bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100'
      }`}
    >
      {/* Avatar */}
      {chat.type === 'group' ? (
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white shadow-md">
          🏢
        </div>
      ) : (
        <div className="relative">
          <Avatar name={displayName} size="md" />
          {isOtherOnline && (
            <span className="absolute -right-0.5 bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500 animate-pulse" />
          )}
        </div>
      )}

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-semibold text-gray-800">
            {displayName}
          </p>
          {lastMsg && (
            <span className={`text-xs ${unreadCount > 0 ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
              {formatTime(lastMsg.timestamp)}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-gray-500">
            {lastMessageText}
          </p>
          {unreadCount > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-2 py-0.5 text-xs font-bold text-white shadow-md">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── MESSAGE BUBBLE (MODERN DESIGN) ──────────────────────────────────────────
function MessageBubble({ msg, isMine, showAvatar, chatUser, onReact, onDelete, onReply }: {
  msg: ChatMessage;
  isMine: boolean;
  showAvatar: boolean;
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
      <div className="my-4 flex justify-center">
        <span className="rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200/50 shadow-sm">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`group mb-3 flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine && (
        <div className="mb-0.5 w-9 shrink-0">
          {showAvatar ? (
            <Avatar name={msg.senderName} size="sm" online={chatUser?.online} />
          ) : (
            <div className="h-9 w-9" />
          )}
        </div>
      )}

      <div className={`flex max-w-[85%] flex-col ${isMine ? 'items-end' : 'items-start'} sm:max-w-[70%]`}>
        {!isMine && showAvatar && (
          <p className="mb-1 px-1 text-xs font-semibold text-indigo-600">{msg.senderName}</p>
        )}

        {msg.replyTo && !msg.deleted && (
          <div className={`mb-2 w-full rounded-xl border-l-4 px-3 py-2 text-xs shadow-sm ${
            isMine
              ? 'border-indigo-400 bg-indigo-50 text-gray-700'
              : 'border-purple-400 bg-purple-50 text-gray-700'
          }`}>
            <p className="font-semibold text-indigo-700">{msg.replyTo.senderName}</p>
            <p className="truncate text-gray-600">{msg.replyTo.content}</p>
          </div>
        )}

        <div
          className={`relative rounded-2xl px-4 py-2.5 text-sm shadow-md transition-all duration-200 ${
            isMine
              ? 'rounded-tr-md bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-white shadow-indigo-200'
              : 'rounded-tl-md bg-white text-gray-800 border border-gray-100 shadow-gray-100/50'
          } ${msg.deleted ? 'italic opacity-70' : ''}
             hover:shadow-lg`}
          onMouseEnter={() => !msg.deleted && setShowActions(true)}
          onMouseLeave={() => {
            setShowActions(false);
            setShowReactions(false);
          }}
        >
          {msg.deleted ? (
            <p className="flex items-center gap-2 text-sm">
              <span>🚫</span> Mensagem apagada
            </p>
          ) : msg.type === 'image' && msg.imageUrl ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-xl">
                <img 
                  src={msg.imageUrl} 
                  alt="imagem" 
                  className="max-h-80 w-full object-cover transition-transform duration-300 hover:scale-105" 
                />
              </div>
              {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          )}

          <div className={`mt-1.5 flex items-center gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-[10px] font-medium ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
              {formatTime(msg.timestamp)}
            </span>
            {isMine && !msg.deleted && (
              <span className={`text-[10px] ${msg.read ? 'text-blue-300' : 'text-white/50'}`}>
                {msg.read ? '✓✓' : '✓'}
              </span>
            )}
          </div>

          {showActions && !msg.deleted && (
            <div className={`absolute top-1 z-30 ${isMine ? '-left-24' : '-right-24'}`}>
              <div className="flex items-center gap-1.5 rounded-xl bg-white/95 backdrop-blur-sm p-1.5 shadow-xl border border-gray-200/50">
                <button
                  onClick={() => setShowReactions(p => !p)}
                  className="h-8 w-8 rounded-lg text-base text-gray-600 transition-all hover:bg-gradient-to-br hover:from-yellow-50 hover:to-amber-50 hover:scale-110"
                  title="Reagir"
                >
                  😊
                </button>
                <button
                  onClick={() => onReply(msg)}
                  className="h-8 w-8 rounded-lg text-base text-gray-600 transition-all hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:scale-110"
                  title="Responder"
                >
                  ↩️
                </button>
                {isMine && (
                  <button
                    onClick={() => { if (confirm('Apagar mensagem?')) onDelete(msg.id); }}
                    className="h-8 w-8 rounded-lg text-base text-gray-600 transition-all hover:bg-gradient-to-br hover:from-red-50 hover:to-rose-50 hover:scale-110"
                    title="Apagar"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          )}

          {showReactions && (
            <div className={`absolute bottom-full z-40 mb-2 flex gap-1.5 rounded-2xl bg-white/95 backdrop-blur-sm p-2 shadow-2xl border border-gray-200/50 ${isMine ? 'right-0' : 'left-0'}`}>
              {QUICK_REACTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => {
                    onReact(msg.id, e);
                    setShowReactions(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-all hover:scale-125 hover:bg-gray-100"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {Object.keys(groupedReactions).length > 0 && (
          <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/50 px-2.5 py-1 text-xs font-medium text-gray-700 transition-all hover:shadow-md hover:scale-105 hover:from-indigo-100 hover:to-purple-100"
              >
                <span className="text-sm">{emoji}</span>
                {count > 1 && <span className="font-semibold text-indigo-600">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMOJI PICKER ─────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👏', '🙏', '🎉'];
  return (
    <div className="absolute bottom-full left-2 z-40 mb-2 grid grid-cols-6 gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
      {emojis.map(e => (
        <button key={e} onClick={() => onSelect(e)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-indigo-50">
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── CHAT WINDOW (MODERN DESIGN) ─────────────────────────────────────────────
function ChatWindow({ chat, currentUser, allUsers, onBack }: {
  chat: Chat;
  currentUser: User;
  allUsers: ChatUser[];
  onBack: () => void;
}) {
  const store = getChatStore();
  const [messages, setMessages] = useState<ChatMessage[]>(() => store.getMessages(chat.id));
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setMessages([...store.getMessages(chat.id)]);
  }, [chat.id]);

  useEffect(() => {
    store.markRead(chat.id, currentUser.id);
    refresh();
  }, [chat.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const otherParticipants = chat.participants
    .filter(id => id !== currentUser.id)
    .map(id => allUsers.find(u => u.id === id))
    .filter(Boolean) as ChatUser[];

  const displayName = chat.type === 'group' ? (chat.name ?? 'Grupo do Condomínio') : (otherParticipants[0]?.name ?? 'Usuário');
  const isOtherOnline = chat.type === 'direct' && otherParticipants[0]?.online;

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    store.sendMessage(
      chat.id,
      currentUser.id,
      currentUser.name,
      trimmed,
      'text',
      replyTo ? { replyTo: { id: replyTo.id, content: replyTo.content, senderName: replyTo.senderName } } : {}
    );
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
    refresh();
    setTimeout(() => inputRef.current?.focus(), 100);
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
    <div className="flex h-full flex-1 flex-col bg-gradient-to-b from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200/50 bg-white/80 backdrop-blur-lg px-4 py-3 shadow-sm">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-indigo-50 md:hidden"
        >
          ←
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {chat.type === 'group' ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-lg font-bold text-white shadow-md">
              🏢
            </div>
          ) : (
            <Avatar name={displayName} size="md" online={isOtherOnline} />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-800">{displayName}</p>
            <p className="truncate text-xs text-gray-500">
              {chat.type === 'group'
                ? `${chat.participants.length} participantes`
                : isOtherOnline
                  ? '🟢 Online agora'
                  : `Visto ${formatLastSeen(otherParticipants[0]?.lastSeen || '')}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-indigo-50" title="Pesquisar">
            🔍
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-indigo-50" title="Mais opções">
            ⋮
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.08) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      >
        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <div className="my-4 flex justify-center">
              <span className="rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 px-4 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm border border-indigo-200/50">
                {formatDateSeparator(date + 'T12:00:00')}
              </span>
            </div>

            {msgs.map((m, i) => {
              const isMine = m.senderId === currentUser.id;
              const showAvatar = !isMine && (i === 0 || msgs[i - 1]?.senderId !== m.senderId);
              const chatUser = allUsers.find(u => u.id === m.senderId);
              return (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  isMine={isMine}
                  showAvatar={showAvatar}
                  chatUser={chatUser}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onReply={setReplyTo}
                />
              );
            })}
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-gray-400">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-base font-medium text-gray-500">Nenhuma mensagem ainda</p>
            <p className="text-sm">Envie a primeira mensagem!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-3 border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-indigo-600">Respondendo a {replyTo.senderName}</p>
            <p className="truncate text-xs text-gray-600">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="h-7 w-7 rounded-full text-gray-500 transition-colors hover:bg-indigo-100">
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div className="relative border-t border-gray-200/50 bg-white px-4 py-3 shadow-lg">
        {showEmoji && (
          <EmojiPicker
            onSelect={e => {
              setInput(p => p + e);
              setShowEmoji(false);
              inputRef.current?.focus();
            }}
          />
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmoji(p => !p)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-gray-600 transition-all hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:scale-105"
            title="Emoji"
          >
            😊
          </button>

          <input ref={fileRef} type="file" accept="image/*" onChange={sendImage} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-gray-600 transition-all hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:scale-105"
            title="Anexar imagem"
          >
            📷
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Digite sua mensagem..."
            className="h-11 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />

          <button
            onClick={send}
            disabled={!input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold transition-all hover:shadow-lg hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            title="Enviar"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export function ChatModern({ user }: { user: User }) {
  const store = getChatStore();
  const [chats, setChats] = useState<Chat[]>(() => store.getChats(user.id, user.condoId || ''));
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<ChatUser[]>(() => store.getChatUsers(user.condoId || ''));
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const refresh = useCallback(() => {
    setChats([...store.getChats(user.id, user.condoId || '')]);
    setAllUsers([...store.getChatUsers(user.condoId || '')]);
  }, [user.id, user.condoId]);

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filteredChats = chats.filter(c => {
    if (c.type === 'group') return c.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const other = c.participants.find(p => p !== user.id);
    const otherUser = allUsers.find(u => u.id === other);
    return otherUser?.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const selectedChat = chats.find(c => c.id === selectedChatId);

  const startChat = (userId: string) => {
    const chat = store.getOrCreateDirectChat(user.id, userId, user.condoId || '');
    setSelectedChatId(chat.id);
    setShowNewChatModal(false);
    refresh();
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
      <div className="relative h-full">
        {/* Background decorativo */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-indigo-500 via-purple-500 to-indigo-500 opacity-10" />

        <div className="relative flex h-full p-2 sm:p-3">
          <div className="flex h-full w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
            {/* Sidebar */}
            <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full flex-col bg-white md:w-[380px] lg:w-[400px]`}>
              {/* Header */}
              <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    💬 Mensagens
                  </h2>
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-all hover:bg-white/30 hover:scale-110"
                    title="Nova conversa"
                  >
                    +
                  </button>
                </div>

                <div className="relative rounded-xl bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-lg">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar conversas..."
                    className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>
              </div>

              {/* Lista de chats */}
              <div className="flex-1 overflow-y-auto bg-gray-50">
                {filteredChats.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500">
                    <div className="space-y-2">
                      <div className="text-4xl">📭</div>
                      <p>Nenhuma conversa encontrada</p>
                    </div>
                  </div>
                ) : (
                  filteredChats.map(chat => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      currentUser={user}
                      allUsers={allUsers}
                      isSelected={chat.id === selectedChatId}
                      onClick={() => setSelectedChatId(chat.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Área do chat */}
            {selectedChat ? (
              <ChatWindow
                chat={selectedChat}
                currentUser={user}
                allUsers={allUsers}
                onBack={() => setSelectedChatId(null)}
              />
            ) : (
              <div className="hidden flex-1 flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 md:flex">
                <div className="mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 px-6 py-4 text-2xl shadow-lg">💬</div>
                <p className="text-2xl font-bold text-gray-700">Bem-vindo ao Chat</p>
                <p className="mt-2 text-sm text-gray-500">Selecione uma conversa para começar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nova Conversa */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
              <h3 className="text-lg font-bold text-white">Nova conversa</h3>
            </div>

            <div className="max-h-96 overflow-y-auto p-2 bg-gray-50">
              {allUsers.filter(u => u.id !== user.id).map(u => (
                <button
                  key={u.id}
                  onClick={() => startChat(u.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white hover:shadow-md"
                >
                  <Avatar name={u.name} size="md" online={u.online} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.role}{u.unit ? ` · ${u.unit}` : ''}</p>
                  </div>
                  {u.online && <span className="text-xs text-green-600 font-medium">Online</span>}
                </button>
              ))}
            </div>

            <div className="flex justify-end border-t border-gray-100 px-4 py-3 bg-white">
              <button
                onClick={() => setShowNewChatModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
