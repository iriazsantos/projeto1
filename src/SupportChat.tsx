import { useState, useEffect, useRef } from 'react';
import type { User } from './types';
import { getBackendState, subscribeBackendState, updateBackendState } from './backendState';

interface SupportMessage {
  id: string;
  from: 'user' | 'support';
  text: string;
  time: string;
  read: boolean;
}

interface SupportConversation {
  userId: string;
  userName: string;
  userRole: string;
  condoName?: string;
  messages: SupportMessage[];
  status: 'open' | 'waiting' | 'resolved';
  lastMessage: string;
  unread: number;
  createdAt: string;
}

// Store global de conversas de suporte
const supportStore = {
  get conversations(): SupportConversation[] {
    return (getBackendState().supportConversations as SupportConversation[]) ?? [];
  },
  subscribe(fn: () => void) { return subscribeBackendState(fn); },
  save(nextConversations: SupportConversation[]) {
    updateBackendState((state) => {
      state.supportConversations = nextConversations;
    });
  },
  getConversation(userId: string) { return this.conversations.find(c => c.userId === userId); },
  getOrCreate(user: User, condoName?: string): SupportConversation {
    let conv = this.getConversation(user.id);
    if (!conv) {
      conv = {
        userId: user.id, userName: user.name, userRole: user.role, condoName,
        messages: [], status: 'open', lastMessage: '', unread: 0,
        createdAt: new Date().toISOString(),
      };
      this.save([...this.conversations, conv]);
    }
    return conv;
  },
  sendFromUser(userId: string, text: string) {
    const conv = this.conversations.find(c => c.userId === userId);
    if (!conv) return;
    const msg: SupportMessage = { id: Date.now().toString(), from: 'user', text, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), read: false };
    this.save(this.conversations.map(c =>
      c.userId === userId
        ? { ...c, messages: [...c.messages, msg], lastMessage: text, status: 'waiting' }
        : c
    ));
    // Auto resposta bot após 1.5s
    setTimeout(() => {
      const auto = getAutoReply(text);
      this.sendFromSupport(userId, auto);
    }, 1500);
  },
  sendFromSupport(userId: string, text: string) {
    const conv = this.conversations.find(c => c.userId === userId);
    if (!conv) return;
    const msg: SupportMessage = { id: Date.now().toString() + 's', from: 'support', text, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), read: false };
    this.save(this.conversations.map(c =>
      c.userId === userId
        ? { ...c, messages: [...c.messages, msg], lastMessage: text, unread: c.unread + 1 }
        : c
    ));
  },
  markRead(userId: string) {
    const conv = this.conversations.find(c => c.userId === userId);
    if (!conv) return;
    this.save(this.conversations.map(c =>
      c.userId === userId
        ? { ...c, messages: c.messages.map(m => ({ ...m, read: true })), unread: 0 }
        : c
    ));
  },
  resolve(userId: string) {
    const conv = this.conversations.find(c => c.userId === userId);
    if (conv) { this.save(this.conversations.map(c => c.userId === userId ? { ...c, status: 'resolved' } : c)); }
  },
};

