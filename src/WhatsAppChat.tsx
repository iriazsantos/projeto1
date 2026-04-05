import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { User } from './types';
import { resolveApiUrl } from './apiBase';

type ChatMessageType = 'text' | 'image' | 'file' | 'system';

interface ChatUser {
  id: string;
  name: string;
  role: string;
  condoId: string | null;
  condoName: string | null;
  unit: string | null;
  displayLabel: string;
  chatEnabled: boolean;
  online: boolean;
  lastSeenAt: string | null;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: ChatMessageType;
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  fileMime: string | null;
  fileSize: number | null;
  deleted: boolean;
  createdAt: string;
  sender: ChatUser | null;
}

interface ChatConversation {
  id: string;
  condoId: string;
  type: 'direct' | 'group';
  name: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  participants: ChatUser[];
  directPartner: ChatUser | null;
  canSend: boolean;
  lastMessage: ChatMessage | null;
}

interface ChatListResponse {
  conversations: ChatConversation[];
}

interface ChatUsersResponse {
  users: ChatUser[];
}

interface ChatMessagesResponse {
  messages: ChatMessage[];
}

interface ChatSettingsResponse {
  settings: {
    chatEnabled: boolean;
  };
}

interface ChatConversationResponse {
  conversation: ChatConversation;
}

interface ChatSendMessageResponse {
  message: ChatMessage;
}

interface UploadResponse {
  success: boolean;
  filename: string;
  originalName?: string;
  size: number;
  url: string;
}

interface ChatEventPayload {
  type: string;
  conversationId?: string;
  message?: ChatMessage;
  conversation?: ChatConversation;
  user?: ChatUser;
}

function getAuthToken() {
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
}

async function chatRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    }
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: string }).error || 'Falha na requisicao')
        : typeof payload === 'string'
          ? payload
          : 'Falha na requisicao';
    throw new Error(message);
  }

  return payload as T;
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

