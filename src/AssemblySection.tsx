import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from './types';
import type { CSSProperties } from 'react';
import { useTheme } from './ThemeContext';

type AssemblyStatus = 'draft' | 'open' | 'closed';
type QuorumType = 'simple' | 'two_thirds' | 'unanimity';
type VoteChoice = 'yes' | 'no' | 'abstain';

interface AssemblyItemStats {
  approved: boolean;
  eligibleVoters: number;
  totalVotes: number;
  yes: number;
  no: number;
  abstain: number;
  participationPercent: number;
  approvalPercent: number;
}

interface AssemblyItem {
  id: string;
  title: string;
  description: string;
  itemOrder: number;
  quorumType: QuorumType;
  status: 'open' | 'closed';
  myVote: VoteChoice | null;
  unitVoteLocked?: boolean;
  unitVoteBy?: {
    userId: string;
    name: string;
    unit: string | null;
    choice: VoteChoice;
    votedAt: string | null;
  } | null;
  stats: AssemblyItemStats;
}

interface Assembly {
  id: string;
  condoId: string;
  condoName: string | null;
  title: string;
  description: string;
  status: AssemblyStatus;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  votingWindowOpen: boolean;
  expired: boolean;
  itemCount: number;
  approvedItems: number;
  totalVotes: number;
  creator: { id: string; name: string; role: string } | null;
  items: AssemblyItem[];
}

interface AssemblyListResponse {
  assemblies: Assembly[];
}

interface AssemblyResponse {
  assembly: Assembly;
  notifiedResidents?: number;
}

interface AssemblyVoteResponse {
  success: boolean;
  choice: VoteChoice;
  assembly: Assembly;
}

interface AssemblyItemStatusResponse {
  success: boolean;
  itemId: string;
  status: 'open' | 'closed';
}

interface AssemblyMinutesResponse {
  assemblyId: string;
  generatedAt: string;
  minutesText: string;
}

interface CondoOption {
  id: string;
  name: string;
}

interface AgendaItemDraft {
  title: string;
  description: string;
  quorumType: QuorumType;
}

interface AssembliesRequestError extends Error {
  status?: number;
  retryAfterMs?: number;
}

function getAuthToken() {
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
}

function slugifyFilename(value: string) {
  return String(value || 'assembleia')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60) || 'assembleia';
}

function parseRetryAfterMs(value: string | null) {
  if (!value) return 60000;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber * 1000;
  }
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) {
    const diff = asDate.getTime() - Date.now();
    return diff > 0 ? diff : 60000;
  }
  return 60000;
}

async function assembliesRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    }
  });

  const raw = await response.text();
  let payload: unknown = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    let errorMessage =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: string }).error || 'Falha na requisicao')
        : typeof payload === 'string'
          ? payload
          : 'Falha na requisicao';
    const requestError = new Error(errorMessage) as AssembliesRequestError;
    requestError.status = response.status;
    if (response.status === 429) {
      requestError.retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      if (!errorMessage || /too many requests/i.test(errorMessage)) {
        errorMessage = 'Muitas requisicoes no momento. Aguarde alguns segundos.';
      }
      requestError.message = errorMessage;
    }
    throw requestError;
  }

  return payload as T;
}

function toDateTimeLocalInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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

function roleCanManage(role: string) {
  return ['sindico'].includes(String(role || '').toLowerCase());
}

function roleCanVote(role: string) {
  return ['morador'].includes(String(role || '').toLowerCase());
}

function statusMeta(status: AssemblyStatus) {
  if (status === 'open') {
    return {
      label: 'Aberta',
      chip: 'border-emerald-300 bg-emerald-50 text-emerald-700',
      panel: 'from-emerald-500 to-teal-500',
      soft: 'border-emerald-200 bg-emerald-50',
      accent: 'text-emerald-700'
    };
  }
  if (status === 'closed') {
    return {
      label: 'Encerrada',
      chip: 'border-slate-300 bg-slate-100 text-slate-700',
      panel: 'from-slate-700 to-slate-600',
      soft: 'border-slate-300 bg-slate-100',
      accent: 'text-slate-700'
    };
  }
  return {
    label: 'Rascunho',
    chip: 'border-amber-300 bg-amber-50 text-amber-700',
    panel: 'from-amber-500 to-orange-500',
    soft: 'border-amber-300 bg-amber-50',
    accent: 'text-amber-700'
  };
}

