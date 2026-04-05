import { useState, useRef, useCallback, useEffect } from 'react';
import type { User } from './types';
import { getBackendState, updateBackendState } from './backendState';

// ─── TIPOS EXTENDIDOS DO MARKETPLACE ─────────────────────────────────────
export interface MarketListing {
  id: string;
  condoId: string;
  sellerId: string;
  sellerName: string;
  sellerUnit: string;
  sellerAvatar?: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: 'novo' | 'seminovo' | 'usado' | 'defeito';
  status: 'available' | 'sold' | 'reserved' | 'paused';
  photos: string[];
  tags: string[];
  views: number;
  likes: string[];
  createdAt: string;
  updatedAt: string;
  location?: string;
  negotiable: boolean;
  whatsapp?: string;
}

// ─── DADOS INICIAIS ───────────────────────────────────────────────────────
let _listings: MarketListing[] = [
  {
    id: 'ml1', condoId: 'c1', sellerId: 'u5', sellerName: 'Pedro Costa', sellerUnit: '202-B',
    title: 'Sofá 3 Lugares Cinza', description: 'Sofá em ótimo estado, cor cinza claro, 2 anos de uso. Tecido suede lavável. Comprimento 2,10m. Retirada no apartamento.',
    price: 850, category: 'Móveis', condition: 'seminovo', status: 'available',
    photos: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80'],
    tags: ['sofá', 'sala', 'móveis'], views: 47, likes: ['u4'],
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    negotiable: true, location: 'AP 202-B', whatsapp: '11999990005',
  },
  {
    id: 'ml2', condoId: 'c1', sellerId: 'u4', sellerName: 'Maria Silva', sellerUnit: '101-A',
    title: 'Bicicleta Ergométrica Kikos', description: 'Bicicleta ergométrica com 8 níveis de resistência magnética. Suporta até 120kg. Dashboard digital com contador de calorias, tempo e velocidade. Pouco uso.',
    price: 380, category: 'Esportes', condition: 'seminovo', status: 'available',
    photos: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80'],
    tags: ['bicicleta', 'exercício', 'academia'], views: 89, likes: ['u5'],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    negotiable: false, location: 'AP 101-A',
  },
  {
    id: 'ml3', condoId: 'c1', sellerId: 'u5', sellerName: 'Pedro Costa', sellerUnit: '202-B',
    title: 'iPhone 12 64GB Preto', description: 'iPhone 12 em perfeito estado, 64GB, cor preta. Bateria com 87% de saúde. Acompanha carregador original e capinha. Sem marcas de uso.',
    price: 1800, category: 'Eletrônicos', condition: 'usado', status: 'available',
    photos: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&q=80'],
    tags: ['iphone', 'celular', 'apple'], views: 156, likes: ['u4'],
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    negotiable: true, whatsapp: '11999990005',
  },
  {
    id: 'ml4', condoId: 'c1', sellerId: 'u4', sellerName: 'Maria Silva', sellerUnit: '101-A',
    title: 'Micro-ondas LG 30L Branco', description: 'Micro-ondas LG 30 litros em perfeito estado. Funcionando perfeitamente. Motivo da venda: upgrade para modelo maior. Retirada imediata.',
    price: 220, category: 'Eletrodomésticos', condition: 'usado', status: 'sold',
    photos: ['https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&q=80'],
    tags: ['micro-ondas', 'cozinha', 'eletrodoméstico'], views: 34, likes: [],
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    negotiable: false,
  },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function syncListingsFromBackend(): MarketListing[] {
  try {
    const listings = (getBackendState().marketplaceListings as MarketListing[]) ?? [];
    _listings = listings;
    return listings;
  } catch {
    return _listings;
  }
}

function persistListings(nextListings: MarketListing[]): void {
  _listings = nextListings;
  try {
    updateBackendState((state) => {
      state.marketplaceListings = nextListings;
    });
  } catch {
    // Ignora apenas enquanto o bootstrap inicial do front ainda nao terminou.
  }
}

export function getListings(condoId: string): MarketListing[] {
  return syncListingsFromBackend().filter(l => l.condoId === condoId);
}

export function addListing(data: Omit<MarketListing, 'id' | 'views' | 'likes' | 'createdAt' | 'updatedAt'>): MarketListing {
  const newItem: MarketListing = {
    ...data, id: 'ml' + uid(), views: 0, likes: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  persistListings([...syncListingsFromBackend(), newItem]);
  return newItem;
}

export function updateListing(id: string, data: Partial<MarketListing>): void {
  persistListings(syncListingsFromBackend().map(l => l.id === id ? { ...l, ...data, updatedAt: new Date().toISOString() } : l));
}

export function deleteListing(id: string): void {
  persistListings(syncListingsFromBackend().filter(l => l.id !== id));
}

export function toggleLike(listingId: string, userId: string): void {
  persistListings(syncListingsFromBackend().map(l => {
    if (l.id !== listingId) return l;
    const liked = l.likes.includes(userId);
    return { ...l, likes: liked ? l.likes.filter(id => id !== userId) : [...l.likes, userId] };
  }));
}

export function incrementView(id: string): void {
  persistListings(syncListingsFromBackend().map(l => l.id === id ? { ...l, views: l.views + 1 } : l));
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────
const CATEGORIES = ['Todas', 'Móveis', 'Eletrodomésticos', 'Eletrônicos', 'Esportes', 'Vestuário', 'Livros', 'Brinquedos', 'Plantas', 'Automóveis', 'Serviços', 'Outros'];
const CONDITIONS = [
  { value: 'novo', label: '✨ Novo', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'seminovo', label: '🟢 Seminovo', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'usado', label: '🟡 Usado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'defeito', label: '🔴 Com defeito', color: 'bg-red-100 text-red-700 border-red-200' },
];
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: '🟢 Disponível', color: 'bg-emerald-100 text-emerald-700' },
  sold:      { label: '🔴 Vendido', color: 'bg-red-100 text-red-700' },
  reserved:  { label: '🟡 Reservado', color: 'bg-amber-100 text-amber-700' },
  paused:    { label: '⏸️ Pausado', color: 'bg-gray-100 text-gray-600' },
};

function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins} min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days === 1) return 'Ontem';
  return `${days} dias atrás`;
}

