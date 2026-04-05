import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from './types';

// â”€â”€â”€ TIPOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ STORE GLOBAL DE CHAT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    name: 'ðŸ¢ CondomÃ­nio Residencial Aurora',
    participants: ['u2', 'u3', 'u4', 'u5'],
    adminIds: ['u2'],
    createdAt: twoDaysAgo,
  },
  {
    id: 'chat4', condoId: 'c1', type: 'group',
    name: 'ðŸ‘· Equipe da Portaria',
    participants: ['u2', 'u3'],
    adminIds: ['u2'],
    createdAt: twoDaysAgo,
  },
];

let _messages: ChatMessage[] = [
  { id: 'm1', chatId: 'chat1', senderId: 'u2', senderName: 'Carlos Mendes', content: 'OlÃ¡ Maria! Como vocÃª estÃ¡?', type: 'text', timestamp: yesterday, read: true, readAt: yesterday },
  { id: 'm2', chatId: 'chat1', senderId: 'u4', senderName: 'Maria Silva', content: 'Oi Carlos! Estou bem, obrigada. Queria perguntar sobre a taxa de novembro.', type: 'text', timestamp: yesterday, read: true },
  { id: 'm3', chatId: 'chat1', senderId: 'u2', senderName: 'Carlos Mendes', content: 'Claro! O boleto foi enviado para o seu email. Vencimento dia 10.', type: 'text', timestamp: now, read: false },
  { id: 'm4', chatId: 'chat3', senderId: 'u2', senderName: 'Carlos Mendes', content: 'ðŸ“¢ Assembleia geral no dia 20/11 Ã s 19h. Confirme presenÃ§a!', type: 'text', timestamp: yesterday, read: true },
  { id: 'm5', chatId: 'chat3', senderId: 'u4', senderName: 'Maria Silva', content: 'Confirmado! Estarei presente ðŸ‘', type: 'text', timestamp: yesterday, read: true },
  { id: 'm6', chatId: 'chat3', senderId: 'u5', senderName: 'Pedro Costa', content: 'Eu tambÃ©m confirmo presenÃ§a!', type: 'text', timestamp: now, read: false },
  { id: 'm7', chatId: 'chat2', senderId: 'u2', senderName: 'Carlos Mendes', content: 'Pedro, vi que sua cobranÃ§a de outubro estÃ¡ em aberto.', type: 'text', timestamp: twoDaysAgo, read: true },
  { id: 'm8', chatId: 'chat2', senderId: 'u5', senderName: 'Pedro Costa', content: 'Sim, vou regularizar atÃ© sexta!', type: 'text', timestamp: twoDaysAgo, read: true },
];

let _chatUsers: ChatUser[] = [
  { id: 'u1', name: 'Admin Master', role: 'admin', condoId: undefined, online: true, lastSeen: now, dontReceiveMessages: false },
  { id: 'u2', name: 'Carlos Mendes', role: 'sindico', unit: 'AP 01', condoId: 'c1', online: true, lastSeen: now, dontReceiveMessages: false },
  { id: 'u3', name: 'JoÃ£o Porteiro', role: 'porteiro', condoId: 'c1', online: false, lastSeen: new Date(Date.now() - 3600000).toISOString(), dontReceiveMessages: false },
  { id: 'u4', name: 'Maria Silva', role: 'morador', unit: '101-A', condoId: 'c1', online: true, lastSeen: now, dontReceiveMessages: false },
  { id: 'u5', name: 'Pedro Costa', role: 'morador', unit: '202-B', condoId: 'c1', online: false, lastSeen: new Date(Date.now() - 1800000).toISOString(), dontReceiveMessages: false },
];

// â”€â”€â”€ FUNÃ‡Ã•ES DO STORE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ UTILITÃRIOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  if (diff < 60) return `hÃ¡ ${diff} min`;
  if (diff < 1440) return `hÃ¡ ${Math.floor(diff / 60)} horas`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const QUICK_REACTIONS = ['ðŸ‘', 'â¤ï¸', 'ðŸ˜‚', 'ðŸ˜®', 'ðŸ˜¢', 'ðŸ™', 'ðŸ”¥', 'âœ…'];