function getAutoReply(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('pix') || t.includes('pagamento') || t.includes('boleto') || t.includes('cobrança'))
    return '💳 Para questões de pagamento, o módulo Financeiro do painel possui todas as opções de PIX e boleto. Se precisar de suporte adicional, um atendente irá te ajudar em breve!';
  if (t.includes('senha') || t.includes('login') || t.includes('acesso') || t.includes('entrar'))
    return '🔐 Para redefinir sua senha, entre em contato com o administrador do seu condomínio. Se for acesso bloqueado, verifique a situação da licença na aba correspondente.';
  if (t.includes('encomenda') || t.includes('qr') || t.includes('entrega') || t.includes('pacote'))
    return '📦 O sistema de encomendas usa QR Code exclusivo. O porteiro registra a chegada e você escaneia o código pelo módulo de Encomendas para confirmar o recebimento!';
  if (t.includes('reserva') || t.includes('churrasqueira') || t.includes('área') || t.includes('salão'))
    return '📅 Para reservar áreas comuns, acesse o módulo "Reservas" no menu lateral. Você pode ver a disponibilidade em tempo real e escolher o horário.';
  if (t.includes('morador') || t.includes('cadastro') || t.includes('usuário'))
    return '👥 Para cadastrar moradores, o síndico deve acessar "Gestão de Pessoas" no menu. Cada morador receberá e-mail e senha para acessar o sistema.';
  if (t.includes('bloqueado') || t.includes('licença') || t.includes('suspens'))
    return '🔒 Se o acesso estiver bloqueado, pode ser inadimplência da licença. O síndico deve verificar a aba "Licença INOVATECH" e regularizar o pagamento.';
  if (t.includes('chat') || t.includes('mensagem') || t.includes('whatsapp'))
    return '💬 O sistema possui chat interno estilo WhatsApp! Acesse "Mensagens" no menu para conversar com outros moradores, porteiro e síndico.';
  if (t.includes('bug') || t.includes('erro') || t.includes('problema') || t.includes('falha'))
    return '🐛 Identificamos seu problema técnico! Nossa equipe será notificada. Por favor, descreva com mais detalhes o que aconteceu e em qual módulo.';
  if (t.includes('obrigado') || t.includes('valeu') || t.includes('muito obrigado'))
    return '😊 De nada! Ficamos felizes em ajudar. Se precisar de mais alguma coisa, pode perguntar à vontade!';
  if (t.includes('olá') || t.includes('oi') || t.includes('bom dia') || t.includes('boa tarde') || t.includes('boa noite'))
    return '👋 Olá! Seja bem-vindo ao suporte INOVATECH CONNECT. Como posso te ajudar hoje?';
  return '🤖 Entendemos sua solicitação! Um atendente especializado irá te ajudar em breve. Enquanto isso, você pode consultar nossos módulos disponíveis no menu lateral. Há algo mais que posso esclarecer?';
}