// ─── COMPONENTES UI ───────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = ['from-violet-500 to-purple-600', 'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600', 'from-orange-500 to-red-500', 'from-pink-500 to-rose-600'];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' };
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {name[0]}
    </div>
  );
}

// ─── FOTO UPLOAD ──────────────────────────────────────────────────────────
function PhotoUpload({ photos, onChange, maxPhotos = 5 }: {
  photos: string[]; onChange: (p: string[]) => void; maxPhotos?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, maxPhotos - photos.length);
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const result = ev.target?.result as string;
        onChange([...photos, result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (i: number) => {
    onChange(photos.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700">Fotos do Produto</label>
        <span className="text-xs text-gray-400">{photos.length}/{maxPhotos}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 group">
            <img src={p} alt={`foto ${i+1}`} className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1 left-1 text-xs font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-lg">Capa</span>
            )}
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-indigo-300 flex flex-col items-center justify-center gap-1 hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer"
          >
            <span className="text-2xl text-indigo-400">📷</span>
            <span className="text-xs text-indigo-400 font-medium">Adicionar</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
      <p className="text-xs text-gray-400">JPG, PNG ou WebP · Máx 10MB por foto · Até {maxPhotos} fotos</p>
    </div>
  );
}

// ─── CARD DO ANÚNCIO ──────────────────────────────────────────────────────
function ListingCard({ listing, userId, onOpen, onLike }: {
  listing: MarketListing;
  userId: string;
  onOpen: () => void;
  onLike: () => void;
}) {
  const isLiked = listing.likes.includes(userId);
  const statusCfg = STATUS_LABELS[listing.status];
  const condCfg = CONDITIONS.find(c => c.value === listing.condition);
  const isOwner = listing.sellerId === userId;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group cursor-pointer"
      onClick={onOpen}
    >
      {/* Foto principal */}
      <div className="relative h-48 sm:h-52 bg-gray-100 overflow-hidden">
        {listing.photos.length > 0 ? (
          <img
            src={listing.photos[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-6xl opacity-30">🛒</span>
          </div>
        )}
        {/* Overlay com badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${condCfg?.color ?? ''}`}>
            {condCfg?.label}
          </span>
        </div>
        {listing.photos.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg font-medium">
            📷 {listing.photos.length}
          </div>
        )}
        {listing.status !== 'available' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className={`text-sm font-bold px-3 py-1.5 rounded-xl ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
        )}
        {/* Botão curtir */}
        <button
          onClick={e => { e.stopPropagation(); onLike(); }}
          className={`absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-lg transition-all ${isLiked ? 'bg-red-500 text-white scale-110' : 'bg-white/90 text-gray-500 hover:bg-white hover:scale-110'}`}
        >
          {isLiked ? '❤️' : '🤍'}
        </button>
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        {/* Preço e negociável */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xl font-black text-gray-900">{fmtMoney(listing.price)}</p>
          {listing.negotiable && (
            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0 mt-1">Negociável</span>
          )}
        </div>

        {/* Título */}
        <h3 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2 mb-1">{listing.title}</h3>

        {/* Categoria */}
        <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">{listing.category}</span>

        {/* Vendedor */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
          <Avatar name={listing.sellerName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">
              {isOwner ? 'Você' : listing.sellerName.split(' ')[0]}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>👁️ {listing.views}</span>
            <span>❤️ {listing.likes.length}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(listing.createdAt)}</p>
      </div>
    </div>
  );
}

// ─── MODAL: DETALHES DO ANÚNCIO ───────────────────────────────────────────
function ListingDetailModal({ listing, userId, onClose, onLike, onDelete, onMarkSold, onEdit, onSendInternalMessage }: {
  listing: MarketListing;
  userId: string;
  onClose: () => void;
  onLike: () => void;
  onDelete: () => void;
  onMarkSold: () => void;
  onEdit: () => void;
  onSendInternalMessage?: (sellerId: string) => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const isLiked = listing.likes.includes(userId);
  const isOwner = listing.sellerId === userId;
  const condCfg = CONDITIONS.find(c => c.value === listing.condition);
  const statusCfg = STATUS_LABELS[listing.status];

  useEffect(() => { incrementView(listing.id); }, [listing.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto" style={{ animation: 'slideUp 0.3s ease-out' }}>
        {/* Fotos */}
        <div className="relative bg-gray-900">
          {listing.photos.length > 0 ? (
            <>
              <img
                src={listing.photos[photoIdx]}
                alt={listing.title}
                className="w-full h-64 sm:h-80 object-contain"
              />
              {listing.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-all disabled:opacity-30"
                    disabled={photoIdx === 0}
                  >‹</button>
                  <button
                    onClick={() => setPhotoIdx(i => Math.min(listing.photos.length - 1, i + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-all disabled:opacity-30"
                    disabled={photoIdx === listing.photos.length - 1}
                  >›</button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {listing.photos.map((_, i) => (
                      <button key={i} onClick={() => setPhotoIdx(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? 'bg-white scale-125' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Miniaturas */}
              {listing.photos.length > 1 && (
                <div className="absolute bottom-3 right-3 flex gap-1">
                  {listing.photos.slice(0, 4).map((p, i) => (
                    <button key={i} onClick={() => setPhotoIdx(i)}
                      className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === photoIdx ? 'border-white scale-110' : 'border-white/40 opacity-70 hover:opacity-100'}`}>
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-48 flex items-center justify-center">
              <span className="text-8xl opacity-20">🛒</span>
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 left-3 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors font-bold">✕</button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 space-y-4">
          {/* Status e condição */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${statusCfg.color}`}>{statusCfg.label}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${condCfg?.color}`}>{condCfg?.label}</span>
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg">{listing.category}</span>
            {listing.negotiable && <span className="text-xs font-semibold bg-green-50 text-green-600 px-2.5 py-1 rounded-lg">💬 Negociável</span>}
          </div>

          {/* Título e preço */}
          <div>
            <h2 className="text-xl font-black text-gray-900 mb-1">{listing.title}</h2>
            <p className="text-3xl font-black text-indigo-600">{fmtMoney(listing.price)}</p>
          </div>

          {/* Descrição */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Descrição</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '👁️', label: 'Visualizações', value: listing.views },
              { icon: '❤️', label: 'Curtidas', value: listing.likes.length },
              { icon: '📅', label: 'Publicado', value: timeAgo(listing.createdAt) },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <span className="text-lg">{s.icon}</span>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                <p className="font-bold text-gray-800 text-sm">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Vendedor */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">Vendedor</p>
            <div className="flex items-center gap-3">
              <Avatar name={listing.sellerName} size="lg" />
              <div>
                <p className="font-bold text-gray-800">{listing.sellerName.split(' ')[0]}</p>
              </div>
            </div>
            {!isOwner && listing.status === 'available' && (
              <div className="mt-3 flex flex-col gap-2">
                {/* Botão de mensagem interna — envia direto para o chat do sistema */}
                <button
                  onClick={() => {
                    if (onSendInternalMessage) onSendInternalMessage(listing.sellerId);
                  }}
                  className="w-full py-3.5 rounded-xl flex items-center justify-center gap-3 text-sm font-black transition-all shadow-lg hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #128c7e, #25d366)', color: 'white' }}
                >
                  <span className="text-xl">💬</span>
                  <span>Enviar mensagem ao vendedor</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Chat interno</span>
                </button>

                {/* Info: chat interno do sistema */}
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-500 text-sm flex-shrink-0">🔒</span>
                  <p className="text-xs text-emerald-700 font-medium leading-snug">
                    A mensagem será enviada diretamente pelo <strong>chat interno</strong> do INOVATECH CONNECT ao vendedor <strong>{listing.sellerName.split(' ')[0]}</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <button
              onClick={onLike}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${isLiked ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-500'}`}
            >
              {isLiked ? '❤️' : '🤍'} {listing.likes.length}
            </button>
            {isOwner && (
              <>
                {listing.status === 'available' && (
                  <button onClick={onMarkSold} className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors text-sm shadow-lg shadow-emerald-200 flex items-center justify-center gap-2">
                    ✅ Marcar como Vendido
                  </button>
                )}
                <button onClick={onEdit} className="px-5 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors text-sm flex items-center gap-1">
                  ✏️
                </button>
                <button onClick={onDelete} className="px-5 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors text-sm flex items-center gap-1">
                  🗑️
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL: CRIAR/EDITAR ANÚNCIO ─────────────────────────────────────────
function ListingFormModal({ initial, user, condoId, onSave, onClose }: {
  initial?: Partial<MarketListing>;
  user: User;
  condoId: string;
  onSave: (data: Omit<MarketListing, 'id' | 'views' | 'likes' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(String(initial?.price ?? ''));
  const [category, setCategory] = useState(initial?.category ?? 'Móveis');
  const [condition, setCondition] = useState<MarketListing['condition']>(initial?.condition ?? 'usado');
  const [negotiable, setNegotiable] = useState(initial?.negotiable ?? false);
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [tags, setTags] = useState(initial?.tags?.join(', ') ?? '');
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? '');
  const [location, setLocation] = useState(initial?.location ?? `AP ${user.unit ?? ''}`);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 3) e.title = 'Título deve ter pelo menos 3 caracteres';
    if (!description.trim() || description.trim().length < 10) e.description = 'Descrição deve ter pelo menos 10 caracteres';
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) e.price = 'Preço inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      condoId, sellerId: user.id, sellerName: user.name, sellerUnit: user.unit ?? '-',
      title: title.trim(), description: description.trim(), price: parseFloat(price),
      category, condition, status: initial?.status ?? 'available',
      photos, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      negotiable, whatsapp: whatsapp || undefined, location: location || undefined,
    });
    onClose();
  };

  const catsList = CATEGORIES.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto" style={{ animation: 'slideUp 0.3s ease-out' }}>
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900">{initial?.id ? '✏️ Editar Anúncio' : '🛒 Criar Anúncio'}</h3>
            <p className="text-xs text-gray-500">Preencha todos os campos para publicar seu anúncio</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-6">
          {/* Fotos */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
            <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={5} />
          </div>

          {/* Informações básicas */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Informações do Produto
            </h4>

            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Título do Anúncio *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Sofá 3 lugares cinza, muito conservado..."
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${errors.title ? 'border-red-300 bg-red-50 focus:ring-red-100' : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-indigo-100'}`}
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">⚠ {errors.title}</p>}
              <p className="text-xs text-gray-400 mt-1">{title.length}/100 caracteres</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Categoria</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm"
                >
                  {catsList.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Condição</label>
                <select
                  value={condition}
                  onChange={e => setCondition(e.target.value as MarketListing['condition'])}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm"
                >
                  {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Descrição *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Descreva o produto em detalhes: dimensões, cor, marca, motivo da venda, estado de conservação..."
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 resize-none ${errors.description ? 'border-red-300 bg-red-50 focus:ring-red-100' : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-indigo-100'}`}
              />
              {errors.description && <p className="text-xs text-red-500 mt-1">⚠ {errors.description}</p>}
            </div>
          </div>

          {/* Preço */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Preço e Condições
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Preço (R$) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">R$</span>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0,00"
                    min="0"
                    step="0.01"
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${errors.price ? 'border-red-300 bg-red-50 focus:ring-red-100' : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-indigo-100'}`}
                  />
                </div>
                {errors.price && <p className="text-xs text-red-500 mt-1">⚠ {errors.price}</p>}
              </div>
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-gray-200 hover:border-emerald-300 transition-colors mt-5">
                  <div
                    onClick={() => setNegotiable(p => !p)}
                    className={`w-11 h-6 rounded-full transition-all relative ${negotiable ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${negotiable ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Negociável</span>
                </label>
              </div>
            </div>
          </div>

          {/* Contato e localização */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Contato e Localização
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">WhatsApp (opcional)</label>
                <input
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-0000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Localização</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="AP 101-A"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Tags (separadas por vírgula)</label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="sofá, sala, móvel, decoração..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Preview do preço */}
          {price && parseFloat(price) > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Resumo do Anúncio</p>
                <p className="font-bold text-gray-800 mt-1">{title || 'Sem título'}</p>
                <p className="text-xs text-gray-500">{category} · {CONDITIONS.find(c => c.value === condition)?.label}</p>
              </div>
              <p className="text-2xl font-black text-indigo-600">{fmtMoney(parseFloat(price) || 0)}</p>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors text-sm">
              Cancelar
            </button>
            <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-sm hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5">
              {initial?.id ? '💾 Salvar Alterações' : '🚀 Publicar Anúncio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SEÇÃO PRINCIPAL DO MARKETPLACE ──────────────────────────────────────
export function MarketplaceSection({ user, onOpenChat }: {
  user: User;
  onOpenChat?: (sellerId: string) => void;
}) {
  const [listings, setListings] = useState<MarketListing[]>(() => getListings(user.condoId!));
  const [catFilter, setCatFilter] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc' | 'popular'>('recent');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'mine' | 'liked'>('all');
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editListing, setEditListing] = useState<MarketListing | null>(null);
  const [, forceUpdate] = useState(0);

  const refresh = useCallback(() => {
    setListings([...getListings(user.condoId!)]);
    forceUpdate(n => n + 1);
  }, [user.condoId]);

  const isMorador = user.role === 'morador';
  const isSindico = user.role === 'sindico' || user.role === 'admin';

  // Filtrar e ordenar
  let filtered = listings;
  if (catFilter !== 'Todas') filtered = filtered.filter(l => l.category === catFilter);
  if (statusFilter === 'available') filtered = filtered.filter(l => l.status === 'available');
  if (statusFilter === 'mine') filtered = filtered.filter(l => l.sellerId === user.id);
  if (statusFilter === 'liked') filtered = filtered.filter(l => l.likes.includes(user.id));
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.tags.some(t => t.toLowerCase().includes(q)) ||
      l.category.toLowerCase().includes(q)
    );
  }
  if (sortBy === 'recent') filtered = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sortBy === 'price_asc') filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sortBy === 'price_desc') filtered = [...filtered].sort((a, b) => b.price - a.price);
  if (sortBy === 'popular') filtered = [...filtered].sort((a, b) => (b.views + b.likes.length) - (a.views + a.likes.length));

  const myListings = listings.filter(l => l.sellerId === user.id);
  const availableCount = listings.filter(l => l.status === 'available').length;
  const likedCount = listings.filter(l => l.likes.includes(user.id)).length;
  const totalViews = listings.reduce((s, l) => s + l.views, 0);

  const handleSaveListing = (data: Omit<MarketListing, 'id' | 'views' | 'likes' | 'createdAt' | 'updatedAt'>) => {
    if (editListing) {
      updateListing(editListing.id, data);
    } else {
      addListing(data);
    }
    setEditListing(null);
    setShowForm(false);
    refresh();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este anúncio?')) return;
    deleteListing(id);
    setSelectedListing(null);
    refresh();
  };

  const handleLike = (id: string) => {
    toggleLike(id, user.id);
    refresh();
    if (selectedListing?.id === id) {
      setSelectedListing(l => l ? { ...l, likes: l.likes.includes(user.id) ? l.likes.filter(uid => uid !== user.id) : [...l.likes, user.id] } : null);
    }
  };

  const handleMarkSold = (id: string) => {
    updateListing(id, { status: 'sold' });
    setSelectedListing(null);
    refresh();
  };

  return (
    <div className="space-y-5">
      {/* Stats rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: '🛒', label: 'Anúncios', value: availableCount, sub: 'disponíveis', color: 'from-indigo-500 to-purple-600' },
          { icon: '👤', label: 'Meus', value: myListings.length, sub: 'anúncios', color: 'from-emerald-500 to-teal-600' },
          { icon: '❤️', label: 'Curtidas', value: likedCount, sub: 'salvos', color: 'from-pink-500 to-rose-600' },
          { icon: '👁️', label: 'Visualizações', value: totalViews, sub: 'total', color: 'from-amber-500 to-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all hover:-translate-y-0.5 group">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl shadow-md group-hover:scale-110 transition-transform`}>{s.icon}</div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-black text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de busca e filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Busca */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar produtos, categorias, tags..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold">✕</button>
          )}
        </div>

        {/* Filtros de status */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'Todos', count: listings.length },
            { key: 'available', label: '🟢 Disponíveis', count: availableCount },
            { key: 'mine', label: '👤 Meus', count: myListings.length },
            { key: 'liked', label: '❤️ Curtidos', count: likedCount },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key as typeof statusFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${statusFilter === f.key ? 'bg-indigo-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {f.count}
              </span>
            </button>
          ))}

          {/* Ordenação */}
          <div className="ml-auto">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs font-semibold border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-indigo-400 text-gray-600"
            >
              <option value="recent">🕐 Mais recentes</option>
              <option value="price_asc">💰 Menor preço</option>
              <option value="price_desc">💰 Maior preço</option>
              <option value="popular">🔥 Mais populares</option>
            </select>
          </div>
        </div>

        {/* Categorias */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${catFilter === cat ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Botão criar anúncio */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {filtered.length} anúncio{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          {searchQuery && ` para "${searchQuery}"`}
        </p>
        {(isMorador || isSindico) && (
          <button
            onClick={() => { setEditListing(null); setShowForm(true); }}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
          >
            <span className="text-lg">➕</span>
            Criar Anúncio
          </button>
        )}
      </div>

      {/* Grid de anúncios */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-xl font-bold text-gray-600 mb-2">Nenhum anúncio encontrado</p>
          <p className="text-sm text-gray-400">
            {searchQuery ? `Tente buscar por outro termo` : 'Seja o primeiro a anunciar!'}
          </p>
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setCatFilter('Todas'); setStatusFilter('all'); }}
              className="mt-4 px-5 py-2 bg-indigo-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 transition-colors text-sm">
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((listing, i) => (
            <div key={listing.id} style={{ animationDelay: `${i * 40}ms`, animation: 'slideUp 0.4s ease-out both' }}>
              <ListingCard
                listing={listing}
                userId={user.id}
                onOpen={() => setSelectedListing(listing)}
                onLike={() => handleLike(listing.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalhes */}
      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          userId={user.id}
          onClose={() => setSelectedListing(null)}
          onLike={() => handleLike(selectedListing.id)}
          onDelete={() => handleDelete(selectedListing.id)}
          onMarkSold={() => handleMarkSold(selectedListing.id)}
          onEdit={() => { setEditListing(selectedListing); setShowForm(true); setSelectedListing(null); }}
          onSendInternalMessage={(sellerId) => {
            setSelectedListing(null);
            if (onOpenChat) onOpenChat(sellerId);
          }}
        />
      )}

      {/* Modal de criar/editar */}
      {showForm && (
        <ListingFormModal
          initial={editListing ?? undefined}
          user={user}
          condoId={user.condoId!}
          onSave={handleSaveListing}
          onClose={() => { setShowForm(false); setEditListing(null); }}
        />
      )}
    </div>
  );
}