// â”€â”€â”€ AVATAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ CHAT LIST ITEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    ? (chat.name ?? 'Grupo do Condominio')
    : (otherUser?.name ?? 'Usuario');
  
  const lastMsg = chat.lastMessage;
  const unreadCount = store
    .getMessages(chat.id)
    .filter(m => m.senderId !== currentUser.id && !m.read).length;
  
  const isOtherOnline = chat.type === 'direct' && otherUser?.online;
  const lastMessageText = lastMsg?.deleted
    ? 'Mensagem apagada'
    : lastMsg?.type === 'image'
      ? 'Imagem'
      : lastMsg?.content ?? 'Sem mensagens';

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-[#f0f2f5] px-3 py-3 text-left transition-colors ${
        isSelected
          ? 'bg-[#f0f2f5]'
          : 'bg-white hover:bg-[#f7f8f8]'
      }`}
    >
      {/* Avatar */}
      {chat.type === 'group' ? (
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-bold text-[#54656f]">
          GR
        </div>
      ) : (
        <div className="relative">
          <Avatar name={displayName} size="md" />
          {isOtherOnline && (
            <span className="absolute -right-0.5 bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#25d366]" />
          )}
        </div>
      )}

      {/* Conteudo */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-[15px] font-medium text-[#111b21]">
            {displayName}
          </p>
          {lastMsg && (
            <span className={`text-[11px] ${unreadCount > 0 ? 'text-[#00a884]' : 'text-[#667781]'}`}>
              {formatTime(lastMsg.timestamp)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-[13px] text-[#667781]">
            {lastMessageText}
          </p>
          {unreadCount > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1.5 py-0.5 text-[11px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// â”€â”€â”€ MESSAGE BUBBLE (TELEGRAM STYLE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      <div className="my-3 flex justify-center">
        <span className="rounded-lg bg-[#e1f2fb] px-3 py-1 text-[11px] font-medium text-[#54656f]">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`group mb-1.5 flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine && (
        <div className="mb-0.5 w-9 shrink-0">
          {showAvatar ? (
            <Avatar name={msg.senderName} size="sm" online={chatUser?.online} />
          ) : (
            <div className="h-9 w-9" />
          )}
        </div>
      )}

      <div className={`flex max-w-[86%] flex-col ${isMine ? 'items-end' : 'items-start'} sm:max-w-[68%]`}>
        {!isMine && showAvatar && (
          <p className="mb-0.5 px-1 text-[11px] font-medium text-[#54656f]">{msg.senderName}</p>
        )}

        {msg.replyTo && !msg.deleted && (
          <div className={`mb-1 w-full rounded-md border-l-4 px-2 py-1 text-[11px] ${
            isMine
              ? 'border-[#53bdeb] bg-[#cdeccd] text-[#54656f]'
              : 'border-[#00a884] bg-[#f0f2f5] text-[#54656f]'
          }`}>
            <p className="font-semibold">{msg.replyTo.senderName}</p>
            <p className="truncate">{msg.replyTo.content}</p>
          </div>
        )}

        <div
          className={`relative rounded-lg px-3 py-2 text-[14px] shadow-[0_1px_0_rgba(11,20,26,0.08)] ${
            isMine
              ? 'rounded-tr-sm bg-[#d9fdd3] text-[#111b21]'
              : 'rounded-tl-sm border border-[#e7e9ea] bg-white text-[#111b21]'
          } ${msg.deleted ? 'italic opacity-70' : ''}`}
          onMouseEnter={() => !msg.deleted && setShowActions(true)}
          onMouseLeave={() => {
            setShowActions(false);
            setShowReactions(false);
          }}
        >
          {msg.deleted ? (
            <p>Mensagem apagada</p>
          ) : msg.type === 'image' && msg.imageUrl ? (
            <div className="space-y-1">
              <img src={msg.imageUrl} alt="imagem" className="max-h-72 max-w-full rounded-md object-cover" />
              {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          )}

          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[11px] text-[#667781]">{formatTime(msg.timestamp)}</span>
            {isMine && !msg.deleted && (
              <span className={`text-[11px] ${msg.read ? 'text-[#53bdeb]' : 'text-[#667781]'}`}>
                {msg.read ? 'âœ“âœ“' : 'âœ“'}
              </span>
            )}
          </div>

          {showActions && !msg.deleted && (
            <div className={`absolute top-1 z-20 ${isMine ? '-left-20' : '-right-20'}`}>
              <div className="flex items-center gap-1 rounded-md border border-[#d1d7db] bg-white p-1 shadow-lg">
                <button
                  onClick={() => setShowReactions(p => !p)}
                  className="h-7 w-7 rounded text-sm text-[#54656f] transition-colors hover:bg-[#f0f2f5]"
                  title="Reagir"
                >
                  +
                </button>
                <button
                  onClick={() => onReply(msg)}
                  className="h-7 w-7 rounded text-sm text-[#54656f] transition-colors hover:bg-[#f0f2f5]"
                  title="Responder"
                >
                  â†©
                </button>
                {isMine && (
                  <button
                    onClick={() => { if (confirm('Apagar mensagem?')) onDelete(msg.id); }}
                    className="h-7 w-7 rounded text-sm text-[#54656f] transition-colors hover:bg-[#f0f2f5]"
                    title="Apagar"
                  >
                    x
                  </button>
                )}
              </div>
            </div>
          )}

          {showReactions && (
            <div className={`absolute bottom-full z-30 mb-2 flex gap-1 rounded-full border border-[#d1d7db] bg-white p-1.5 shadow-xl ${isMine ? 'right-0' : 'left-0'}`}>
              {QUICK_REACTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => {
                    onReact(msg.id, e);
                    setShowReactions(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform hover:scale-110 hover:bg-[#f0f2f5]"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {Object.keys(groupedReactions).length > 0 && (
          <div className={`mt-1 flex flex-wrap items-center gap-1 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-1 rounded-full border border-[#d1d7db] bg-white px-2 py-0.5 text-[11px] text-[#54656f] transition-colors hover:bg-[#f0f2f5]"
              >
                <span>{emoji}</span>
                {count > 1 && <span>{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ EMOJI PICKER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const emojis = ['ðŸ˜€', 'ðŸ˜‚', 'ðŸ˜', 'ðŸ¥°', 'ðŸ˜Ž', 'ðŸ¤”', 'ðŸ˜¢', 'ðŸ˜¡', 'ðŸ‘', 'ðŸ‘', 'ðŸ™', 'ðŸŽ‰'];
  return (
    <div className="absolute bottom-full left-2 z-40 mb-2 grid grid-cols-6 gap-1 rounded-xl border border-[#d1d7db] bg-white p-2 shadow-xl">
      {emojis.map(e => (
        <button key={e} onClick={() => onSelect(e)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-[#f0f2f5]">
          {e}
        </button>
      ))}
    </div>
  );
}

// â”€â”€â”€ CHAT WINDOW (TELEGRAM STYLE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const displayName = chat.type === 'group' ? (chat.name ?? 'Grupo do Condominio') : (otherParticipants[0]?.name ?? 'Usuario');
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
    <div className="flex h-full flex-1 flex-col bg-[#efeae2]">
      <div className="flex items-center gap-3 border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-2.5">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-[#e9edef] md:hidden"
        >
          {'<'}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {chat.type === 'group' ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfe5e7] text-xs font-bold text-[#54656f]">
              GR
            </div>
          ) : (
            <Avatar name={displayName} size="md" online={isOtherOnline} />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-[#111b21]">{displayName}</p>
            <p className="truncate text-[12px] text-[#667781]">
              {chat.type === 'group'
                ? `${chat.participants.length} participantes`
                : isOtherOnline
                  ? 'online'
                  : `visto ${formatLastSeen(otherParticipants[0]?.lastSeen || '')}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-[#e9edef]" title="Pesquisar">
            o
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-[#e9edef]" title="Mais opcoes">
            ...
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-3 py-4"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.45) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <div className="my-3 flex justify-center">
              <span className="rounded-md bg-[#d1e6f2] px-2.5 py-1 text-[11px] font-medium text-[#54656f]">
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
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-[#667781]">
            <p className="text-base font-medium">Nenhuma mensagem</p>
            <p className="text-sm">Inicie esta conversa agora.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-l-4 border-[#00a884] bg-[#f0f2f5] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#00a884]">Respondendo a {replyTo.senderName}</p>
            <p className="truncate text-[12px] text-[#54656f]">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="h-7 w-7 rounded-full text-[#667781] transition-colors hover:bg-[#e9edef]">
            x
          </button>
        </div>
      )}

      <div className="relative border-t border-[#d1d7db] bg-[#f0f2f5] px-3 py-2">
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
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-[#54656f] transition-colors hover:bg-[#e9edef]"
            title="Emoji"
          >
            :)
          </button>

          <input ref={fileRef} type="file" accept="image/*" onChange={sendImage} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-[#54656f] transition-colors hover:bg-[#e9edef]"
            title="Anexo"
          >
            +
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
            placeholder="Digite uma mensagem"
            className="h-10 flex-1 rounded-full border border-transparent bg-white px-4 text-[14px] text-[#111b21] placeholder-[#8696a0] outline-none focus:border-[#d1d7db]"
          />

          <button
            onClick={send}
            disabled={!input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white transition-colors hover:bg-[#019272] disabled:cursor-not-allowed disabled:bg-[#9ad9cb]"
            title="Enviar"
          >
            {'>'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatTelegram({ user }: { user: User }) {
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
    <div className="h-[calc(100vh-80px)] overflow-hidden rounded-2xl border border-[#cfd8dc] bg-[#d9dbd5]">
      <div className="relative h-full">
        <div className="absolute inset-x-0 top-0 h-24 bg-[#00a884]" />

        <div className="relative flex h-full p-2 sm:p-3">
          <div className="flex h-full w-full overflow-hidden rounded-xl border border-[#d1d7db] bg-white shadow-[0_6px_18px_rgba(11,20,26,0.18)]">
            <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full flex-col bg-white md:w-[360px] lg:w-[390px]`}>
              <div className="border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[18px] font-semibold text-[#111b21]">Mensagens</h2>
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-[#e9edef]"
                    title="Nova conversa"
                  >
                    +
                  </button>
                </div>

                <div className="rounded-lg bg-white px-3 py-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar ou comecar nova conversa"
                    className="w-full bg-transparent text-[13px] text-[#111b21] placeholder-[#8696a0] outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white">
                {filteredChats.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[#667781]">
                    Nenhuma conversa encontrada.
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

            {selectedChat ? (
              <ChatWindow
                chat={selectedChat}
                currentUser={user}
                allUsers={allUsers}
                onBack={() => setSelectedChatId(null)}
              />
            ) : (
              <div className="hidden flex-1 flex-col items-center justify-center bg-[#f7f9fa] md:flex">
                <div className="mb-3 rounded-full bg-[#dfe5e7] px-5 py-3 text-[13px] text-[#54656f]">Mensagens</div>
                <p className="text-[20px] font-light text-[#41525d]">Selecione uma conversa</p>
                <p className="mt-1 text-[14px] text-[#667781]">Escolha um contato para iniciar.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#d1d7db] bg-white shadow-2xl">
            <div className="border-b border-[#d1d7db] bg-[#f0f2f5] px-4 py-3">
              <h3 className="text-[16px] font-semibold text-[#111b21]">Nova conversa</h3>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {allUsers.filter(u => u.id !== user.id).map(u => (
                <button
                  key={u.id}
                  onClick={() => startChat(u.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f0f2f5]"
                >
                  <Avatar name={u.name} size="md" online={u.online} />
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-[#111b21]">{u.name}</p>
                    <p className="text-[12px] text-[#667781]">{u.role}{u.unit ? ` - ${u.unit}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end border-t border-[#d1d7db] px-4 py-3">
              <button
                onClick={() => setShowNewChatModal(false)}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-[#54656f] transition-colors hover:bg-[#f0f2f5]"
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