// ─── COMPONENTE: CHAT DE SUPORTE DO USUÁRIO ─────────────────────────────────
export function SupportChatWidget({ user, condoName }: { user: User; condoName?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [, setTick] = useState(0);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = supportStore.subscribe(() => setTick(t => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    // Checar se há nova mensagem do suporte
    const conv = supportStore.getConversation(user.id);
    if (conv?.messages.slice(-1)[0]?.from === 'support') {
      setTyping(false);
    }
  }, []);

  const conv = supportStore.getConversation(user.id);
  const unread = conv?.unread ?? 0;

  const handleOpen = () => {
    setOpen(true);
    if (!conv) {
      supportStore.getOrCreate(user, condoName);
      setTimeout(() => {
        supportStore.sendFromSupport(user.id, `👋 Olá, ${user.name.split(' ')[0]}! Bem-vindo ao suporte INOVATECH CONNECT. Como posso te ajudar hoje?`);
      }, 800);
    }
    supportStore.markRead(user.id);
  };

  const handleClose = () => setOpen(false);

  const handleSend = () => {
    if (!text.trim()) return;
    supportStore.getOrCreate(user, condoName);
    const msg = text.trim();
    setText('');
    setTyping(true);
    supportStore.sendFromUser(user.id, msg);
    setTimeout(() => setTyping(false), 2000);
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [conv?.messages.length, open, typing]);

  const messages = conv?.messages ?? [];

  return (
    <>
      {/* Botão flutuante */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2">
        {/* Tooltip */}
        {!open && (
          <div
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-lg pointer-events-none"
            style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', animation: 'fadeIn 0.3s ease-out' }}
          >
            💬 Suporte Online
          </div>
        )}
        <button
          onClick={open ? handleClose : handleOpen}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 relative"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            animation: open ? 'none' : 'supportPulse 2s ease-in-out infinite',
            transform: open ? 'scale(0.95)' : 'scale(1)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
          }}
        >
          <span className="text-2xl">{open ? '✕' : '💬'}</span>
          {unread > 0 && !open && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold border-2 border-white"
              style={{ animation: 'bounce 1s infinite' }}
            >
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* Janela do chat */}
      {open && (
        <div
          className="fixed bottom-24 left-6 z-50 w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{
            height: '480px',
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.1)',
            animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🎧</div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-indigo-600" style={{ animation: 'pulse 2s infinite' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Suporte INOVATECH</p>
              <p className="text-white/60 text-xs">🟢 Online agora · Resposta rápida</p>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 hover:text-white flex items-center justify-center text-sm font-bold transition-colors">✕</button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ 
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.1) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}>
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-3 animate-bounce">💬</div>
                <p className="text-white/60 text-sm">Iniciando conversa com suporte...</p>
                <p className="text-white/40 text-xs mt-1">Nossa equipe responderá em instantes</p>
              </div>
            )}
            {messages.map((msg, index) => (
              <div 
                key={msg.id} 
                className={`flex items-end gap-2 ${msg.from === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {msg.from === 'support' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm flex-shrink-0 shadow-lg ring-2 ring-white/10">
                    🎧
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg transition-all duration-200 hover:shadow-xl ${
                    msg.from === 'user' 
                      ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-white rounded-br-md' 
                      : 'bg-white/10 backdrop-blur-sm text-white rounded-bl-md border border-white/10'
                  }`}
                >
                  {msg.text}
                  <div className={`text-xs mt-1.5 ${msg.from === 'user' ? 'text-white/60' : 'text-white/50'} text-right`}>
                    {msg.time}
                  </div>
                </div>
                {msg.from === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-lg ring-2 ring-white/10">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div className="flex items-end gap-2 animate-slideUp">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm flex-shrink-0 shadow-lg ring-2 ring-white/10">
                  🎧
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg">
                  <div className="flex gap-1.5 items-center">
                    {[0, 1, 2].map(i => (
                      <div 
                        key={i} 
                        className="w-2 h-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full" 
                        style={{ animation: `bounce 1s infinite ${i * 0.2}s` }} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 flex gap-2 flex-shrink-0" style={{ background: '#1e293b', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'; }}
              onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; }}
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30"
              style={{ background: text.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.06)' }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── COMPONENTE: PAINEL DE SUPORTE DO ADMIN ─────────────────────────────────
export function SupportAdminPanel() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'waiting' | 'resolved'>('all');
  const [, setTick] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = supportStore.subscribe(() => setTick(t => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      supportStore.markRead(selectedUserId);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [selectedUserId, supportStore.getConversation(selectedUserId ?? '')?.messages.length]);

  const convs = supportStore.conversations.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const selected = selectedUserId ? supportStore.getConversation(selectedUserId) : null;

  const handleSend = () => {
    if (!text.trim() || !selectedUserId) return;
    supportStore.sendFromSupport(selectedUserId, text.trim());
    // Marcar como lido imediatamente
    supportStore.markRead(selectedUserId);
    setText('');
  };

  const statusColors: Record<string, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    waiting: 'bg-amber-100 text-amber-700',
    resolved: 'bg-gray-100 text-gray-500',
  };

  const statusLabels: Record<string, string> = {
    open: '🟢 Aberto',
    waiting: '⏳ Aguardando',
    resolved: '✅ Resolvido',
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    sindico: 'bg-blue-100 text-blue-700',
    porteiro: 'bg-amber-100 text-amber-700',
    morador: 'bg-emerald-100 text-emerald-700',
  };

  const totalUnread = supportStore.conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Lista de conversas */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-100">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold flex items-center gap-2">
              🎧 Suporte Online
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{totalUnread}</span>
              )}
            </h2>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white/70 text-xs">Online</span>
            </div>
          </div>
          {/* Filtros */}
          <div className="flex gap-1">
            {(['all', 'open', 'waiting', 'resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all ${filter === f ? 'bg-white text-indigo-600' : 'text-white/60 hover:text-white'}`}
              >
                {f === 'all' ? 'Todos' : f === 'open' ? 'Abertos' : f === 'waiting' ? 'Aguardando' : 'Resolvidos'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {convs.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm">Nenhuma conversa</p>
              <p className="text-xs mt-1 text-gray-300">Os usuários entrarão em contato aqui</p>
            </div>
          )}
          {convs.map(conv => (
            <button
              key={conv.userId}
              onClick={() => { setSelectedUserId(conv.userId); supportStore.markRead(conv.userId); }}
              className={`w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors ${selectedUserId === conv.userId ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {conv.userName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className="font-semibold text-gray-800 text-sm truncate">{conv.userName}</p>
                    {conv.unread > 0 && (
                      <span className="w-5 h-5 bg-indigo-500 text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">{conv.unread}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${roleColors[conv.userRole] ?? 'bg-gray-100 text-gray-600'}`}>
                      {conv.userRole}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${statusColors[conv.status]}`}>
                      {statusLabels[conv.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{conv.lastMessage || 'Sem mensagens'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
          <p className="text-xs text-gray-400">{convs.length} conversa{convs.length !== 1 ? 's' : ''} · {supportStore.conversations.reduce((s, c) => s + c.messages.length, 0)} mensagens</p>
        </div>
      </div>

      {/* Área de chat */}
      {selected ? (
        <div className="flex-1 flex flex-col">
          {/* Header do chat */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                {selected.userName[0]}
              </div>
              <div>
                <p className="font-bold text-gray-800">{selected.userName}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleColors[selected.userRole] ?? 'bg-gray-100 text-gray-600'}`}>
                    {selected.userRole}
                  </span>
                  {selected.condoName && <span className="text-xs text-gray-400">{selected.condoName}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {selected.status !== 'resolved' && (
                <button
                  onClick={() => supportStore.resolve(selected.userId)}
                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-200 transition-colors border border-emerald-200"
                >
                  ✅ Resolver
                </button>
              )}
              <span className={`px-2 py-1 rounded-xl text-xs font-bold ${statusColors[selected.status]}`}>
                {statusLabels[selected.status]}
              </span>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ 
            background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.08) 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}>
            {selected.messages.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-6xl mb-4 animate-bounce">💬</div>
                <p className="text-lg font-semibold text-gray-500">Nenhuma mensagem ainda</p>
                <p className="text-sm mt-1">Esta conversa está pronta para começar</p>
              </div>
            )}
            {selected.messages.map((msg, index) => (
              <div 
                key={msg.id} 
                className={`flex items-end gap-2 ${msg.from === 'support' ? 'justify-end' : 'justify-start'} animate-slideUp`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {msg.from === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm mr-2 flex-shrink-0 shadow-lg ring-2 ring-white">
                    {selected.userName[0]}
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-md transition-all duration-200 hover:shadow-lg hover:scale-[1.01] ${
                    msg.from === 'support' 
                      ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-white rounded-br-md' 
                      : 'bg-white text-gray-800 rounded-bl-md border border-gray-100'
                  }`}
                >
                  {msg.text}
                  <div className={`text-xs mt-1.5 ${msg.from === 'support' ? 'text-white/60' : 'text-gray-400'} text-right`}>
                    {msg.time}
                  </div>
                </div>
                {msg.from === 'support' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm ml-2 flex-shrink-0 shadow-lg ring-2 ring-white">
                    🎧
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de resposta (Admin) */}
          <div className="p-4 bg-white border-t border-gray-100">
            {selected.status === 'resolved' ? (
              <div className="text-center py-3">
                <p className="text-sm text-gray-400">✅ Esta conversa foi resolvida</p>
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Digite sua resposta..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-sm transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  Enviar ➤
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400" style={{ background: '#f8fafc' }}>
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-lg font-bold text-gray-600 mb-2">Support Hub</h3>
          <p className="text-sm text-center max-w-sm">
            Selecione uma conversa para responder. Os usuários podem abrir chamados clicando no botão flutuante de suporte.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 max-w-sm">
            {[
              { icon: '🟢', label: 'Online', desc: 'Você está disponível' },
              { icon: '⚡', label: 'Rápido', desc: 'Resposta imediata' },
              { icon: '🔒', label: 'Seguro', desc: 'Chat criptografado' },
              { icon: '🤖', label: 'Bot ativo', desc: 'Auto-respostas' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl p-3 border border-gray-200 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="font-bold text-gray-700 text-sm">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