function formatLastSeen(user: ChatUser) {
  if (user.online) return 'online';
  if (!user.lastSeenAt) return '';

  const last = new Date(user.lastSeenAt).getTime();
  const diffMs = Date.now() - last;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'visto agora';
  if (minutes < 60) return `visto há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `visto há ${hours}h`;

  return `visto em ${new Date(user.lastSeenAt).toLocaleDateString('pt-BR')}`;
}

function formatFileSize(bytes: number | null) {
  if (!bytes || Number.isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function avatarColor(seed: string) {
  const palette = [
    '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f97316', '#06b6d4'
  ];

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % 100000;
  }

  return palette[hash % palette.length];
}

function avatarLabel(user: ChatUser) {
  const label = user.displayLabel || user.name || 'U';
  const cleaned = label.replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return 'U';
  return cleaned.slice(0, 2).toUpperCase();
}

function roleLabel(role: string) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin' || normalized === 'admin-master') return 'Admin';
  if (normalized === 'sindico') return 'Síndico';
  if (normalized === 'porteiro') return 'Porteiro';
  return 'Morador';
}

function isImageMessage(message: ChatMessage) {
  if (message.type === 'image') return true;
  if (!message.fileMime) return false;
  return message.fileMime.toLowerCase().startsWith('image/');
}

function conversationTitle(conversation: ChatConversation, currentUserId: string) {
  if (conversation.type === 'group') {
    return conversation.name || 'Grupo';
  }

  if (conversation.directPartner) {
    return conversation.directPartner.displayLabel || conversation.directPartner.name;
  }

  const partner = conversation.participants.find((participant) => participant.id !== currentUserId);
  return partner?.displayLabel || partner?.name || 'Conversa';
}

function conversationSubtitle(conversation: ChatConversation, currentUserId: string) {
  if (conversation.type === 'group') {
    return `${conversation.participants.length} participantes`;
  }

  if (conversation.directPartner) {
    return formatLastSeen(conversation.directPartner);
  }

  const partner = conversation.participants.find((participant) => participant.id !== currentUserId);
  if (!partner) return '';
  return formatLastSeen(partner);
}

function labelInitials(label: string) {
  const cleaned = String(label || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return 'CH';
  return cleaned.slice(0, 2).toUpperCase();
}

function conversationPreview(message: ChatMessage | null) {
  if (!message) return '';
  if (message.type === 'system') return message.content || '';
  if (isImageMessage(message)) return '📷 Foto';
  if (message.type === 'file') return '📎 Arquivo';
  return message.content || '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export function WhatsAppChatSection({ user, initialChatUserId, onChatOpened }: {
  user: User;
  initialChatUserId?: string;
  onChatOpened?: () => void;
}) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [typing, setTyping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;

    return conversations.filter((conversation) => {
      const title = conversationTitle(conversation, user.id).toLowerCase();
      const subtitle = conversationSubtitle(conversation, user.id).toLowerCase();
      const lastText = (conversation.lastMessage?.content || '').toLowerCase();
      return title.includes(term) || subtitle.includes(term) || lastText.includes(term);
    });
  }, [conversations, search, user.id]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;

    return users.filter((contact) => {
      const full = `${contact.displayLabel} ${contact.name} ${contact.condoName || ''}`.toLowerCase();
      return full.includes(term);
    });
  }, [users, search]);

  useEffect(() => {
    setUnreadTotal(conversations.reduce((acc, current) => acc + current.unreadCount, 0));
  }, [conversations]);

  const loadSettings = useCallback(async () => {
    const data = await chatRequest<ChatSettingsResponse>('/api/chat/me/settings');
    setChatEnabled(Boolean(data.settings?.chatEnabled));
  }, []);

  const loadUsers = useCallback(async () => {
    const data = await chatRequest<ChatUsersResponse>('/api/chat/users');
    setUsers(data.users || []);
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const data = await chatRequest<ChatListResponse>('/api/chat/conversations');
      const next = data.conversations || [];
      setConversations(next);

      setSelectedConversationId((current) => {
        if (current && next.some((conversation) => conversation.id === current)) {
          return current;
        }
        if (!current && next.length > 0) {
          return next[0].id;
        }
        return current;
      });
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const data = await chatRequest<ChatMessagesResponse>(`/api/chat/conversations/${conversationId}/messages?limit=120`);
      setMessages(data.messages || []);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      await chatRequest<{ success: boolean }>(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST'
      });
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )
      );
    } catch {
      // Ignore read-mark failures silently.
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadSettings(), loadUsers(), loadConversations()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar chat');
    }
  }, [loadConversations, loadSettings, loadUsers]);

  const sendPayload = useCallback(async (payload: {
    type: ChatMessageType;
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileMime?: string;
    fileSize?: number;
  }) => {
    if (!selectedConversation) return null;

    const response = await chatRequest<ChatSendMessageResponse>(`/api/chat/conversations/${selectedConversation.id}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setMessages((current) => {
      if (current.some((message) => message.id === response.message.id)) {
        return current;
      }
      return [...current, response.message];
    });

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              lastMessage: response.message,
              unreadCount: 0,
              updatedAt: response.message.createdAt
            }
          : conversation
      )
    );

    return response.message;
  }, [selectedConversation]);

  const ensureDirectConversation = useCallback(async (targetUserId: string) => {
    const data = await chatRequest<ChatConversationResponse>('/api/chat/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });

    const conversation = data.conversation;

    setConversations((current) => {
      const without = current.filter((item) => item.id !== conversation.id);
      return [conversation, ...without].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });

    setSelectedConversationId(conversation.id);
    setShowContacts(false);
    setSearch('');

    return conversation;
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedConversationId);
    void markAsRead(selectedConversationId);
  }, [loadMessages, markAsRead, selectedConversationId]);

  useEffect(() => {
    if (!initialChatUserId) return;

    let cancelled = false;
    void (async () => {
      try {
        const conversation = await ensureDirectConversation(initialChatUserId);
        if (!cancelled) {
          setSelectedConversationId(conversation.id);
          onChatOpened?.();
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Falha ao abrir conversa');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureDirectConversation, initialChatUserId, onChatOpened]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;

    const stream = new EventSource(resolveApiUrl(`/api/chat/stream?token=${encodeURIComponent(token)}`));

    const handleEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as ChatEventPayload;
        if (!payload?.type) return;

        if (payload.type === 'message:new' && payload.message) {
          const incomingMessage = payload.message;

          setConversations((current) =>
            current
              .map((conversation) => {
                if (conversation.id !== incomingMessage.conversationId) return conversation;
                const nextUnread = incomingMessage.senderId === user.id
                  ? 0
                  : (selectedConversationId === conversation.id ? 0 : conversation.unreadCount + 1);
                return {
                  ...conversation,
                  lastMessage: incomingMessage,
                  unreadCount: nextUnread,
                  updatedAt: incomingMessage.createdAt
                };
              })
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          );

          if (selectedConversationId === incomingMessage.conversationId) {
            setMessages((current) => {
              if (current.some((message) => message.id === incomingMessage.id)) {
                return current;
              }
              return [...current, incomingMessage];
            });
            void markAsRead(incomingMessage.conversationId);
          }
          return;
        }

        if (payload.type === 'conversation:new' && payload.conversation) {
          const newConversation = payload.conversation;
          setConversations((current) => {
            const without = current.filter((conversation) => conversation.id !== newConversation.id);
            return [newConversation, ...without]
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          });
          return;
        }

        if (payload.type === 'presence:update' && payload.user) {
          const presenceUser = payload.user;
          setUsers((current) =>
            current.map((contact) =>
              contact.id === presenceUser.id
                ? { ...contact, online: Boolean(presenceUser.online), lastSeenAt: presenceUser.lastSeenAt || contact.lastSeenAt }
                : contact
            )
          );

          setConversations((current) =>
            current.map((conversation) => {
              const participants = conversation.participants.map((participant) =>
                participant.id === presenceUser.id
                  ? {
                      ...participant,
                      online: Boolean(presenceUser.online),
                      lastSeenAt: presenceUser.lastSeenAt || participant.lastSeenAt
                    }
                  : participant
              );

              const directPartner =
                conversation.directPartner && conversation.directPartner.id === presenceUser.id
                  ? {
                      ...conversation.directPartner,
                      online: Boolean(presenceUser.online),
                      lastSeenAt: presenceUser.lastSeenAt || conversation.directPartner.lastSeenAt
                    }
                  : conversation.directPartner;

              return {
                ...conversation,
                participants,
                directPartner
              };
            })
          );
          return;
        }

        if (payload.type === 'settings:update' && payload.user) {
          const settingsUser = payload.user;
          setUsers((current) =>
            current.map((contact) =>
              contact.id === settingsUser.id
                ? { ...contact, chatEnabled: Boolean(settingsUser.chatEnabled) }
                : contact
            )
          );
        }
      } catch {
        // Ignore malformed stream payloads.
      }
    };

    stream.addEventListener('chat', handleEvent as EventListener);

    stream.onerror = () => {
      // Browser reconnects EventSource automatically.
    };

    return () => {
      stream.close();
    };
  }, [markAsRead, selectedConversationId, user.id]);

  useEffect(() => {
    const pushPresence = async (online: boolean) => {
      try {
        await chatRequest<{ success: boolean }>('/api/chat/presence', {
          method: 'POST',
          body: JSON.stringify({ online })
        });
      } catch {
        // Presence heartbeat should not block UI.
      }
    };

    void pushPresence(true);
    const interval = setInterval(() => {
      void pushPresence(true);
    }, 30000);

    return () => {
      clearInterval(interval);
      void pushPresence(false);
    };
  }, []);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages.length, selectedConversationId]);

  const handleToggleChatEnabled = useCallback(async () => {
    try {
      const next = !chatEnabled;
      await chatRequest<ChatSettingsResponse>('/api/chat/me/settings', {
        method: 'PUT',
        body: JSON.stringify({ chatEnabled: next })
      });
      setChatEnabled(next);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar configuracao');
    }
  }, [chatEnabled]);

  const handleSendText = useCallback(async () => {
    if (!selectedConversation || sending) return;
    const content = messageText.trim();
    if (!content) return;

    setSending(true);
    setError(null);
    try {
      await sendPayload({ type: 'text', content });
      setMessageText('');
      inputRef.current?.focus();
      await loadConversations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao enviar mensagem');
    } finally {
      setSending(false);
    }
  }, [loadConversations, messageText, selectedConversation, sendPayload, sending]);

  const handleFileSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>, forceType?: 'image' | 'file') => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !selectedConversation) return;

    setUploading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('condoId', selectedConversation.condoId);

      const uploadResponse = await fetch('/api/uploads/upload/chat', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      const uploadPayload = (await uploadResponse.json()) as UploadResponse & { error?: string };

      if (!uploadResponse.ok || !uploadPayload.url) {
        throw new Error(uploadPayload.error || 'Falha ao enviar arquivo');
      }

      const type: ChatMessageType = forceType
        ? forceType
        : file.type.toLowerCase().startsWith('image/') ? 'image' : 'file';
      const content = messageText.trim() || (uploadPayload.originalName || file.name);

      await sendPayload({
        type,
        content,
        fileUrl: uploadPayload.url,
        fileName: uploadPayload.originalName || file.name,
        fileMime: file.type,
        fileSize: file.size
      });

      setMessageText('');
      setShowAttachMenu(false);
      await loadConversations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  }, [loadConversations, messageText, selectedConversation, sendPayload]);

  const groupedMessages = useMemo(() => {
    const groups: Array<{ dateKey: string; dateLabel: string; list: ChatMessage[] }> = [];

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

  const selectedTitle = selectedConversation ? conversationTitle(selectedConversation, user.id) : '';
  const selectedPartner = selectedConversation?.directPartner;
  const canSendNow = chatEnabled && !uploading && !sending;

  /* ── RENDER ── */
  return (
    <div className="whatsapp-root">
      <div className="whatsapp-container">
        {/* ═══ PAINEL ESQUERDO — LISTA DE CONVERSAS ═══ */}
        <aside className={`whatsapp-sidebar ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
          {/* Header do sidebar */}
          <div className="whatsapp-sidebar-header">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-sm font-bold text-white overflow-hidden" style={{ background: avatarColor(user.name) }}>
                {user.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800 truncate">{user.name.split(' ')[0]}</p>
                <p className="text-xs text-slate-500">{chatEnabled ? 'Online' : 'Offline'}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={handleToggleChatEnabled} title={chatEnabled ? 'Ficar invisível' : 'Ficar online'}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                {chatEnabled ? '🟢' : '🔴'}
              </button>
              <button onClick={() => setShowContacts(p => !p)} title="Nova conversa"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                💬
              </button>
            </div>
          </div>

          {/* Busca */}
          <div className="px-3 py-2">
            <div className="flex items-center gap-3 bg-slate-100 rounded-lg px-3 py-2">
              <span className="text-slate-400 text-sm">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={showContacts ? 'Buscar usuários...' : 'Buscar ou começar nova conversa'}
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Abas */}
          <div className="px-3 flex gap-1">
            <button onClick={() => setShowContacts(false)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${!showContacts ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              Conversas
            </button>
            <button onClick={() => setShowContacts(true)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${showContacts ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              Contatos ({users.length})
            </button>
          </div>

          {/* Lista */}
          <div className="whatsapp-conversations-list">
            {showContacts ? (
              filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  <div className="text-3xl mb-2">👤</div>
                  Nenhum usuário encontrado
                </div>
              ) : (
                filteredUsers.map((contact) => (
                  <button key={contact.id} onClick={() => void ensureDirectConversation(contact.id)}
                    className="whatsapp-contact-item">
                    <div className="whatsapp-avatar-small" style={{ background: avatarColor(contact.displayLabel) }}>
                      {avatarLabel(contact)}
                      <span className={`whatsapp-status-dot ${contact.online ? 'online' : 'offline'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{contact.displayLabel || contact.name}</p>
                      <p className="text-xs text-slate-500 truncate">{roleLabel(contact.role)} {contact.condoName ? `• ${contact.condoName}` : ''}</p>
                    </div>
                  </button>
                ))
              )
            ) : loadingConversations ? (
              <div className="p-8 text-center text-sm text-slate-400">Carregando...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                <div className="text-3xl mb-2">💬</div>
                <p>Nenhuma conversa</p>
                <p className="text-xs mt-1">Clique em "Contatos" para iniciar</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const active = conversation.id === selectedConversationId;
                const title = conversationTitle(conversation, user.id);
                const partner = conversation.directPartner;
                const preview = conversationPreview(conversation.lastMessage);
                const time = conversation.lastMessage ? formatTime(conversation.lastMessage.createdAt) : '';

                return (
                  <button key={conversation.id}
                    onClick={() => { setSelectedConversationId(conversation.id); setShowContacts(false); }}
                    className={`whatsapp-contact-item ${active ? 'active' : ''}`}>
                    <div className="whatsapp-avatar-small" style={{ background: avatarColor(title) }}>
                      {labelInitials(title)}
                      {partner && <span className={`whatsapp-status-dot ${partner.online ? 'online' : 'offline'}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`font-semibold text-sm truncate ${active ? 'text-emerald-800' : 'text-slate-800'}`}>{title}</p>
                        <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">{time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 truncate flex-1">{preview || 'Toque para conversar'}</p>
                        {conversation.unreadCount > 0 && (
                          <span className="whatsapp-unread-badge">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ═══ PAINEL DIREITO — CHAT ═══ */}
        <section className={`whatsapp-chat ${selectedConversationId ? 'flex' : 'hidden md:flex'}`}>
          {!selectedConversation ? (
            <div className="whatsapp-empty-state">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-4xl text-white shadow-lg shadow-emerald-200">
                  💬
                </div>
                <h2 className="text-2xl font-bold text-slate-700 mb-2">INOVATECH Chat</h2>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Envie e receba mensagens em tempo real com os moradores e síndicos do condomínio.
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span>🔒</span> Mensagens criptografadas
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Header do chat */}
              <div className="whatsapp-chat-header">
                <button onClick={() => setSelectedConversationId(null)}
                  className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 mr-1">
                  ←
                </button>
                <div className="whatsapp-avatar-small" style={{ background: avatarColor(selectedTitle) }}>
                  {labelInitials(selectedTitle)}
                  {selectedPartner && <span className={`whatsapp-status-dot ${selectedPartner.online ? 'online' : 'offline'}`} />}
                </div>
                <div className="flex-1 min-w-0 ml-3">
                  <h3 className="font-semibold text-sm text-slate-800 truncate">{selectedTitle}</h3>
                  <p className="text-xs text-slate-500 truncate">
                    {selectedPartner ? formatLastSeen(selectedPartner) : ''}
                    {selectedConversation.type === 'group' ? `${selectedConversation.participants.length} participantes` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => void refreshAll()} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 text-sm">
                    🔄
                  </button>
                </div>
              </div>

              {/* Área de mensagens */}
              <div ref={messagesRef} className="whatsapp-messages-area">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mr-2" />
                    Carregando mensagens...
                  </div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center bg-white/90 backdrop-blur rounded-xl px-6 py-4 shadow-sm border border-slate-100">
                      <div className="text-3xl mb-2">👋</div>
                      <p className="text-sm text-slate-600 font-medium">Início da conversa</p>
                      <p className="text-xs text-slate-400 mt-1">Envie uma mensagem para começar</p>
                    </div>
                  </div>
                ) : (
                  <div className="whatsapp-messages-list">
                    {groupedMessages.map((group) => (
                      <div key={group.dateKey}>
                        <div className="whatsapp-date-divider">
                          <span>{group.dateLabel}</span>
                        </div>

                        {group.list.map((message) => {
                          const mine = message.senderId === user.id;
                          const image = isImageMessage(message);
                          const senderName = message.sender?.displayLabel || message.sender?.name || '';

                          return (
                            <div key={message.id} className={`whatsapp-message-row ${mine ? 'mine' : 'other'}`}>
                              <div className={`whatsapp-bubble ${mine ? 'whatsapp-bubble-mine' : 'whatsapp-bubble-other'}`}>
                                {!mine && (
                                  <p className="whatsapp-sender-name">{senderName}</p>
                                )}

                                {image && message.fileUrl && (
                                  <a href={message.fileUrl} target="_blank" rel="noreferrer" className="block mb-1 rounded-lg overflow-hidden">
                                    <img src={message.fileUrl} alt={message.fileName || 'imagem'} className="max-h-60 w-auto rounded-lg object-cover" loading="lazy" />
                                  </a>
                                )}

                                {message.type === 'file' && message.fileUrl && (
                                  <a href={message.fileUrl} target="_blank" rel="noreferrer"
                                    className={`flex items-center gap-2 mb-1 p-2 rounded-lg ${mine ? 'bg-white/15' : 'bg-slate-100'}`}>
                                    <span className="text-lg">📎</span>
                                    <div className="min-w-0">
                                      <p className={`text-xs font-medium truncate ${mine ? 'text-white' : 'text-slate-700'}`}>{message.fileName || 'Arquivo'}</p>
                                      <p className={`text-[10px] ${mine ? 'text-white/60' : 'text-slate-400'}`}>{formatFileSize(message.fileSize)}</p>
                                    </div>
                                  </a>
                                )}

                                <p className="whatsapp-message-text">{message.content}</p>

                                <div className="whatsapp-message-meta">
                                  <span>{formatTime(message.createdAt)}</span>
                                  {mine && (
                                    <span className="whatsapp-check-marks">✓✓</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer - Composer */}
              <div className="whatsapp-composer">
                {/* Menu de anexo */}
                {showAttachMenu && (
                  <div className="whatsapp-attach-menu">
                    <button onClick={() => imageInputRef.current?.click()} className="whatsapp-attach-btn" style={{ background: '#7c3aed' }}>
                      📷
                      <span className="text-[10px] text-white mt-0.5">Foto</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="whatsapp-attach-btn" style={{ background: '#2563eb' }}>
                      📄
                      <span className="text-[10px] text-white mt-0.5">Documento</span>
                    </button>
                  </div>
                )}

                <div className="whatsapp-composer-row">
                  <button onClick={() => setShowAttachMenu(p => !p)}
                    className="whatsapp-composer-btn"
                    disabled={!canSendNow}>
                    {showAttachMenu ? '✕' : '📎'}
                  </button>

                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => void handleFileSelected(e, 'image')} />
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar" className="hidden"
                    onChange={e => void handleFileSelected(e, 'file')} />

                  <textarea
                    ref={inputRef}
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    rows={1}
                    placeholder="Digite uma mensagem"
                    disabled={!canSendNow}
                    className="whatsapp-composer-input"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendText();
                      }
                    }}
                    onInput={e => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                    }}
                  />

                  <button onClick={() => void handleSendText()}
                    disabled={!canSendNow || !messageText.trim()}
                    className="whatsapp-send-btn">
                    {sending ? (
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      '➤'
                    )}
                  </button>
                </div>

                {(sending || uploading) && (
                  <p className="text-[10px] text-slate-400 mt-1 text-center">
                    {uploading ? 'Enviando arquivo...' : 'Enviando...'}
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {error && (
          <div className="fixed bottom-4 right-4 z-50 bg-red-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-slideUp">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-white/80 hover:text-white">✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function sendWhatsAppNotification(phone: string, message: string) {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return;
  const url = `https://wa.me/55${clean}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