function quorumLabel(type: QuorumType) {
  if (type === 'two_thirds') return '2/3 dos aptos';
  if (type === 'unanimity') return 'Unanimidade';
  return 'Maioria simples';
}
function _countLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function voteChoiceLabel(choice: VoteChoice | null) {
  if (choice === 'yes') return 'SIM';
  if (choice === 'no') return 'NAO';
  if (choice === 'abstain') return 'ABSTENCAO';
  return 'NAO VOTOU';
}

function voteChoiceTone(choice: VoteChoice | null) {
  if (choice === 'yes') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (choice === 'no') return 'border-rose-300 bg-rose-50 text-rose-700';
  if (choice === 'abstain') return 'border-amber-300 bg-amber-50 text-amber-700';
  return 'border-slate-300 bg-slate-100 text-slate-600';
}

export function AssemblySection({ user }: { user: User }) {
  const canManage = roleCanManage(user.role);
  const canVote = roleCanVote(user.role);
  const { currentTheme } = useTheme();
  const isDarkTheme = currentTheme.id === 'dark' || currentTheme.id === 'blue';
  const accentStyle: CSSProperties = {
    background: 'var(--theme-accent, linear-gradient(135deg,#1e293b,#0ea5e9))',
    color: 'var(--theme-accent-text, #ffffff)'
  };
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | AssemblyStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [condos, setCondos] = useState<CondoOption[]>([]);
  const [selectedCondoId, setSelectedCondoId] = useState(user.condoId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => toDateTimeLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => toDateTimeLocalInput(new Date(Date.now() + 86400000 * 7)));
  const [createStatus, setCreateStatus] = useState<'open' | 'draft'>('open');
  const [agendaItems, setAgendaItems] = useState<AgendaItemDraft[]>([
    { title: '', description: '', quorumType: 'simple' }
  ]);
  const [actionAssemblyId, setActionAssemblyId] = useState<string | null>(null);
  const [minutesLoadingId, setMinutesLoadingId] = useState<string | null>(null);
  const [expandedAssembly, setExpandedAssembly] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const assembliesCooldownUntilRef = useRef<number>(0);
  const seenOpenAssembliesRef = useRef<Set<string>>(new Set());

  const summary = useMemo(() => {
    return {
      total: assemblies.length,
      open: assemblies.filter((assembly) => assembly.status === 'open').length,
      closed: assemblies.filter((assembly) => assembly.status === 'closed').length,
      votes: assemblies.reduce((sum, assembly) => sum + assembly.totalVotes, 0)
    };
  }, [assemblies]);

  const openAssembliesForResidents = useMemo(
    () => assemblies.filter((assembly) => assembly.status === 'open' && assembly.votingWindowOpen),
    [assemblies]
  );

  async function loadAssemblies(options?: { silent?: boolean; force?: boolean }) {
    const force = Boolean(options?.force);
    if (!force && Date.now() < assembliesCooldownUntilRef.current) return;
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== 'all') query.set('status', statusFilter);
      const data = await assembliesRequest<AssemblyListResponse>(`/api/assemblies?${query.toString()}`);
      setAssemblies(Array.isArray(data.assemblies) ? data.assemblies : []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (requestError) {
      const knownError = requestError as AssembliesRequestError;
      if (knownError?.status === 429) {
        const retryAfterMs = Math.max(knownError.retryAfterMs || 60000, 10000);
        assembliesCooldownUntilRef.current = Date.now() + retryAfterMs;
        const retryAt = new Date(assembliesCooldownUntilRef.current).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setError(`Muitas requisicoes no momento. Nova tentativa automatica as ${retryAt}.`);
      } else {
        setError(knownError instanceof Error ? knownError.message : 'Falha ao carregar assembleias');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    void loadAssemblies();
  }, [statusFilter]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadAssemblies({ silent: true });
    }, 60000);

    return () => window.clearInterval(interval);
  }, [statusFilter]);

  useEffect(() => {
    if (!canManage) return;
    if (user.condoId) {
      setSelectedCondoId(user.condoId);
      return;
    }

    const loadCondoOptions = async () => {
      try {
        const data = await assembliesRequest<CondoOption[]>('/api/condos');
        setCondos(Array.isArray(data) ? data : []);
      } catch {
        setCondos([]);
      }
    };

    void loadCondoOptions();
  }, [canManage, user.condoId]);

  useEffect(() => {
    if (!flash) return undefined;
    const timeout = window.setTimeout(() => setFlash(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    if (!canVote) return;
    const key = `assembly_seen_open:${user.id}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        seenOpenAssembliesRef.current = new Set(parsed.filter((id) => typeof id === 'string'));
      }
    } catch {
      seenOpenAssembliesRef.current = new Set();
    }
  }, [canVote, user.id]);

  useEffect(() => {
    if (!canVote || assemblies.length === 0) return;
    const seen = seenOpenAssembliesRef.current;
    const newlyOpened = assemblies.filter((assembly) => assembly.status === 'open' && !seen.has(assembly.id));
    if (newlyOpened.length === 0) return;

    newlyOpened.forEach((assembly) => seen.add(assembly.id));
    const key = `assembly_seen_open:${user.id}`;
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(seen).slice(-200)));
    } catch {
      // no-op
    }

    if (newlyOpened.length === 1) {
      setFlash(`Assembleia aberta pelo sindico: ${newlyOpened[0].title}`);
    } else {
      setFlash(`${newlyOpened.length} novas assembleias foram abertas pelo sindico.`);
    }
  }, [assemblies, canVote, user.id]);

  function focusAssembly(assemblyId: string) {
    setExpandedAssembly(assemblyId);
    const target = document.getElementById(`assembly-${assemblyId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function handleCreateAssembly() {
    const validItems = agendaItems.filter((item) => item.title.trim().length >= 3);
    if (title.trim().length < 6) {
      setError('Informe um titulo com ao menos 6 caracteres.');
      return;
    }
    if (validItems.length === 0) {
      setError('Adicione ao menos um item de pauta valido.');
      return;
    }
    if (!user.condoId && !selectedCondoId) {
      setError('Selecione o condominio da assembleia.');
      return;
    }
    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(endsAt);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      setError('Informe datas validas para inicio e fim.');
      return;
    }
    if (endsAtDate <= startsAtDate) {
      setError('A data final deve ser maior que a data inicial.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await assembliesRequest<AssemblyResponse>('/api/assemblies', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          condoId: user.condoId || selectedCondoId,
          startsAt: startsAtDate.toISOString(),
          endsAt: endsAtDate.toISOString(),
          status: createStatus,
          agendaItems: validItems
        })
      });

      setShowCreate(false);
      setTitle('');
      setDescription('');
      setSelectedCondoId(user.condoId || '');
      setStartsAt(toDateTimeLocalInput(new Date()));
      setEndsAt(toDateTimeLocalInput(new Date(Date.now() + 86400000 * 7)));
      setCreateStatus('open');
      setAgendaItems([{ title: '', description: '', quorumType: 'simple' }]);
      if (createStatus === 'open') {
        const notified = Number(response.notifiedResidents || 0);
        setFlash(
          notified > 0
            ? `Assembleia criada e aberta. ${notified} morador(es) notificado(s).`
            : 'Assembleia criada e aberta com sucesso.'
        );
      } else {
        setFlash('Assembleia criada em rascunho. Abra quando quiser.');
      }
      await loadAssemblies({ force: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar assembleia');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssemblyStatus(assemblyId: string, status: 'open' | 'closed') {
    setActionAssemblyId(assemblyId);
    setError(null);
    try {
      const response = await assembliesRequest<AssemblyResponse>(`/api/assemblies/${assemblyId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (status === 'closed') {
        setFlash('Assembleia encerrada.');
      } else {
        const notified = Number(response.notifiedResidents || 0);
        setFlash(
          notified > 0
            ? `Assembleia reaberta. ${notified} morador(es) notificado(s).`
            : 'Assembleia reaberta.'
        );
      }
      await loadAssemblies({ force: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar status');
    } finally {
      setActionAssemblyId(null);
    }
  }

  async function handleAgendaItemStatus(assemblyId: string, itemId: string, status: 'open' | 'closed') {
    setActionAssemblyId(assemblyId);
    setError(null);
    try {
      await assembliesRequest<AssemblyItemStatusResponse>(`/api/assemblies/${assemblyId}/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setFlash(status === 'closed' ? 'Pauta encerrada para votacao.' : 'Pauta reaberta para votacao.');
      await loadAssemblies({ force: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar pauta');
    } finally {
      setActionAssemblyId(null);
    }
  }

  async function handleVote(assemblyId: string, itemId: string, choice: VoteChoice) {
    setActionAssemblyId(assemblyId);
    setError(null);
    try {
      const response = await assembliesRequest<AssemblyVoteResponse>(`/api/assemblies/${assemblyId}/items/${itemId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ choice })
      });
      setAssemblies((current) =>
        current.map((assembly) => (assembly.id === assemblyId ? response.assembly : assembly))
      );
      setFlash('Voto registrado com sucesso.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao votar');
    } finally {
      setActionAssemblyId(null);
    }
  }

  async function handleDownloadMinutes(assemblyId: string, assemblyTitle: string) {
    setMinutesLoadingId(assemblyId);
    setError(null);
    try {
      const response = await assembliesRequest<AssemblyMinutesResponse>(`/api/assemblies/${assemblyId}/minutes`);
      const blob = new Blob([response.minutesText || ''], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ata-${slugifyFilename(assemblyTitle)}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setFlash('Ata gerada com sucesso.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao gerar ata');
    } finally {
      setMinutesLoadingId(null);
    }
  }

  // --- COMPONENTES AUXILIARES ------------------------------------------------
  
  function StatCard({ icon, label, value, gradient }: { icon: string; label: string; value: number | string; gradient: string }) {
    return (
      <div className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-2.5 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}>
        <div className="absolute -right-3 -top-3 h-12 w-12 rounded-full bg-white/10 blur-lg transition-all group-hover:scale-125" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{label}</p>
              <p className="text-lg font-black text-white">{value}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function VoteProgressBar({ yes, no, abstain, total }: { yes: number; no: number; abstain: number; total: number }) {
    const yesPercent = total > 0 ? (yes / total) * 100 : 0;
    const noPercent = total > 0 ? (no / total) * 100 : 0;
    const abstainPercent = total > 0 ? (abstain / total) * 100 : 0;
    
    return (
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div 
          className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500" 
          style={{ width: `${yesPercent}%` }}
          title={`Sim: ${yes}`}
        />
        <div 
          className="h-full bg-gradient-to-r from-rose-400 to-red-500 transition-all duration-500" 
          style={{ width: `${noPercent}%` }}
          title={`Nao: ${no}`}
        />
        <div 
          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500" 
          style={{ width: `${abstainPercent}%` }}
          title={`Abstencao: ${abstain}`}
        />
      </div>
    );
  }

  function VoteButton({ onClick, disabled, variant, children }: { onClick: () => void; disabled?: boolean; variant: 'yes' | 'no' | 'abstain'; children: React.ReactNode }) {
    const variants = {
      yes: 'from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-200',
      no: 'from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-rose-200',
      abstain: 'from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-200'
    };
    
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${variants[variant]} px-2.5 py-1 text-xs font-bold text-white shadow transition-all duration-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto`}
      >
        {children}
      </button>
    );
  }

  function AssemblyCard({ assembly }: { assembly: Assembly }) {
    const status = statusMeta(assembly.status);
    const canManageThis = canManage && user.condoId === assembly.condoId;
    const isExpanded = expandedAssembly === assembly.id;
    
    return (
      <article
        id={`assembly-${assembly.id}`}
        className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-sky-200 hover:shadow-md"
      >
        {/* Header com gradiente */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${status.panel} p-2.5`}>
          <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-6 -left-6 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-white lg:text-base">{assembly.title}</h3>
                  <span className={`rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm`}>
                    {status.label}
                  </span>
                  {assembly.votingWindowOpen && (
                    <span className="flex items-center gap-1 rounded-full border border-white/40 bg-white/30 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                      Votacao Aberta
                    </span>
                  )}
                  <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white/95 backdrop-blur-sm">
                    1 voto por unidade
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-white/90 line-clamp-2">{assembly.description || 'Sem descricao adicional.'}</p>
                
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold text-white/80">
                  <span className="flex items-center gap-1">
                    CONDOMINIO: {assembly.condoName || '-'}
                  </span>
                  <span className="flex items-center gap-1">
                    INICIO: {formatDateTime(assembly.startsAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    RESPONSAVEL: {assembly.creator?.name || '-'}
                  </span>
                </div>
              </div>
              
              {canManageThis && (
                <div className="flex w-full flex-wrap gap-1.5 lg:w-auto">
                  <button
                    onClick={() => void handleDownloadMinutes(assembly.id, assembly.title)}
                    disabled={minutesLoadingId === assembly.id}
                    className="rounded-lg border border-white/30 bg-white/20 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/30 disabled:opacity-50"
                  >
                    {minutesLoadingId === assembly.id ? 'Gerando ata...' : 'Baixar ata'}
                  </button>
                  {assembly.status !== 'open' && (
                    <button
                      onClick={() => void handleAssemblyStatus(assembly.id, 'open')}
                      disabled={actionAssemblyId === assembly.id}
                      className="rounded-lg border border-white/30 bg-white/20 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/30 disabled:opacity-50"
                    >
                      Reabrir
                    </button>
                  )}
                  {assembly.status !== 'closed' && (
                    <button
                      onClick={() => void handleAssemblyStatus(assembly.id, 'closed')}
                      disabled={actionAssemblyId === assembly.id}
                      className="rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:opacity-50"
                    >
                      Encerrar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Stats rapidos */}
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
          <div className="bg-white px-2 py-1 text-center">
            <p className="text-[11px] text-slate-500">Pautas</p>
            <p className="text-sm font-black text-slate-800">{assembly.itemCount}</p>
          </div>
          <div className="bg-white px-2 py-1 text-center">
            <p className="text-[11px] text-slate-500">Aprovadas</p>
            <p className="text-sm font-black text-emerald-600">{assembly.approvedItems}</p>
          </div>
          <div className="bg-white px-2 py-1 text-center">
            <p className="text-[11px] text-slate-500">Votos</p>
            <p className="text-sm font-black text-sky-600">{assembly.totalVotes}</p>
          </div>
          <div className="bg-white px-2 py-1 text-center">
            <p className="text-[11px] text-slate-500">Fim</p>
            <p className="text-[10px] font-bold text-slate-700">{new Date(assembly.endsAt).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
        
        {/* Botao expandir */}
        <button
          onClick={() => setExpandedAssembly(isExpanded ? null : assembly.id)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:from-slate-100 hover:to-slate-200"
        >
          <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>?</span>
          {isExpanded ? 'Ocultar pautas' : `Ver ${assembly.itemCount} pauta${assembly.itemCount !== 1 ? 's' : ''}`}
        </button>
        
        {/* Pautas expandidas */}
        {isExpanded && (
          <div className="space-y-2 border-t border-slate-100 bg-gradient-to-b from-white to-sky-50/20 p-2.5">
            {assembly.items.map((item, idx) => (
              <div 
                key={item.id} 
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-2.5 py-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-cyan-600 text-[10px] font-black text-white">
                          {item.itemOrder + 1}
                        </span>
                        <h4 className="break-words text-[13px] font-bold text-slate-800">{item.title}</h4>
                      </div>
                      {item.description && (
                        <p className="mt-1 text-[11px] text-slate-600">{item.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                          QUORUM: {quorumLabel(item.quorumType)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.stats.approved 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.stats.approved ? 'Aprovado' : 'Pendente'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.status === 'open'
                            ? 'bg-cyan-100 text-cyan-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.status === 'open' ? 'Pauta aberta' : 'Pauta fechada'}
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-base font-black text-slate-800">{item.stats.approvalPercent}%</p>
                      <p className="text-[10px] text-slate-500">aprovacao</p>
                      {canManageThis && assembly.status !== 'closed' && (
                        <button
                          onClick={() => void handleAgendaItemStatus(assembly.id, item.id, item.status === 'open' ? 'closed' : 'open')}
                          disabled={actionAssemblyId === assembly.id}
                          className="mt-1 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                        >
                          {item.status === 'open' ? 'Fechar pauta' : 'Reabrir pauta'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="px-2.5 py-2">
                  {/* Barra de progresso */}
                  <VoteProgressBar 
                    yes={item.stats.yes} 
                    no={item.stats.no} 
                    abstain={item.stats.abstain} 
                    total={item.stats.totalVotes}
                  />
                  
                  {/* Legenda */}
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 lg:grid-cols-4">
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1">
                      <div className="h-3 w-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
                      <div>
                        <p className="text-[10px] font-bold text-emerald-600">Sim</p>
                        <p className="text-[11px] font-black text-emerald-700">{item.stats.yes}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1">
                      <div className="h-3 w-3 rounded-full bg-gradient-to-r from-rose-400 to-rose-500" />
                      <div>
                        <p className="text-[10px] font-bold text-rose-600">Nao</p>
                        <p className="text-[11px] font-black text-rose-700">{item.stats.no}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1">
                      <div className="h-3 w-3 rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
                      <div>
                        <p className="text-[10px] font-bold text-amber-600">Abstencao</p>
                        <p className="text-[11px] font-black text-amber-700">{item.stats.abstain}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-sky-50 px-2 py-1">
                      <div className="h-3 w-3 rounded-full bg-gradient-to-r from-sky-400 to-cyan-500" />
                      <div>
                        <p className="text-[10px] font-bold text-sky-600">Participacao</p>
                        <p className="text-[11px] font-black text-sky-700">{item.stats.participationPercent}%</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Botoes de voto */}
                  {canVote && assembly.votingWindowOpen && item.status === 'open' && (
                    <div className="mt-2 flex flex-col gap-1.5 lg:flex-row lg:items-center">
                      <div className={`rounded-lg px-2 py-1 text-[10px] font-bold ${voteChoiceTone(item.myVote)}`}>
                        Seu voto: {voteChoiceLabel(item.myVote)}
                      </div>
                      {item.unitVoteLocked && !item.myVote && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                          Sua unidade ja votou{item.unitVoteBy?.name ? ` com ${item.unitVoteBy.name}` : ''}. Em assembleia virtual, vale 1 voto por unidade.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <VoteButton 
                          onClick={() => void handleVote(assembly.id, item.id, 'yes')}
                          disabled={actionAssemblyId === assembly.id || (item.unitVoteLocked && !item.myVote)}
                          variant="yes"
                        >
                          Votar SIM
                        </VoteButton>
                        <VoteButton 
                          onClick={() => void handleVote(assembly.id, item.id, 'no')}
                          disabled={actionAssemblyId === assembly.id || (item.unitVoteLocked && !item.myVote)}
                          variant="no"
                        >
                          Votar NAO
                        </VoteButton>
                        <VoteButton 
                          onClick={() => void handleVote(assembly.id, item.id, 'abstain')}
                          disabled={actionAssemblyId === assembly.id || (item.unitVoteLocked && !item.myVote)}
                          variant="abstain"
                        >
                          Abster
                        </VoteButton>
                      </div>
                    </div>
                  )}
                  {canVote && assembly.status === 'open' && item.status !== 'open' && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      Esta pauta foi encerrada pelo sindico para novos votos.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    );
  }

  return (
    <div className={`pb-4 ${isDarkTheme ? 'bg-slate-950/40' : 'bg-gradient-to-br from-slate-100 via-white to-cyan-50'}`}>
      {/* Hero Section */}
      <section className="relative overflow-hidden pb-8 pt-4 lg:pt-6" style={accentStyle}>
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              <span className="text-base">GV</span> Governanca Digital
            </div>
            <h1 className="mt-2 text-xl font-black text-white sm:text-2xl lg:text-3xl">
              Assembleia Virtual
            </h1>
            <p className="mx-auto mt-1.5 max-w-2xl text-xs text-white/80 sm:text-sm">
              Deliberacoes oficiais com votacao por pauta, quorum automatico e transparencia total
            </p>
          </div>
          
          {/* Filtros */}
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {[
              { key: 'all', label: 'Todas', icon: 'TOD' },
              { key: 'open', label: 'Abertas', icon: 'ABR' },
              { key: 'closed', label: 'Encerradas', icon: 'ENC' }
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key as typeof statusFilter)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all duration-200 ${
                  statusFilter === filter.key
                    ? 'scale-105 bg-white text-sky-700 shadow-xl'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                <span>{filter.icon}</span>
                {filter.label}
              </button>
            ))}
            {canManage && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white shadow transition-all duration-200 hover:bg-white/25 hover:shadow-lg"
              >
                <span className="text-sm">+</span> Nova Assembleia
              </button>
            )}
            <button
              onClick={() => void loadAssemblies({ force: true })}
              className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white shadow transition-all duration-200 hover:bg-white/25 hover:shadow-lg"
            >
              Atualizar
            </button>
          </div>
          {lastUpdatedAt && (
            <p className="mt-2 text-center text-[11px] font-semibold text-white/80">
              Ultima atualizacao: {new Date(lastUpdatedAt).toLocaleTimeString('pt-BR')}
            </p>
          )}
        </div>
      </section>
      
      {/* Stats Cards - sobrepostos ao hero */}
      <div className="relative z-20 mx-auto -mt-4 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="TOT" label="Total" value={summary.total} gradient="from-sky-500 to-cyan-600" />
          <StatCard icon="ABR" label="Abertas" value={summary.open} gradient="from-emerald-500 to-teal-500" />
          <StatCard icon="ENC" label="Encerradas" value={summary.closed} gradient="from-slate-600 to-slate-700" />
          <StatCard icon="VOT" label="Votos" value={summary.votes} gradient="from-amber-500 to-orange-500" />
        </div>
      </div>
      
      {/* Notificacoes */}
      {flash && (
        <div className="mx-auto mt-3 max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-lg animate-slideIn sm:text-sm">
            <span className="text-lg">OK</span>
            {flash}
          </div>
        </div>
      )}
      
      {error && (
        <div className="mx-auto mt-3 max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50 px-3 py-2 text-xs font-semibold text-rose-800 shadow-lg sm:text-sm">
            <span className="text-lg">ER</span>
            {error}
          </div>
        </div>
      )}

      {canVote && openAssembliesForResidents.length > 0 && (
        <div className="mx-auto mt-3 max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-cyan-700">Assembleia aberta</p>
                <p className="text-xs font-semibold text-cyan-900 sm:text-sm">
                  O sindico abriu {openAssembliesForResidents.length} assembleia(s) para votacao.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {openAssembliesForResidents.slice(0, 3).map((assembly) => (
                  <button
                    key={assembly.id}
                    onClick={() => focusAssembly(assembly.id)}
                    className="rounded-full border border-cyan-300 bg-white px-2.5 py-1 text-[10px] font-bold text-cyan-700 transition-all hover:bg-cyan-50"
                  >
                    Votar: {assembly.title.length > 22 ? `${assembly.title.slice(0, 22)}...` : assembly.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Lista de Assembleias */}
      <div className="mx-auto mt-3 max-w-6xl px-4 sm:px-6 lg:px-8">
        {loading && assemblies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
            <p className="mt-2 text-xs text-slate-500">Carregando assembleias...</p>
          </div>
        ) : assemblies.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white py-8">
            <span className="text-4xl">--</span>
            <p className="mt-2 text-sm font-semibold text-slate-600">Nenhuma assembleia encontrada</p>
            <p className="text-xs text-slate-400">Tente mudar o filtro ou crie uma nova assembleia</p>
            {canManage && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white shadow transition-all hover:bg-sky-700"
              >
                <span>+</span> Criar Assembleia
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {assemblies.map((assembly) => (
              <AssemblyCard key={assembly.id} assembly={assembly} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Criacao */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-scaleIn">
            {/* Header */}
            <div className="relative overflow-hidden px-4 py-3" style={accentStyle}>
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/80">Nova Assembleia</p>
                  <h3 className="mt-0.5 text-base font-black text-white">Criar Pauta Virtual</h3>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-white/30 bg-white/20 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/30"
                >
                  x
                </button>
              </div>
            </div>
            
            {/* Conteudo */}
            <div className="max-h-[78dvh] overflow-y-auto px-4 py-3 sm:max-h-[62vh]">
              <div className="space-y-3">
                {/* Titulo */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Titulo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition-all focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    placeholder="Ex.: Assembleia Ordinaria de Abril"
                  />
                </div>
                
                {/* Descricao */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Descricao
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition-all focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    placeholder="Objetivo e contexto da assembleia..."
                  />
                </div>
                
                {/* Condominio (se necessario) */}
                {!user.condoId && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Condominio <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedCondoId}
                      onChange={(e) => setSelectedCondoId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition-all focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">Selecione...</option>
                      {condos.map((condo) => (
                        <option key={condo.id} value={condo.id}>{condo.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Datas */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Data de Inicio <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition-all focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Data de Fim <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition-all focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Publicacao
                  </label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as 'open' | 'draft')}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition-all focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="open">Abrir agora e notificar moradores</option>
                    <option value="draft">Salvar como rascunho</option>
                  </select>
                </div>
                
                {/* Itens de Pauta */}
                <div>
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-xs font-semibold text-gray-700">
                      Itens de Pauta <span className="text-rose-500">*</span>
                    </label>
                    <button
                      onClick={() => setAgendaItems([...agendaItems, { title: '', description: '', quorumType: 'simple' }])}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-700 transition-all hover:bg-sky-200 sm:w-auto"
                    >
                      <span>+</span> Adicionar Item
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {agendaItems.map((item, index) => (
                      <div key={`${index}-${item.title}`} className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-sky-50 p-2.5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white">
                            {index + 1}
                          </span>
                          <div className="flex-1 space-y-2.5">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <input
                                value={item.title}
                                onChange={(e) => {
                                  const newItems = [...agendaItems];
                                  newItems[index].title = e.target.value;
                                  setAgendaItems(newItems);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                                placeholder="Titulo do item"
                              />
                              <select
                                value={item.quorumType}
                                onChange={(e) => {
                                  const newItems = [...agendaItems];
                                  newItems[index].quorumType = e.target.value as QuorumType;
                                  setAgendaItems(newItems);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                              >
                                <option value="simple">Maioria Simples</option>
                                <option value="two_thirds">2/3 dos Aptos</option>
                                <option value="unanimity">Unanimidade</option>
                              </select>
                            </div>
                            <textarea
                              value={item.description}
                              onChange={(e) => {
                                const newItems = [...agendaItems];
                                newItems[index].description = e.target.value;
                                setAgendaItems(newItems);
                              }}
                              rows={2}
                              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                              placeholder="Descricao detalhada deste item..."
                            />
                            {agendaItems.length > 1 && (
                              <button
                                onClick={() => setAgendaItems(agendaItems.filter((_, i) => i !== index))}
                                className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 transition-all hover:text-rose-700"
                              >
                                Remover item
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-600 transition-all hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleCreateAssembly()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold shadow transition-all hover:shadow-lg disabled:opacity-50"
                style={accentStyle}
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <span>+</span> {createStatus === 'open' ? 'Criar e abrir' : 'Salvar rascunho'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






