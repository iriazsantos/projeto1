// ═══════════════════════════════════════════════════════════════════════════
// MÓDULOS FALTANTES — INOVATECH CONNECT
// ─ Manutenção e Chamados
// ─ Documentos Digitais
// ─ Controle de Acesso / Visitantes
// ─ Relatórios e Analytics
// ─ Achados e Perdidos
// ─ Dark Mode
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useRef, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStore } from './store';
import type { User } from './types';
import { getBackendState, updateBackendState } from './backendState';

function fmtDate(s: string) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('pt-BR');
}
function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  const normalized = text.replace(/\r?\n/g, ' ').trim();
  const escaped = normalized.replace(/"/g, '""');
  return /[;"\n,]/.test(normalized) ? `"${escaped}"` : escaped;
}
function csvContent(rows: Array<Array<unknown>>) {
  return `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
}
function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function getPdfLastY(doc: jsPDF) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20;
}

// ─── TIPOS LOCAIS ────────────────────────────────────────────────────────────
interface MaintenanceTicket {
  id: string;
  condoId: string;
  title: string;
  description: string;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: string;
  reportedBy: string;
  reportedByName: string;
  assignedTo?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  rating?: number;
}

interface Document {
  id: string;
  condoId: string;
  title: string;
  category: string;
  description: string;
  fileType: string;
  fileSize: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  version: string;
  tags: string[];
}

interface AccessLog {
  id: string;
  condoId: string;
  type: 'visitor' | 'service' | 'delivery' | 'resident';
  name: string;
  document?: string;
  destination: string;
  purpose: string;
  vehiclePlate?: string;
  enteredAt: string;
  exitedAt?: string;
  authorizedBy?: string;
  company?: string;
  status: 'inside' | 'exited';
}

interface LostFound {
  id: string;
  condoId: string;
  type: 'lost' | 'found';
  title: string;
  description: string;
  location: string;
  category: string;
  reportedBy: string;
  reportedByName: string;
  contactPhone?: string;
  status: 'active' | 'resolved';
  createdAt: string;
  photo?: string;
}

// ─── STORE LOCAL ────────────────────────────────────────────────────────────
let _tickets: MaintenanceTicket[] = [
  {
    id: 'tkt1', condoId: 'c1', title: 'Lâmpada queimada no corredor', description: 'Lâmpada do corredor do 3º andar está queimada há 3 dias.',
    location: 'Bloco A - 3º Andar', priority: 'medium', status: 'open', category: 'Elétrica',
    reportedBy: 'u4', reportedByName: 'Maria Silva', photos: [], createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date().toISOString()
  },
  {
    id: 'tkt2', condoId: 'c1', title: 'Vazamento no banheiro da piscina', description: 'Torneira com vazamento constante desperdiçando água.',
    location: 'Área da Piscina', priority: 'high', status: 'in_progress', category: 'Hidráulica',
    reportedBy: 'u5', reportedByName: 'Pedro Costa', assignedTo: 'Encanador José', photos: [], createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), updatedAt: new Date().toISOString()
  },
  {
    id: 'tkt3', condoId: 'c1', title: 'Portão da garagem com defeito', description: 'O portão está demorando para abrir e fazendo barulho.',
    location: 'Garagem Subsolo', priority: 'urgent', status: 'open', category: 'Portão/Acesso',
    reportedBy: 'u4', reportedByName: 'Maria Silva', photos: [], createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date().toISOString()
  },
];

let _documents: Document[] = [
  { id: 'doc1', condoId: 'c1', title: 'Convenção do Condomínio', category: 'Jurídico', description: 'Convenção condominial atualizada em 2023', fileType: 'PDF', fileSize: '2.4 MB', uploadedBy: 'u2', uploadedByName: 'Carlos Mendes', createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), version: '3.0', tags: ['convenção', 'regras', 'jurídico'] },
  { id: 'doc2', condoId: 'c1', title: 'Regimento Interno', category: 'Regras', description: 'Regimento interno com normas de convivência', fileType: 'PDF', fileSize: '1.8 MB', uploadedBy: 'u2', uploadedByName: 'Carlos Mendes', createdAt: new Date(Date.now() - 86400000 * 20).toISOString(), version: '2.1', tags: ['regimento', 'normas'] },
  { id: 'doc3', condoId: 'c1', title: 'Ata da Assembleia - Out/2024', category: 'Assembleias', description: 'Ata da assembleia geral ordinária de outubro', fileType: 'DOCX', fileSize: '856 KB', uploadedBy: 'u2', uploadedByName: 'Carlos Mendes', createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), version: '1.0', tags: ['ata', 'assembleia', '2024'] },
  { id: 'doc4', condoId: 'c1', title: 'Apólice de Seguro 2024', category: 'Seguros', description: 'Apólice de seguro patrimonial do condomínio', fileType: 'PDF', fileSize: '3.1 MB', uploadedBy: 'u2', uploadedByName: 'Carlos Mendes', createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), version: '1.0', tags: ['seguro', '2024'] },
];

let _accessLogs: AccessLog[] = [
  { id: 'acc1', condoId: 'c1', type: 'visitor', name: 'Roberto Alves', document: '123.456.789-00', destination: 'AP 202-B', purpose: 'Visita familiar', enteredAt: new Date(Date.now() - 3600000).toISOString(), authorizedBy: 'Pedro Costa', status: 'inside' },
  { id: 'acc2', condoId: 'c1', type: 'service', name: 'Carlos Eletricista', document: '987.654.321-00', destination: 'Área Comum', purpose: 'Manutenção elétrica', company: 'Eletro Serviços LTDA', enteredAt: new Date(Date.now() - 7200000).toISOString(), exitedAt: new Date(Date.now() - 3600000).toISOString(), status: 'exited' },
  { id: 'acc3', condoId: 'c1', type: 'visitor', name: 'Ana Paula', document: '555.666.777-88', destination: 'AP 101-A', purpose: 'Amiga', enteredAt: new Date(Date.now() - 86400000).toISOString(), exitedAt: new Date(Date.now() - 82800000).toISOString(), authorizedBy: 'Maria Silva', status: 'exited' },
];

let _lostFound: LostFound[] = [
  { id: 'lf1', condoId: 'c1', type: 'found', title: 'Chave com chaveiro azul', description: 'Encontrada no corredor do 2º andar', location: 'Corredor Bloco B - 2º Andar', category: 'Chaves', reportedBy: 'u3', reportedByName: 'João Porteiro', status: 'active', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'lf2', condoId: 'c1', type: 'lost', title: 'Óculos de grau - armação vermelha', description: 'Perdi meus óculos na área da piscina ou academia', location: 'Piscina / Academia', category: 'Acessórios', reportedBy: 'u4', reportedByName: 'Maria Silva', contactPhone: '(11) 99999-0004', status: 'active', createdAt: new Date(Date.now() - 3600000 * 5).toISOString() },
];

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 MÓDULO DE MANUTENÇÃO E CHAMADOS
// ═══════════════════════════════════════════════════════════════════════════
function syncMissingFeaturesState() {
  try {
    const state = getBackendState();
    _tickets = (state.maintenanceTickets as MaintenanceTicket[]) ?? _tickets;
    _documents = (state.documentsLibrary as Document[]) ?? _documents;
    _accessLogs = (state.accessControlLogs as AccessLog[]) ?? _accessLogs;
    _lostFound = (state.lostFoundItems as LostFound[]) ?? _lostFound;
  } catch {
    // Bootstrap ainda nao terminou.
  }
}

function persistMissingFeaturesState() {
  try {
    updateBackendState((state) => {
      state.maintenanceTickets = _tickets;
      state.documentsLibrary = _documents;
      state.accessControlLogs = _accessLogs;
      state.lostFoundItems = _lostFound;
    });
  } catch {
    // Ignora apenas durante a inicializacao.
  }
}

export function MaintenanceSection({ user }: { user: User }) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(() => { syncMissingFeaturesState(); return _tickets.filter(t => t.condoId === user.condoId); });
  const [tab, setTab] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [category, setCategory] = useState('Elétrica');

  const canManage = user.role === 'sindico' || user.role === 'admin';
  const categories = ['Elétrica', 'Hidráulica', 'Estrutural', 'Portão/Acesso', 'Elevador', 'Pintura', 'Limpeza', 'Paisagismo', 'Outro'];

  const priorityConfig = {
    low: { label: '🟢 Baixa', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    medium: { label: '🟡 Média', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    high: { label: '🟠 Alta', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    urgent: { label: '🔴 Urgente', color: 'bg-red-100 text-red-700 border-red-200' },
  };

  const statusConfig = {
    open: { label: '📋 Aberto', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: '🔧 Em Andamento', color: 'bg-amber-100 text-amber-700' },
    resolved: { label: '✅ Resolvido', color: 'bg-emerald-100 text-emerald-700' },
    closed: { label: '🔒 Fechado', color: 'bg-gray-100 text-gray-600' },
  };

  const refreshTickets = () => { syncMissingFeaturesState(); setTickets([..._tickets.filter(t => t.condoId === user.condoId)]); };

  const save = () => {
    if (!title.trim() || !desc.trim() || !location.trim()) return;
    const newTicket: MaintenanceTicket = {
      id: 'tkt' + uid(), condoId: user.condoId!, title, description: desc, location,
      priority, status: 'open', category, reportedBy: user.id, reportedByName: user.name,
      photos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    _tickets = [..._tickets, newTicket];
    persistMissingFeaturesState();
    refreshTickets();
    setTitle(''); setDesc(''); setLocation(''); setPriority('medium'); setCategory('Elétrica');
    setShowForm(false);
  };

  const updateStatus = (id: string, status: MaintenanceTicket['status']) => {
    _tickets = _tickets.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString(), resolvedAt: status === 'resolved' ? new Date().toISOString() : t.resolvedAt } : t);
    persistMissingFeaturesState();
    refreshTickets();
    if (selectedTicket?.id === id) setSelectedTicket(prev => prev ? { ...prev, status } : null);
  };

  const filtered = tickets.filter(t => tab === 'all' || t.status === tab);
  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: tickets.length, icon: '🔧', color: 'from-blue-500 to-blue-600' },
          { label: 'Abertos', value: counts.open, icon: '📋', color: 'from-amber-500 to-orange-500' },
          { label: 'Em Andamento', value: counts.in_progress, icon: '⚙️', color: 'from-purple-500 to-violet-600' },
          { label: 'Resolvidos', value: counts.resolved, icon: '✅', color: 'from-emerald-500 to-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:shadow-md transition-all">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl shadow-sm`}>{s.icon}</div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className="text-2xl font-black text-gray-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Botão */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          {(['all', 'open', 'in_progress', 'resolved'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'all' ? `📋 Todos (${counts.all})` : t === 'open' ? `📂 Abertos (${counts.open})` : t === 'in_progress' ? `⚙️ Andamento (${counts.in_progress})` : `✅ Resolvidos (${counts.resolved})`}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-sm shadow hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2">
          🔧 Abrir Chamado
        </button>
      </div>

      {/* Lista de chamados */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-3">🔧</div>
            <p className="font-medium">Nenhum chamado encontrado</p>
          </div>
        )}
        {filtered.map((ticket, i) => (
          <div key={ticket.id} style={{ animationDelay: `${i * 60}ms` }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer"
            onClick={() => setSelectedTicket(ticket)}>
            <div className={`h-1 ${ticket.priority === 'urgent' ? 'bg-red-500' : ticket.priority === 'high' ? 'bg-orange-500' : ticket.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${priorityConfig[ticket.priority].color}`}>
                      {priorityConfig[ticket.priority].label}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${statusConfig[ticket.status].color}`}>
                      {statusConfig[ticket.status].label}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                      {ticket.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800">{ticket.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                </div>
                {canManage && (
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {ticket.status === 'open' && (
                      <button onClick={() => updateStatus(ticket.id, 'in_progress')}
                        className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors">
                        ⚙️ Iniciar
                      </button>
                    )}
                    {ticket.status === 'in_progress' && (
                      <button onClick={() => updateStatus(ticket.id, 'resolved')}
                        className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors">
                        ✅ Resolver
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>📍 {ticket.location}</span>
                <span>👤 {ticket.reportedByName}</span>
                <span>📅 {fmtDate(ticket.createdAt)}</span>
                {ticket.assignedTo && <span className="text-indigo-500 font-medium">🔧 {ticket.assignedTo}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Novo Chamado */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'slideUp 0.25s ease-out' }}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">🔧 Abrir Chamado de Manutenção</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Título do Problema *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Lâmpada queimada no corredor..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Categoria</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm">
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Prioridade</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm">
                    <option value="low">🟢 Baixa</option>
                    <option value="medium">🟡 Média</option>
                    <option value="high">🟠 Alta</option>
                    <option value="urgent">🔴 Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Local *</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Bloco A - 3º Andar, Piscina..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Descrição detalhada *</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Descreva o problema com detalhes..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm shadow hover:shadow-md transition-all">
                  🔧 Abrir Chamado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalhe do Chamado */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'slideUp 0.25s ease-out' }} onClick={e => e.stopPropagation()}>
            <div className={`h-2 ${selectedTicket.priority === 'urgent' ? 'bg-red-500' : selectedTicket.priority === 'high' ? 'bg-orange-500' : selectedTicket.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Detalhes do Chamado</h3>
              <button onClick={() => setSelectedTicket(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${priorityConfig[selectedTicket.priority].color}`}>
                  {priorityConfig[selectedTicket.priority].label}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig[selectedTicket.status].color}`}>
                  {statusConfig[selectedTicket.status].label}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{selectedTicket.category}</span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">{selectedTicket.title}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{selectedTicket.description}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '📍', label: 'Local', value: selectedTicket.location },
                  { icon: '👤', label: 'Reportado por', value: selectedTicket.reportedByName },
                  { icon: '📅', label: 'Aberto em', value: fmtDate(selectedTicket.createdAt) },
                  { icon: '🔧', label: 'Responsável', value: selectedTicket.assignedTo || 'Não atribuído' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">{item.icon} {item.label}</p>
                    <p className="text-sm font-bold text-gray-700 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              {canManage && (
                <div className="flex gap-2 pt-2">
                  {selectedTicket.status === 'open' && (
                    <button onClick={() => updateStatus(selectedTicket.id, 'in_progress')}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors">
                      ⚙️ Iniciar Manutenção
                    </button>
                  )}
                  {selectedTicket.status === 'in_progress' && (
                    <button onClick={() => { updateStatus(selectedTicket.id, 'resolved'); setSelectedTicket(null); }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors">
                      ✅ Marcar como Resolvido
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 📁 MÓDULO DE DOCUMENTOS DIGITAIS
// ═══════════════════════════════════════════════════════════════════════════
export function DocumentsSection({ user }: { user: User }) {
  const [docs, setDocs] = useState<Document[]>(() => { syncMissingFeaturesState(); return _documents.filter(d => d.condoId === user.condoId); });
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Jurídico');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [fileType, setFileType] = useState('PDF');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = user.role === 'sindico' || user.role === 'admin';
  const categories = ['Jurídico', 'Regras', 'Assembleias', 'Seguros', 'Contratos', 'Financeiro', 'Plantas', 'Outro'];
  const fileTypes = ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG', 'ZIP'];

  const catIcons: Record<string, string> = {
    'Jurídico': '⚖️', 'Regras': '📋', 'Assembleias': '🏛️', 'Seguros': '🛡️',
    'Contratos': '📝', 'Financeiro': '💰', 'Plantas': '🗺️', 'Outro': '📄'
  };

  const refreshDocs = () => { syncMissingFeaturesState(); setDocs([..._documents.filter(d => d.condoId === user.condoId)]); };

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    const ext = file.name.split('.').pop()?.toUpperCase() || '';
    if (fileTypes.includes(ext)) {
      setFileType(ext);
    }
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  }, [title]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const save = async () => {
    if (!title.trim()) return;
    setUploading(true);

    let fileSize = `${(Math.random() * 4 + 0.5).toFixed(1)} MB`;
    let fileUrl: string | undefined;

    // Fazer upload real se houver arquivo selecionado
    if (selectedFile) {
      fileSize = formatFileSize(selectedFile.size);
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('authToken');
        const formData = new FormData();
        formData.append('file', selectedFile);

        const res = await fetch(`/api/uploads/upload/documents`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          fileUrl = data.url || data.path;
        }
      } catch (err) {
        console.error('Erro no upload:', err);
      }
    }

    const newDoc: Document = {
      id: 'doc' + uid(), condoId: user.condoId!, title, category, description,
      fileType, fileSize,
      uploadedBy: user.id, uploadedByName: user.name,
      createdAt: new Date().toISOString(), version: '1.0',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean)
    };
    _documents = [..._documents, newDoc];
    persistMissingFeaturesState();
    refreshDocs();
    setTitle(''); setCategory('Jurídico'); setDescription(''); setTags(''); setFileType('PDF'); setSelectedFile(null);
    setShowForm(false);
    setUploading(false);
  };

  const deleteDoc = (id: string) => {
    _documents = _documents.filter(d => d.id !== id);
    persistMissingFeaturesState();
    refreshDocs();
  };

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.description.toLowerCase().includes(search.toLowerCase()) || d.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCat === 'all' || d.category === filterCat;
    return matchSearch && matchCat;
  });

  const catCounts = categories.reduce((acc, cat) => ({ ...acc, [cat]: docs.filter(d => d.category === cat).length }), {} as Record<string, number>);

  return (
    <div className="space-y-5">
      {/* Stats por categoria */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de Docs', value: docs.length, icon: '📁', color: 'from-blue-500 to-blue-600' },
          { label: 'Jurídicos', value: catCounts['Jurídico'] || 0, icon: '⚖️', color: 'from-purple-500 to-violet-600' },
          { label: 'Assembleias', value: catCounts['Assembleias'] || 0, icon: '🏛️', color: 'from-indigo-500 to-blue-600' },
          { label: 'Seguros', value: catCounts['Seguros'] || 0, icon: '🛡️', color: 'from-emerald-500 to-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl shadow-sm`}>{s.icon}</div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-black text-gray-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de busca + filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documentos..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
          <option value="all">📁 Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{catIcons[c]} {c}</option>)}
        </select>
        {canManage && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-sm shadow hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2 whitespace-nowrap">
            📤 Upload Documento
          </button>
        )}
      </div>

      {/* Grid de documentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-medium">Nenhum documento encontrado</p>
          </div>
        )}
        {filtered.map((doc, i) => (
          <div key={doc.id} style={{ animationDelay: `${i * 60}ms` }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
            {/* Header colorido */}
            <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-5 relative">
              <div className="absolute top-3 right-3">
                <span className="px-2 py-1 bg-white/20 text-white text-xs font-bold rounded-lg">{doc.fileType}</span>
              </div>
              <div className="text-4xl mb-3">{catIcons[doc.category] || '📄'}</div>
              <h3 className="font-bold text-white text-sm leading-tight">{doc.title}</h3>
              <p className="text-white/50 text-xs mt-1">{doc.category}</p>
            </div>
            <div className="p-4">
              {doc.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{doc.description}</p>}
              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>📅 {fmtDate(doc.createdAt)}</span>
                <span>💾 {doc.fileSize}</span>
                <span>v{doc.version}</span>
              </div>
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {doc.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full font-medium">#{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1">
                  👁️ Visualizar
                </button>
                <button className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1">
                  ⬇️ Baixar
                </button>
                {canManage && (
                  <button onClick={() => { if (confirm('Excluir documento?')) deleteDoc(doc.id); }}
                    className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors">
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Upload */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'slideUp 0.25s ease-out' }}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">📤 Upload de Documento</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Área de upload funcional */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.zip"
                className="hidden"
                onChange={handleFileInput}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50 scale-[1.02]'
                    : selectedFile
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-indigo-200 bg-indigo-50 hover:border-indigo-400'
                }`}
              >
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="text-3xl">✅</div>
                    <p className="font-semibold text-emerald-700">{selectedFile.name}</p>
                    <p className="text-sm text-emerald-600">{formatFileSize(selectedFile.size)}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Remover arquivo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📤</div>
                    <p className="font-semibold text-indigo-700">Arraste o arquivo aqui</p>
                    <p className="text-sm text-indigo-500 mt-1">ou clique para selecionar</p>
                    <p className="text-xs text-gray-400 mt-2">PDF, DOCX, XLSX, JPG, PNG, ZIP (máx. 20MB)</p>
                  </>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Título *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do documento..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Categoria</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400">
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Tipo de Arquivo</label>
                  <select value={fileType} onChange={e => setFileType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400">
                    {fileTypes.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Descrição</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Breve descrição..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Tags (separadas por vírgula)</label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="convenção, regras, 2024..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setSelectedFile(null); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={save} disabled={!title.trim() || uploading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm shadow hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {uploading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : '📤 Fazer Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚗 CONTROLE DE ACESSO / VISITANTES (Porteiro)
// ═══════════════════════════════════════════════════════════════════════════
export function AccessControlSection({ user }: { user: User }) {
  const [logs, setLogs] = useState<AccessLog[]>(() => { syncMissingFeaturesState(); return _accessLogs.filter(a => a.condoId === user.condoId); });
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'all' | 'inside' | 'exited'>('all');
  const [type, setType] = useState<'visitor' | 'service' | 'delivery' | 'resident'>('visitor');
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [company, setCompany] = useState('');

  const store = useStore();
  const residents = store.getUsersByCondoId(user.condoId!).filter(u => u.role === 'morador');

  const refreshLogs = () => { syncMissingFeaturesState(); setLogs([..._accessLogs.filter(a => a.condoId === user.condoId)]); };

  const typeConfig = {
    visitor: { label: '👤 Visitante', color: 'bg-blue-100 text-blue-700', icon: '👤' },
    service: { label: '🔧 Serviço', color: 'bg-purple-100 text-purple-700', icon: '🔧' },
    delivery: { label: '📦 Entrega', color: 'bg-amber-100 text-amber-700', icon: '📦' },
    resident: { label: '🏠 Morador', color: 'bg-emerald-100 text-emerald-700', icon: '🏠' },
  };

  const save = () => {
    if (!name.trim() || !destination.trim()) return;
    const newLog: AccessLog = {
      id: 'acc' + uid(), condoId: user.condoId!, type, name, document: document || undefined,
      destination, purpose, vehiclePlate: vehiclePlate || undefined, company: company || undefined,
      enteredAt: new Date().toISOString(), status: 'inside'
    };
    _accessLogs = [..._accessLogs, newLog];
    persistMissingFeaturesState();
    refreshLogs();
    setName(''); setDocument(''); setDestination(''); setPurpose(''); setVehiclePlate(''); setCompany('');
    setShowForm(false);
  };

  const registerExit = (id: string) => {
    _accessLogs = _accessLogs.map(a => a.id === id ? { ...a, status: 'exited', exitedAt: new Date().toISOString() } : a);
    persistMissingFeaturesState();
    refreshLogs();
  };

  const filtered = logs.filter(a => tab === 'all' || a.status === tab);
  const inside = logs.filter(a => a.status === 'inside').length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'No Condomínio', value: inside, icon: '🟢', color: 'from-emerald-500 to-green-600' },
          { label: 'Visitantes Hoje', value: logs.filter(a => a.enteredAt.startsWith(new Date().toISOString().split('T')[0])).length, icon: '👤', color: 'from-blue-500 to-blue-600' },
          { label: 'Prestadores', value: logs.filter(a => a.type === 'service').length, icon: '🔧', color: 'from-purple-500 to-violet-600' },
          { label: 'Total Registros', value: logs.length, icon: '📋', color: 'from-slate-500 to-slate-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl shadow-sm`}>{s.icon}</div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-black text-gray-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta: pessoas no condomínio */}
      {inside > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-xl text-white flex-shrink-0">🏠</div>
          <div>
            <p className="font-bold text-emerald-800">{inside} pessoa{inside > 1 ? 's' : ''} no condomínio agora</p>
            <p className="text-sm text-emerald-600">Visitantes e prestadores que ainda não registraram saída</p>
          </div>
        </div>
      )}

      {/* Filtros + Botão */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([['all', '📋 Todos'], ['inside', '🟢 No Condo'], ['exited', '🔴 Saíram']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setTab(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === val ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-sm shadow hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2">
          ➕ Registrar Entrada
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-3">🚪</div>
            <p className="font-medium">Nenhum registro encontrado</p>
          </div>
        )}
        {filtered.slice().reverse().map((log, i) => (
          <div key={log.id} style={{ animationDelay: `${i * 50}ms` }}
            className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${log.status === 'inside' ? 'border-emerald-200' : 'border-gray-100'}`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${typeConfig[log.type].color}`}>
                    {typeConfig[log.type].icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-gray-800">{log.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeConfig[log.type].color}`}>
                        {typeConfig[log.type].label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${log.status === 'inside' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {log.status === 'inside' ? '🟢 Dentro' : '🔴 Saiu'}
                      </span>
                    </div>
                    {log.document && <p className="text-xs text-gray-500">📄 {log.document}</p>}
                    {log.company && <p className="text-xs text-purple-600 font-medium">🏢 {log.company}</p>}
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                      <span>🏠 {log.destination}</span>
                      {log.purpose && <span>💬 {log.purpose}</span>}
                      {log.vehiclePlate && <span>🚗 {log.vehiclePlate}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span>⬆️ Entrada: {new Date(log.enteredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {log.exitedAt && <span>⬇️ Saída: {new Date(log.exitedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                </div>
                {log.status === 'inside' && (
                  <button onClick={() => registerExit(log.id)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-xl hover:bg-red-200 transition-colors flex-shrink-0">
                    🚪 Registrar Saída
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Registrar Entrada */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'slideUp 0.25s ease-out' }}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">🚪 Registrar Entrada</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Tipo de Entrada</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <button key={key} onClick={() => setType(key as typeof type)}
                      className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${type === key ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Nome Completo *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do visitante..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">CPF / RG</label>
                  <input value={document} onChange={e => setDocument(e.target.value)} placeholder="000.000.000-00"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Placa do Veículo</label>
                  <input value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} placeholder="ABC-1234"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              {type === 'service' && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Empresa</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Nome da empresa..."
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Destino *</label>
                <select value={destination} onChange={e => setDestination(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400">
                  <option value="">Selecionar destino...</option>
                  <option value="Área Comum">Área Comum</option>
                  <option value="Administração">Administração</option>
                  {residents.filter(r => r.unit).map(r => (
                    <option key={r.id} value={`AP ${r.unit}`}>{r.unit} - {r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Motivo da Visita</label>
                <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Visita familiar, manutenção, entrega..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm shadow hover:shadow-md transition-all">
                  ✅ Registrar Entrada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔎 ACHADOS E PERDIDOS
// ═══════════════════════════════════════════════════════════════════════════
export function LostFoundSection({ user }: { user: User }) {
  const [items, setItems] = useState<LostFound[]>(() => { syncMissingFeaturesState(); return _lostFound.filter(l => l.condoId === user.condoId); });
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [type, setType] = useState<'lost' | 'found'>('found');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Chaves');
  const [contactPhone, setContactPhone] = useState('');

  const categories = ['Chaves', 'Documentos', 'Eletrônicos', 'Roupas', 'Acessórios', 'Animais', 'Outro'];

  const refreshItems = () => { syncMissingFeaturesState(); setItems([..._lostFound.filter(l => l.condoId === user.condoId)]); };

  const save = () => {
    if (!title.trim() || !location.trim()) return;
    const newItem: LostFound = {
      id: 'lf' + uid(), condoId: user.condoId!, type, title, description, location, category,
      reportedBy: user.id, reportedByName: user.name,
      contactPhone: contactPhone || undefined, status: 'active',
      createdAt: new Date().toISOString()
    };
    _lostFound = [..._lostFound, newItem];
    persistMissingFeaturesState();
    refreshItems();
    setTitle(''); setDescription(''); setLocation(''); setCategory('Chaves'); setContactPhone('');
    setShowForm(false);
  };

  const markResolved = (id: string) => {
    _lostFound = _lostFound.map(l => l.id === id ? { ...l, status: 'resolved' } : l);
    persistMissingFeaturesState();
    refreshItems();
  };

  const filtered = items.filter(l => (filter === 'all' || l.type === filter) && l.status === 'active');
  const resolved = items.filter(l => l.status === 'resolved');

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl mb-1">🔍</div>
          <p className="text-2xl font-black text-gray-800">{items.filter(l => l.type === 'lost' && l.status === 'active').length}</p>
          <p className="text-xs text-gray-500">Perdidos</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl mb-1">✨</div>
          <p className="text-2xl font-black text-gray-800">{items.filter(l => l.type === 'found' && l.status === 'active').length}</p>
          <p className="text-xs text-gray-500">Encontrados</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl mb-1">✅</div>
          <p className="text-2xl font-black text-gray-800">{resolved.length}</p>
          <p className="text-xs text-gray-500">Resolvidos</p>
        </div>
      </div>

      {/* Filtros + Botão */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([['all', '📋 Todos'], ['lost', '🔍 Perdidos'], ['found', '✨ Encontrados']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === val ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-sm shadow hover:shadow-md hover:-translate-y-0.5 transition-all">
          ➕ Reportar Item
        </button>
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-3">🔍</div>
            <p className="font-medium">Nenhum item encontrado</p>
          </div>
        )}
        {filtered.map((item) => (
          <div key={item.id}
            className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition-all overflow-hidden ${item.type === 'lost' ? 'border-red-200' : 'border-emerald-200'}`}>
            <div className={`px-4 py-2 flex items-center justify-between ${item.type === 'lost' ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <span className={`text-sm font-bold ${item.type === 'lost' ? 'text-red-700' : 'text-emerald-700'}`}>
                {item.type === 'lost' ? '🔍 PERDIDO' : '✨ ENCONTRADO'}
              </span>
              <span className="text-xs text-gray-500">{fmtDate(item.createdAt)}</span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-gray-800">{item.title}</h3>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium flex-shrink-0">{item.category}</span>
              </div>
              {item.description && <p className="text-sm text-gray-500 mb-2">{item.description}</p>}
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                <span>📍 {item.location}</span>
                {item.contactPhone && <span>📞 {item.contactPhone}</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Reportado por: {item.reportedByName}</span>
                <button onClick={() => markResolved(item.id)}
                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-200 transition-colors">
                  ✅ Resolvido
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Reportar */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'slideUp 0.25s ease-out' }}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">🔍 Reportar Item</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setType('lost')}
                  className={`p-4 rounded-2xl border-2 text-center transition-all ${type === 'lost' ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-3xl mb-1">🔍</div>
                  <p className={`font-bold text-sm ${type === 'lost' ? 'text-red-700' : 'text-gray-600'}`}>Perdi um item</p>
                </button>
                <button onClick={() => setType('found')}
                  className={`p-4 rounded-2xl border-2 text-center transition-all ${type === 'found' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-3xl mb-1">✨</div>
                  <p className={`font-bold text-sm ${type === 'found' ? 'text-emerald-700' : 'text-gray-600'}`}>Encontrei um item</p>
                </button>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Título do Item *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Chave com chaveiro azul..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Categoria</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400">
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Telefone de contato</label>
                  <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(11) 99999-0000"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Local *</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Onde perdeu ou encontrou..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Descrição</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Descreva o item com detalhes..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm shadow hover:shadow-md transition-all">
                  ✅ Reportar Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 RELATÓRIOS E ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════
export function ReportsSection({ user }: { user: User }) {
  const store = useStore();
  const condoName = store.getCondos().find(c => c.id === user.condoId)?.name || 'Condomínio';
  const invoices = store.getInvoices(user.condoId);
  const deliveries = store.getDeliveries(user.condoId);
  const complaints = store.getComplaints(user.condoId);
  const reservations = store.getReservations(user.condoId);
  const votes = store.getVotes(user.condoId);
  const users = store.getUsersByCondoId(user.condoId!);

  const totalReceived = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const inadimplencia = invoices.length > 0 ? Math.round(((invoices.filter(i => i.status !== 'paid').length) / invoices.length) * 100) : 0;

  const monthData = useMemo(() => {
    const months: Array<{ key: string; month: string; received: number; pending: number }> = [];
    const now = new Date();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const refDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabelRaw = refDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);
      months.push({ key, month: monthLabel, received: 0, pending: 0 });
    }

    const monthMap = new Map(months.map((item) => [item.key, item]));

    invoices.forEach((invoice) => {
      const sourceDate = invoice.paidAt || invoice.dueDate || invoice.createdAt;
      const refDate = new Date(sourceDate);
      if (Number.isNaN(refDate.getTime())) return;

      const key = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthMap.get(key);
      if (!bucket) return;

      if (invoice.status === 'paid') {
        bucket.received += invoice.amount;
      } else {
        bucket.pending += invoice.amount;
      }
    });

    return months;
  }, [invoices]);

  const maxVal = Math.max(1, ...monthData.map(d => d.received + d.pending));
  const reportDate = new Date();
  const reportDateIso = reportDate.toISOString().split('T')[0];
  const reportDateLabel = reportDate.toLocaleString('pt-BR');

  const invoiceStatusLabel = (status: string) => {
    if (status === 'paid') return 'Pago';
    if (status === 'pending') return 'Pendente';
    if (status === 'overdue') return 'Vencido';
    return status;
  };
  const deliveryStatusLabel = (status: string) => status === 'waiting' ? 'Aguardando' : status === 'delivered' ? 'Entregue' : status;
  const complaintStatusLabel = (status: string) => status === 'pending' ? 'Pendente' : status === 'read' ? 'Em análise' : status === 'resolved' ? 'Resolvida' : status;
  const complaintUrgencyLabel = (urgency: string) => urgency === 'critical' ? 'Crítica' : urgency === 'high' ? 'Alta' : urgency === 'medium' ? 'Média' : urgency === 'low' ? 'Baixa' : urgency;

  const exportExcel = () => {
    const rows: Array<Array<unknown>> = [
      ['RELATÓRIO CONSOLIDADO - INOVATECH CONNECT'],
      ['Condomínio', condoName],
      ['Gerado em', reportDateLabel],
      [],
      ['KPIs', 'Valor'],
      ['Recebido', totalReceived],
      ['Pendente', totalPending],
      ['Vencido', totalOverdue],
      ['Inadimplência (%)', inadimplencia],
      [],
      ['COBRANÇAS'],
      ['Morador', 'Unidade', 'Descrição', 'Valor', 'Vencimento', 'Status', 'Pago em'],
      ...(invoices.length > 0
        ? invoices.map(i => [i.userName, i.unit, i.description, i.amount, fmtDate(i.dueDate), invoiceStatusLabel(i.status), i.paidAt ? fmtDate(i.paidAt) : '-'])
        : [['Sem registros', '', '', '', '', '', '']]),
      [],
      ['ENCOMENDAS'],
      ['Morador', 'Unidade', 'Remetente', 'Descrição', 'Chegada', 'Status'],
      ...(deliveries.length > 0
        ? deliveries.map(d => [d.residentName, d.unit, d.sender, d.description, fmtDate(d.arrivedAt), deliveryStatusLabel(d.status)])
        : [['Sem registros', '', '', '', '', '']]),
      [],
      ['DENÚNCIAS'],
      ['Categoria', 'Descrição', 'Local', 'Urgência', 'Status', 'Data'],
      ...(complaints.length > 0
        ? complaints.map(c => [c.category, c.description, c.location, complaintUrgencyLabel(c.urgency), complaintStatusLabel(c.status), fmtDate(c.createdAt)])
        : [['Sem registros', '', '', '', '', '']]),
      [],
      ['RESERVAS'],
      ['Área', 'Morador', 'Unidade', 'Data', 'Horário', 'Valor', 'Status'],
      ...(reservations.length > 0
        ? reservations.map(r => [r.areaName, r.userName, r.unit, fmtDate(r.date), `${r.startTime} - ${r.endTime}`, r.totalCost, r.status])
        : [['Sem registros', '', '', '', '', '', '']]),
      [],
      ['VOTAÇÕES'],
      ['Título', 'Status', 'Encerramento', 'Total de votos'],
      ...(votes.length > 0
        ? votes.map(v => [v.title, v.status === 'open' ? 'Em aberto' : 'Encerrada', fmtDate(v.endDate), v.options.reduce((sum, opt) => sum + opt.votes.length, 0)])
        : [['Sem registros', '', '', '']]),
      [],
      ['RECEITAS X PENDÊNCIAS (6 MESES)'],
      ['Mês', 'Recebido', 'Pendente'],
      ...monthData.map(d => [d.month, d.received, d.pending]),
    ];

    downloadTextFile(`relatorio-sindico-${reportDateIso}.csv`, csvContent(rows), 'text/csv;charset=utf-8;');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const fileName = `relatorio-sindico-${reportDateIso}.pdf`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Relatorio Consolidado - INOVATECH CONNECT', 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Condominio: ${condoName}`, 14, 22);
    doc.text(`Gerado em: ${reportDateLabel}`, 14, 27);

    autoTable(doc, {
      startY: 31,
      head: [['KPI', 'Valor']],
      body: [
        ['Recebido', fmtMoney(totalReceived)],
        ['Pendente', fmtMoney(totalPending)],
        ['Vencido', fmtMoney(totalOverdue)],
        ['Inadimplencia', `${inadimplencia}%`]
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: 14, right: 14 }
    });

    let cursorY = getPdfLastY(doc) + 6;
    const emptyRow = (columns: number) => ['Sem registros', ...Array(Math.max(0, columns - 1)).fill('')];

    const addSection = (title: string, head: string[], body: string[][]) => {
      if (cursorY > 250) {
        doc.addPage();
        cursorY = 16;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(title, 14, cursorY);

      autoTable(doc, {
        startY: cursorY + 2,
        head: [head],
        body: body.length > 0 ? body : [emptyRow(head.length)],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.4 },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: 14, right: 14 }
      });

      cursorY = getPdfLastY(doc) + 6;
    };

    addSection('Cobrancas', ['Morador', 'Unidade', 'Descricao', 'Valor', 'Vencimento', 'Status'], invoices.map(i => [
      i.userName,
      i.unit,
      i.description,
      fmtMoney(i.amount),
      fmtDate(i.dueDate),
      invoiceStatusLabel(i.status)
    ]));

    addSection('Encomendas', ['Morador', 'Unidade', 'Remetente', 'Descricao', 'Chegada', 'Status'], deliveries.map(d => [
      d.residentName,
      d.unit,
      d.sender,
      d.description,
      fmtDate(d.arrivedAt),
      deliveryStatusLabel(d.status)
    ]));

    addSection('Denuncias', ['Categoria', 'Descricao', 'Local', 'Urgencia', 'Status', 'Data'], complaints.map(c => [
      c.category,
      c.description,
      c.location,
      complaintUrgencyLabel(c.urgency),
      complaintStatusLabel(c.status),
      fmtDate(c.createdAt)
    ]));

    addSection('Reservas', ['Area', 'Morador', 'Unidade', 'Data', 'Horario', 'Valor', 'Status'], reservations.map(r => [
      r.areaName,
      r.userName,
      r.unit,
      fmtDate(r.date),
      `${r.startTime} - ${r.endTime}`,
      fmtMoney(r.totalCost),
      r.status === 'confirmed' ? 'Confirmada' : r.status === 'cancelled' ? 'Cancelada' : r.status
    ]));

    addSection('Votacoes', ['Titulo', 'Status', 'Encerramento', 'Total de votos'], votes.map(v => [
      v.title,
      v.status === 'open' ? 'Em aberto' : 'Encerrada',
      fmtDate(v.endDate),
      String(v.options.reduce((sum, opt) => sum + opt.votes.length, 0))
    ]));

    addSection('Receitas x Pendencias (6 meses)', ['Mes', 'Recebido', 'Pendente'], monthData.map(d => [
      d.month,
      fmtMoney(d.received),
      fmtMoney(d.pending)
    ]));

    doc.save(fileName);
  };

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: '✅', label: 'Recebido', value: fmtMoney(totalReceived), color: 'from-emerald-500 to-green-600', sub: `${invoices.filter(i => i.status === 'paid').length} cobranças` },
          { icon: '⏳', label: 'Pendente', value: fmtMoney(totalPending), color: 'from-amber-500 to-orange-500', sub: `${invoices.filter(i => i.status === 'pending').length} cobranças` },
          { icon: '❌', label: 'Vencido', value: fmtMoney(totalOverdue), color: 'from-red-500 to-rose-600', sub: `${invoices.filter(i => i.status === 'overdue').length} cobranças` },
          { icon: '📊', label: 'Inadimplência', value: `${inadimplencia}%`, color: 'from-purple-500 to-violet-600', sub: 'das unidades' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl shadow mb-3`}>{s.icon}</div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-black text-gray-800 mt-0.5">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de Receitas por Mês */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-sm">📈</span>
            Receitas x Pendências (6 meses)
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" /><span className="text-gray-500">Recebido</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400" /><span className="text-gray-500">Pendente</span></div>
          </div>
        </div>
        <div className="flex items-end gap-3 h-40">
          {monthData.map(d => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col gap-0.5" style={{ height: '120px', justifyContent: 'flex-end' }}>
                <div className="w-full bg-amber-400 rounded-t" style={{ height: `${(d.pending / maxVal) * 120}px`, minHeight: '4px' }} />
                <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${(d.received / maxVal) * 120}px`, minHeight: '8px' }} />
              </div>
              <span className="text-xs text-gray-500 font-medium">{d.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid de Stats Secundários */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Encomendas */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><span>📦</span> Encomendas</h3>
          <div className="space-y-3">
            {[
              { label: 'Total recebidas', value: deliveries.length, color: 'text-gray-800' },
              { label: 'Aguardando retirada', value: deliveries.filter(d => d.status === 'waiting').length, color: 'text-amber-600' },
              { label: 'Entregues', value: deliveries.filter(d => d.status === 'delivered').length, color: 'text-emerald-600' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className={`font-black text-lg ${item.color}`}>{item.value}</span>
              </div>
            ))}
            {/* Barra de progresso entregues */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Taxa de entrega</span>
                <span>{deliveries.length > 0 ? Math.round((deliveries.filter(d => d.status === 'delivered').length / deliveries.length) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${deliveries.length > 0 ? (deliveries.filter(d => d.status === 'delivered').length / deliveries.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Denúncias */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><span>⚠️</span> Denúncias</h3>
          <div className="space-y-3">
            {[
              { label: 'Total', value: complaints.length },
              { label: 'Pendentes', value: complaints.filter(c => c.status === 'pending').length },
              { label: 'Críticas', value: complaints.filter(c => c.urgency === 'critical').length },
              { label: 'Resolvidas', value: complaints.filter(c => c.status === 'resolved').length },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="font-black text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Usuários */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><span>👥</span> Usuários</h3>
          <div className="space-y-3">
            {[
              { label: 'Moradores', value: users.filter(u => u.role === 'morador').length, icon: '🏠', color: 'bg-emerald-100 text-emerald-700' },
              { label: 'Porteiros', value: users.filter(u => u.role === 'porteiro').length, icon: '🚪', color: 'bg-amber-100 text-amber-700' },
              { label: 'Síndico', value: users.filter(u => u.role === 'sindico').length, icon: '🏢', color: 'bg-blue-100 text-blue-700' },
              { label: 'Total Ativos', value: users.filter(u => u.active).length, icon: '✅', color: 'bg-purple-100 text-purple-700' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${item.color}`}>{item.icon}</span>
                  <span className="text-sm text-gray-500">{item.label}</span>
                </div>
                <span className="font-black text-gray-800 text-lg">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reservas e Votações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><span>📅</span> Reservas</h3>
          <div className="space-y-2">
            {[
              { label: 'Total de Reservas', value: reservations.length },
              { label: 'Confirmadas', value: reservations.filter(r => r.status === 'confirmed').length },
              { label: 'Canceladas', value: reservations.filter(r => r.status === 'cancelled').length },
              { label: 'Receita de Reservas', value: fmtMoney(reservations.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.totalCost, 0)) },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className="font-bold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><span>🗳️</span> Votações</h3>
          <div className="space-y-2">
            {[
              { label: 'Total de Votações', value: votes.length },
              { label: 'Em Aberto', value: votes.filter(v => v.status === 'open').length },
              { label: 'Encerradas', value: votes.filter(v => v.status === 'closed').length },
              { label: 'Total de Votos', value: votes.reduce((s, v) => s + v.options.reduce((os, o) => os + o.votes.length, 0), 0) },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className="font-bold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botão exportar */}
      <div className="flex justify-center gap-3 pb-4">
        <button onClick={exportPDF}
          className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold text-sm shadow hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2">
          📄 Exportar PDF
        </button>
        <button onClick={exportExcel}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold text-sm shadow hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2">
          📊 Exportar Excel
        </button>
      </div>
    </div>
  );
}


