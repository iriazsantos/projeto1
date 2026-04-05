import { useState, useMemo, useRef } from 'react';
import type { User, Reservation, CommonArea } from './types';
import type { useStore } from './store';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(s: string) {
  if (!s) return '-';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}
function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function addMinutes(t: string, mins: number): string {
  const total = parseTime(t) + mins;
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function diffHours(start: string, end: string): number {
  return Math.max(0, (parseTime(end) - parseTime(start)) / 60);
}

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const AREA_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; glow: string }> = {
  area1: { bg: 'from-violet-500 to-purple-600', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', glow: 'shadow-violet-200' },
  area2: { bg: 'from-orange-500 to-red-500', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', glow: 'shadow-orange-200' },
  area3: { bg: 'from-emerald-500 to-teal-600', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', glow: 'shadow-emerald-200' },
  area4: { bg: 'from-blue-500 to-indigo-600', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', glow: 'shadow-blue-200' },
};

const DEFAULT_COLORS = [
  { bg: 'from-pink-500 to-rose-600', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700', glow: 'shadow-pink-200' },
  { bg: 'from-cyan-500 to-blue-600', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700', glow: 'shadow-cyan-200' },
  { bg: 'from-amber-500 to-yellow-500', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', glow: 'shadow-amber-200' },
];

function getAreaColor(areaId: string) {
  if (AREA_COLORS[areaId]) return AREA_COLORS[areaId];
  // Gerar cor baseada no hash do ID
  const idx = areaId.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % DEFAULT_COLORS.length;
  return DEFAULT_COLORS[idx];
}

// ─── TIME SLOTS ──────────────────────────────────────────────────────────────
function generateTimeSlots(openHour = 6, closeHour = 23, stepMin = 30) {
  const slots: string[] = [];
  for (let h = openHour; h <= closeHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      if (h === closeHour && m > 0) break;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return slots;
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    red: 'bg-red-100 text-red-700 border border-red-200',
    yellow: 'bg-amber-100 text-amber-700 border border-amber-200',
    blue: 'bg-blue-100 text-blue-700 border border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border border-purple-200',
    gray: 'bg-gray-100 text-gray-600 border border-gray-200',
    orange: 'bg-orange-100 text-orange-700 border border-orange-200',
    violet: 'bg-violet-100 text-violet-700 border border-violet-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'danger' | 'success' | 'secondary' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg'; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const v = {
    primary: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-indigo-100',
    danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-red-100',
    success: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-emerald-100',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-amber-100',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
  }[variant];
  const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }[size];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-xl font-semibold shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed ${v} ${s}`}>
      {children}
    </button>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide = false, fullscreen = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; fullscreen?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${fullscreen ? 'max-w-5xl' : wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[94vh] overflow-y-auto`}
        style={{ animation: 'slideUp 0.25s ease-out' }}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-base sm:text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors font-bold text-lg">
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AREA FORM MODAL — Criar/Editar área (Síndico)
// ═══════════════════════════════════════════════════════════════════════════
function AreaFormModal({ initial, condoId, onSave, onClose }: {
  initial?: Partial<CommonArea>;
  condoId: string;
  onSave: (data: Omit<CommonArea, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? ''));
  const [maxHours, setMaxHours] = useState(String(initial?.maxHours ?? ''));
  const [pricePerHour, setPricePerHour] = useState(String(initial?.pricePerHour ?? '0'));
  const [image, setImage] = useState(initial?.image ?? '🏢');
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? '');
  const [rules, setRules] = useState<string[]>(initial?.rules ?? ['']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const EMOJIS = ['🎉', '🔥', '🏀', '🍽️', '🏋️', '🎭', '🌊', '🎸', '🌿', '🐾', '🎱', '🏓', '🛁', '🎮', '🏊', '🎪'];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErrors(er => ({ ...er, photo: 'Foto deve ter no máximo 5MB' })); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoUrl(ev.target?.result as string);
      setErrors(er => { const n = { ...er }; delete n.photo; return n; });
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Nome é obrigatório';
    if (!capacity || parseInt(capacity) <= 0) e.capacity = 'Capacidade inválida';
    if (!maxHours || parseInt(maxHours) <= 0) e.maxHours = 'Máximo de horas inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      condoId,
      name: name.trim(),
      description: description.trim(),
      capacity: parseInt(capacity),
      maxHours: parseInt(maxHours),
      pricePerHour: parseFloat(pricePerHour) || 0,
      image,
      photoUrl: photoUrl || undefined,
      rules: rules.filter(r => r.trim()),
    });
    onClose();
  };

  return (
    <Modal title={initial?.name ? `✏️ Editar: ${initial.name}` : '➕ Nova Área Comum'} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Foto */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
          <h4 className="text-sm font-bold text-indigo-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
            Foto da Área
          </h4>
          {/* Preview */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-3">
            <div className="w-32 h-24 rounded-xl overflow-hidden border-2 border-indigo-200 bg-gray-100 flex items-center justify-center flex-shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">{image}</span>
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-2.5 px-4 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
              >
                📷 {photoUrl ? 'Trocar Foto' : 'Inserir Foto da Área'}
              </button>
              {photoUrl && (
                <button
                  onClick={() => setPhotoUrl('')}
                  className="w-full py-2 px-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  🗑️ Remover foto
                </button>
              )}
              {errors.photo && <p className="text-xs text-red-500">⚠ {errors.photo}</p>}
              <p className="text-xs text-gray-400">JPG, PNG ou WebP · Máx 5MB</p>
            </div>
          </div>
          {/* Emoji picker */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Ícone (usado quando sem foto):</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setImage(e)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all hover:scale-110 ${image === e ? 'bg-indigo-100 ring-2 ring-indigo-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Informações básicas */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
          <h4 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
            Informações da Área
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Nome da Área *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Salão de Festas, Churrasqueira..."
                className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${errors.name ? 'border-red-300 focus:ring-red-100 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:ring-emerald-100'}`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">⚠ {errors.name}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Descrição</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Descreva a área, equipamentos disponíveis..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none text-sm resize-none transition-all"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Capacidade *</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  placeholder="80"
                  min="1"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${errors.capacity ? 'border-red-300 focus:ring-red-100 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:ring-emerald-100'}`}
                />
                {errors.capacity && <p className="text-xs text-red-500 mt-1">⚠ {errors.capacity}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Máx. Horas *</label>
                <input
                  type="number"
                  value={maxHours}
                  onChange={e => setMaxHours(e.target.value)}
                  placeholder="8"
                  min="1"
                  max="24"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${errors.maxHours ? 'border-red-300 focus:ring-red-100 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:ring-emerald-100'}`}
                />
                {errors.maxHours && <p className="text-xs text-red-500 mt-1">⚠ {errors.maxHours}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">R$/hora</label>
                <input
                  type="number"
                  value={pricePerHour}
                  onChange={e => setPricePerHour(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none text-sm transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">0 = Grátis</p>
              </div>
            </div>
          </div>
        </div>

        {/* Regras */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
          <h4 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
            Regras de Uso
          </h4>
          <div className="space-y-2">
            {rules.map((rule, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={rule}
                  onChange={e => { const n = [...rules]; n[i] = e.target.value; setRules(n); }}
                  placeholder={`Regra ${i + 1}...`}
                  className="flex-1 px-3 py-2 rounded-xl border border-amber-200 bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 focus:outline-none text-sm transition-all"
                />
                {rules.length > 1 && (
                  <button
                    onClick={() => setRules(rules.filter((_, j) => j !== i))}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-100 text-red-500 hover:bg-red-200 text-sm font-bold transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setRules([...rules, ''])}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 mt-1"
            >
              + Adicionar regra
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={handleSave}>
            {initial?.name ? '💾 Salvar Alterações' : '✅ Criar Área'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AREA CARD — Card de área comum
// ═══════════════════════════════════════════════════════════════════════════
function AreaCard({ area, selected, onClick, reservationsCount, onEdit, onDelete, canManage }: {
  area: CommonArea; selected: boolean; onClick: () => void; reservationsCount: number;
  onEdit?: () => void; onDelete?: () => void; canManage?: boolean;
}) {
  const color = getAreaColor(area.id);
  return (
    <div className={`relative w-full rounded-2xl border-2 transition-all duration-300 overflow-hidden group
      ${selected
        ? `${color.border} shadow-lg scale-[1.02] ${color.glow}`
        : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      }`}>
      {/* Foto ou gradiente */}
      <div
        className={`h-32 sm:h-36 relative flex items-center justify-center cursor-pointer`}
        onClick={onClick}
      >
        {area.photoUrl ? (
          <>
            <img
              src={area.photoUrl}
              alt={area.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <span className="text-white font-bold text-sm drop-shadow-lg">{area.name}</span>
              {selected && (
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <span className="text-xs text-emerald-500 font-bold">✓</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${color.bg}`} />
            <span className="relative text-5xl drop-shadow-lg group-hover:scale-110 transition-transform">{area.image}</span>
            {selected && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <span className="text-xs text-emerald-500 font-bold">✓</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
          </>
        )}
      </div>
      <div className="p-3 bg-white">
        {!area.photoUrl && (
          <h3 className="font-bold text-gray-800 text-sm cursor-pointer" onClick={onClick}>{area.name}</h3>
        )}
        {area.photoUrl && (
          <h3 className="font-bold text-gray-800 text-sm cursor-pointer" onClick={onClick}>{area.name}</h3>
        )}
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{area.description}</p>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs font-bold ${color.text}`}>
            {area.pricePerHour === 0 ? '🆓 Gratuito' : `${fmtMoney(area.pricePerHour)}/h`}
          </span>
          <span className="text-xs text-gray-400">👥 {area.capacity}</span>
        </div>
        {reservationsCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-xs text-amber-600 font-medium">{reservationsCount} reserva{reservationsCount > 1 ? 's' : ''} hoje</span>
          </div>
        )}
        {/* Ações do síndico */}
        {canManage && (
          <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              className="flex-1 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
            >
              ✏️ Editar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              className="flex-1 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
            >
              🗑️ Excluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR — Calendário visual interativo
// ═══════════════════════════════════════════════════════════════════════════
function Calendar({ selectedDate, onSelectDate, reservations, areaId }: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  reservations: Reservation[];
  areaId: string;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = toDateStr(today);

  const reservedDays = useMemo(() => {
    const map: Record<string, number> = {};
    reservations.filter(r => (areaId ? r.areaId === areaId : true) && r.status === 'confirmed').forEach(r => {
      map[r.date] = (map[r.date] ?? 0) + 1;
    });
    return map;
  }, [reservations, areaId]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 sm:p-4 flex items-center justify-between">
        <button onClick={prevMonth}
          className="w-8 h-8 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center justify-center font-bold text-sm">
          ‹
        </button>
        <div className="text-center">
          <p className="text-white font-bold text-sm sm:text-base">{MONTHS_PT[viewMonth]}</p>
          <p className="text-white/70 text-xs">{viewYear}</p>
        </div>
        <button onClick={nextMonth}
          className="w-8 h-8 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center justify-center font-bold text-sm">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
        {DAYS_PT.map(d => (
          <div key={d} className="text-center py-2 text-xs font-bold text-gray-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 p-2 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isPast = dateStr < todayStr;
          const resCount = reservedDays[dateStr] ?? 0;
          return (
            <button key={day} onClick={() => !isPast && onSelectDate(dateStr)}
              disabled={isPast}
              className={`relative flex flex-col items-center justify-center rounded-xl h-8 sm:h-10 text-xs sm:text-sm font-medium transition-all duration-200
                ${isPast ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                ${isSelected ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200 scale-105' : ''}
                ${isToday && !isSelected ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-300' : ''}
                ${!isSelected && !isToday && !isPast ? 'hover:bg-gray-100 text-gray-700' : ''}
              `}>
              <span>{day}</span>
              {resCount > 0 && !isSelected && (
                <span className={`absolute bottom-0.5 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${resCount >= 3 ? 'bg-red-400' : 'bg-amber-400'}`} />
              )}
            </button>
          );
        })}
      </div>
      <div className="px-3 pb-3 flex items-center gap-3 text-xs text-gray-500 border-t border-gray-50 pt-2">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /><span>Reservado</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><span>Cheio</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-300 ring-2 ring-indigo-300" /><span>Hoje</span></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME SLOT PICKER
// ═══════════════════════════════════════════════════════════════════════════
function TimeSlotPicker({ area, date, reservations, startTime, endTime, onChangeStart, onChangeEnd }: {
  area: CommonArea; date: string; reservations: Reservation[];
  startTime: string; endTime: string;
  onChangeStart: (t: string) => void; onChangeEnd: (t: string) => void;
}) {
  const slots = generateTimeSlots(6, 23, 30);
  const color = getAreaColor(area.id);

  const busyRanges = reservations
    .filter(r => r.areaId === area.id && r.date === date && r.status === 'confirmed')
    .map(r => ({ start: r.startTime, end: r.endTime, name: r.userName }));

  const isSlotBusy = (slot: string): { busy: boolean; who?: string } => {
    for (const range of busyRanges) {
      if (slot >= range.start && slot < range.end) return { busy: true, who: range.name };
    }
    return { busy: false };
  };

  const isInSelection = (slot: string): boolean => {
    if (!startTime || !endTime) return false;
    return slot >= startTime && slot < endTime;
  };

  const handleSlotClick = (slot: string) => {
    const { busy } = isSlotBusy(slot);
    if (busy) return;
    if (!startTime || (startTime && endTime)) {
      onChangeStart(slot);
      onChangeEnd('');
    } else if (slot > startTime) {
      const proposed = addMinutes(slot, 30);
      const conflict = busyRanges.some(r => (startTime < r.end && proposed > r.start));
      if (!conflict) {
        const hours = diffHours(startTime, proposed);
        if (hours <= area.maxHours) {
          onChangeEnd(proposed);
        } else {
          alert(`⚠️ Máximo de ${area.maxHours}h para esta área.`);
        }
      } else {
        alert('⚠️ Conflito com outra reserva neste intervalo!');
      }
    } else {
      onChangeStart(slot);
      onChangeEnd('');
    }
  };

  const hours = diffHours(startTime, endTime);
  const cost = hours * area.pricePerHour;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-gray-700">Selecione o horário</p>
        <p className="text-xs text-gray-400 hidden sm:block">1º clique = início · 2º clique = fim</p>
      </div>
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex gap-1.5 min-w-max">
          {slots.map(slot => {
            const { busy, who } = isSlotBusy(slot);
            const inSel = isInSelection(slot);
            const isS = slot === startTime;
            const isE = !!endTime && slot === addMinutes(endTime, -30);
            return (
              <button key={slot} onClick={() => handleSlotClick(slot)}
                disabled={busy}
                title={busy ? `Ocupado por ${who}` : slot}
                className={`relative flex flex-col items-center rounded-xl px-1.5 sm:px-2 py-2 min-w-[44px] sm:min-w-[52px] text-xs font-medium transition-all duration-150
                  ${busy
                    ? 'bg-red-50 border-2 border-red-200 text-red-400 cursor-not-allowed'
                    : isS || isE
                      ? `bg-gradient-to-b ${color.bg} text-white border-2 border-transparent shadow-md scale-105`
                      : inSel
                        ? `${color.badge} border-2 ${color.border}`
                        : 'bg-gray-50 border-2 border-gray-100 text-gray-600 hover:bg-gray-100 hover:border-gray-200 cursor-pointer'
                  }`}>
                <span className="font-bold text-[10px] sm:text-xs">{slot}</span>
                {busy && <span className="text-[8px] mt-0.5 opacity-70">Ocup.</span>}
                {isS && <span className="text-[8px] mt-0.5">Início</span>}
                {isE && !isS && <span className="text-[8px] mt-0.5">Fim</span>}
                {inSel && !isS && !isE && <span className="text-[8px] mt-0.5 opacity-60">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
      {startTime && endTime && (
        <div className={`rounded-xl p-4 ${cost > 0 ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">⏱️ {startTime} → {endTime}</p>
              <p className="text-xs text-gray-500 mt-0.5">{hours.toFixed(1)} hora{hours !== 1 ? 's' : ''} de reserva</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-emerald-600">{cost === 0 ? '🆓 Grátis' : fmtMoney(cost)}</p>
              {cost > 0 && <p className="text-xs text-gray-400">{fmtMoney(area.pricePerHour)}/h × {hours.toFixed(1)}h</p>}
            </div>
          </div>
        </div>
      )}
      {startTime && !endTime && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-center gap-2">
          <span className="animate-pulse">⏰</span>
          <span>Início: <strong>{startTime}</strong> · Agora clique no horário de término</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESERVATION FORM MODAL
// ═══════════════════════════════════════════════════════════════════════════
function ReservationFormModal({ user, areas, allReservations, onSave, onClose }: {
  user: User; areas: CommonArea[]; allReservations: Reservation[];
  onSave: (data: Omit<Reservation, 'id' | 'createdAt'>) => void; onClose: () => void;
}) {
  const today = toDateStr(new Date());
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [obs, setObs] = useState('');

  const area = areas.find(a => a.id === selectedAreaId);
  const hours = diffHours(startTime, endTime);
  const cost = area ? hours * area.pricePerHour : 0;
  const color = area ? getAreaColor(area.id) : getAreaColor('area4');
  const canProceedStep1 = !!selectedAreaId;
  const canProceedStep2 = !!selectedDate;
  const canProceedStep3 = !!startTime && !!endTime && hours > 0;

  const handleSave = () => {
    if (!area || !selectedDate || !startTime || !endTime) return;
    onSave({
      condoId: user.condoId!, areaId: selectedAreaId, areaName: area.name,
      userId: user.id, userName: user.name, unit: user.unit!,
      date: selectedDate, startTime, endTime, totalCost: cost, status: 'confirmed',
    });
    onClose();
  };

  if (areas.length === 0) {
    return (
      <Modal title="📅 Nova Reserva" onClose={onClose}>
        <div className="text-center py-10 text-gray-400">
          <div className="text-5xl mb-3">🏗️</div>
          <p className="font-semibold text-gray-600">Nenhuma área cadastrada</p>
          <p className="text-sm mt-1">O síndico precisa cadastrar as áreas comuns primeiro.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="📅 Nova Reserva" onClose={onClose} fullscreen>
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-5">
        {[{ n: 1, label: 'Área' }, { n: 2, label: 'Data' }, { n: 3, label: 'Horário' }].map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <button
                onClick={() => {
                  if (s.n === 1 || (s.n === 2 && canProceedStep1) || (s.n === 3 && canProceedStep2 && canProceedStep1))
                    setStep(s.n as 1 | 2 | 3);
                }}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300
                  ${step === s.n ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg scale-110'
                    : step > s.n ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step > s.n ? '✓' : s.n}
              </button>
              <span className={`text-xs mt-1 font-medium ${step >= s.n ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
            </div>
            {i < 2 && (
              <div className={`flex-1 h-0.5 mx-2 transition-all duration-500 ${step > s.n ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* STEP 1: Área */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Escolha a área que deseja reservar:</p>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {areas.map(a => {
              const todayRes = allReservations.filter(r => r.areaId === a.id && r.date === today && r.status === 'confirmed').length;
              return (
                <div key={a.id} onClick={() => setSelectedAreaId(a.id)} className="cursor-pointer">
                  <AreaCard area={a} selected={selectedAreaId === a.id} onClick={() => setSelectedAreaId(a.id)} reservationsCount={todayRes} />
                </div>
              );
            })}
          </div>
          {area && (
            <div className={`rounded-2xl border ${color.border} bg-gradient-to-br from-white to-gray-50 p-4 space-y-3`}>
              <div className="flex items-center gap-3">
                {area.photoUrl ? (
                  <img src={area.photoUrl} alt={area.name} className="w-12 h-12 rounded-xl object-cover border-2 border-gray-200" />
                ) : (
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center text-2xl shadow-md`}>{area.image}</div>
                )}
                <div>
                  <h4 className={`font-bold ${color.text}`}>{area.name}</h4>
                  <p className="text-xs text-gray-500">{area.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: '👥', label: 'Capacidade', value: `${area.capacity} pessoas` },
                  { icon: '⏱️', label: 'Máximo', value: `${area.maxHours}h` },
                  { icon: '💰', label: 'Valor', value: area.pricePerHour === 0 ? 'Grátis' : `${fmtMoney(area.pricePerHour)}/h` },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-xl p-2.5 text-center border border-gray-100 shadow-sm">
                    <div className="text-base sm:text-lg">{item.icon}</div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                    <p className={`text-xs font-bold mt-0.5 ${color.text}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              {area.rules.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <p className="text-xs font-bold text-amber-700 mb-1">📋 Regras:</p>
                  <ul className="space-y-0.5">
                    {area.rules.map((r, i) => <li key={i} className="text-xs text-amber-600">• {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Btn variant="primary" disabled={!canProceedStep1} onClick={() => setStep(2)}>Próximo: Escolher Data →</Btn>
          </div>
        </div>
      )}

      {/* STEP 2: Data */}
      {step === 2 && area && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} reservations={allReservations} areaId={selectedAreaId} />
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 bg-gradient-to-br from-white to-gray-50 border ${color.border}`}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Data Selecionada</p>
                <p className={`text-xl font-black ${color.text}`}>{fmtDate(selectedDate)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">📅 Reservas neste dia</p>
                {allReservations.filter(r => r.areaId === selectedAreaId && r.date === selectedDate && r.status === 'confirmed').length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-1">✅</div>
                    <p className="text-sm text-emerald-600 font-semibold">Dia disponível!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allReservations
                      .filter(r => r.areaId === selectedAreaId && r.date === selectedDate && r.status === 'confirmed')
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map(r => (
                        <div key={r.id} className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl">
                          <div className="w-1.5 h-8 bg-red-400 rounded-full" />
                          <div>
                            <p className="text-xs font-bold text-red-700">{r.startTime} – {r.endTime}</p>
                            <p className="text-xs text-red-500">{r.userName}</p>
                          </div>
                          <span className="ml-auto text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Ocupado</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <Btn variant="secondary" onClick={() => setStep(1)}>← Voltar</Btn>
            <Btn variant="primary" disabled={!canProceedStep2} onClick={() => setStep(3)}>Próximo: Escolher Horário →</Btn>
          </div>
        </div>
      )}

      {/* STEP 3: Horário */}
      {step === 3 && area && (
        <div className="space-y-4">
          <div className={`rounded-xl p-3 flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white border ${color.border}`}>
            {area.photoUrl ? (
              <img src={area.photoUrl} alt={area.name} className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <span className="text-2xl">{area.image}</span>
            )}
            <div>
              <p className="font-bold text-gray-800 text-sm">{area.name}</p>
              <p className={`text-xs font-semibold ${color.text}`}>📅 {fmtDate(selectedDate)}</p>
            </div>
          </div>
          <TimeSlotPicker
            area={area} date={selectedDate} reservations={allReservations}
            startTime={startTime} endTime={endTime}
            onChangeStart={t => { setStartTime(t); setEndTime(''); }}
            onChangeEnd={setEndTime}
          />
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Observações (opcional)</label>
            <textarea
              value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Descreva o evento, número de convidados..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm resize-none transition-all"
            />
          </div>
          {startTime && endTime && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-indigo-800 mb-3">📋 Resumo da Reserva</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Área', value: area.name },
                  { label: 'Data', value: fmtDate(selectedDate) },
                  { label: 'Horário', value: `${startTime} às ${endTime}` },
                  { label: 'Duração', value: `${hours.toFixed(1)}h` },
                  { label: 'Valor Total', value: cost === 0 ? 'Grátis' : fmtMoney(cost) },
                  { label: 'Unidade', value: user.unit ?? '-' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col text-sm bg-white rounded-xl p-2.5 border border-indigo-100">
                    <span className="text-gray-400 text-xs">{item.label}</span>
                    <span className="font-semibold text-gray-800 text-xs sm:text-sm">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-between">
            <Btn variant="secondary" onClick={() => setStep(2)}>← Voltar</Btn>
            <Btn variant="success" disabled={!canProceedStep3} onClick={handleSave}>✅ Confirmar Reserva</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESERVATION DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════
function ReservationDetailModal({ res, onClose, onCancel, canCancel }: {
  res: Reservation; onClose: () => void; onCancel: () => void; canCancel: boolean;
}) {
  const today = toDateStr(new Date());
  const diffDays = Math.ceil((new Date(res.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
  const willFine = diffDays < 2;
  const color = getAreaColor(res.areaId);

  return (
    <Modal title="📋 Detalhes da Reserva" onClose={onClose}>
      <div className="space-y-4">
        <div className={`rounded-2xl p-5 bg-gradient-to-br ${color.bg} text-white`}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-lg">{res.areaName}</p>
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${res.status === 'confirmed' ? 'bg-white/20' : 'bg-red-200/30'}`}>
              {res.status === 'confirmed' ? '✅ Confirmada' : '❌ Cancelada'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '📅 Data', value: fmtDate(res.date) },
              { label: '⏱️ Horário', value: `${res.startTime} → ${res.endTime}` },
              { label: '💰 Valor', value: res.totalCost === 0 ? 'Grátis' : fmtMoney(res.totalCost) },
              { label: '🏠 Unidade', value: res.unit },
            ].map(item => (
              <div key={item.label}>
                <p className="text-white/70 text-xs">{item.label}</p>
                <p className="font-bold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Morador:</span>
            <span className="font-semibold text-gray-800">{res.userName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Feita em:</span>
            <span className="font-semibold text-gray-800">{fmtDate(res.createdAt)}</span>
          </div>
        </div>
        {canCancel && res.status === 'confirmed' && willFine && res.totalCost > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚠️</span>
              <p className="font-bold text-red-700 text-sm">Multa por cancelamento tardio</p>
            </div>
            <p className="text-xs text-red-600">
              Esta reserva está a menos de 48h. Multa de <strong>{fmtMoney(res.totalCost * 0.5)}</strong> (50% do valor).
            </p>
          </div>
        )}
        {res.status === 'cancelled' && res.cancellationFine && res.cancellationFine > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-xs font-bold text-orange-700">💸 Multa aplicada: {fmtMoney(res.cancellationFine)}</p>
          </div>
        )}
        <div className="flex gap-3">
          <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
          {canCancel && res.status === 'confirmed' && (
            <Btn variant="danger" onClick={onCancel}>
              ❌ {willFine && res.totalCost > 0 ? 'Cancelar (com multa)' : 'Cancelar Reserva'}
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENDA VIEW
// ═══════════════════════════════════════════════════════════════════════════
function AgendaView({ reservations, areas, selectedDate, onSelectRes }: {
  reservations: Reservation[]; areas: CommonArea[]; selectedDate: string;
  onSelectRes: (r: Reservation) => void;
}) {
  const dayRes = reservations
    .filter(r => r.date === selectedDate && r.status === 'confirmed')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  if (dayRes.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-100">
        <div className="text-4xl mb-2">📅</div>
        <p className="font-medium text-gray-500">Nenhuma reserva para {fmtDate(selectedDate)}</p>
        <p className="text-sm mt-1">Dia totalmente disponível!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <p className="font-bold text-gray-800 text-sm">📅 Agenda — {fmtDate(selectedDate)}</p>
        <Badge label={`${dayRes.length} reserva${dayRes.length > 1 ? 's' : ''}`} color="blue" />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="flex border-b border-gray-100">
            <div className="w-24 sm:w-28 shrink-0 bg-gray-50 border-r border-gray-100" />
            <div className="flex flex-1">
              {hours.map(h => (
                <div key={h} className="flex-1 text-center text-xs text-gray-400 py-2 border-r border-gray-50 font-medium">{h}h</div>
              ))}
            </div>
          </div>
          {areas.map(area => {
            const areaRes = dayRes.filter(r => r.areaId === area.id);
            const color = getAreaColor(area.id);
            return (
              <div key={area.id} className="flex border-b border-gray-50 hover:bg-gray-50/50" style={{ height: 52 }}>
                <div className="w-24 sm:w-28 shrink-0 border-r border-gray-100 flex items-center gap-2 px-2 sm:px-3">
                  <span className="text-base sm:text-lg">{area.image}</span>
                  <span className="text-xs font-semibold text-gray-600 truncate hidden sm:block">{area.name}</span>
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-0 flex pointer-events-none">
                    {hours.map(h => <div key={h} className="flex-1 border-r border-gray-50" />)}
                  </div>
                  {areaRes.map(r => {
                    const totalMinutes = 17 * 60;
                    const startMin = parseTime(r.startTime) - 6 * 60;
                    const endMin = parseTime(r.endTime) - 6 * 60;
                    const left = (startMin / totalMinutes) * 100;
                    const width = ((endMin - startMin) / totalMinutes) * 100;
                    return (
                      <button key={r.id} onClick={() => onSelectRes(r)}
                        title={`${r.startTime}–${r.endTime} · ${r.userName}`}
                        className={`absolute top-1.5 bottom-1.5 rounded-lg bg-gradient-to-r ${color.bg} text-white text-xs font-semibold px-2 flex items-center overflow-hidden hover:opacity-90 transition-all shadow-sm`}
                        style={{ left: `${left}%`, width: `${width}%` }}>
                        <span className="truncate">{r.startTime} {r.userName.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RESERVATIONS SECTION
// ═══════════════════════════════════════════════════════════════════════════
export function ReservationsSection({ user, store }: {
  user: User;
  store: ReturnType<typeof useStore>;
}) {
  const [view, setView] = useState<'overview' | 'calendar' | 'myres' | 'manage'>('overview');
  const [showForm, setShowForm] = useState(false);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [editArea, setEditArea] = useState<CommonArea | null>(null);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [agendaDate, setAgendaDate] = useState(toDateStr(new Date()));
  const [fineMsg, setFineMsg] = useState<string | null>(null);

  const areas = store.getCommonAreas(user.condoId!);
  const allRes = store.getReservations(user.condoId!);
  const myRes = user.role === 'morador' ? allRes.filter(r => r.userId === user.id) : allRes;
  const today = toDateStr(new Date());

  const isSindico = user.role === 'sindico' || user.role === 'admin';
  const isMorador = user.role === 'morador';

  const handleAddReservation = (data: Omit<Reservation, 'id' | 'createdAt'>) => {
    store.addReservation(data);
  };

  const handleCancel = (id: string) => {
    const res = allRes.find(r => r.id === id);
    if (!res) return;
    const diffDays = Math.ceil((new Date(res.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    const willFine = !isSindico && diffDays < 2 && res.totalCost > 0;
    const confirmMsg = willFine
      ? `⚠️ Multa de ${fmtMoney(res.totalCost * 0.5)} por cancelamento tardio. Confirmar?`
      : 'Deseja cancelar esta reserva?';
    if (!confirm(confirmMsg)) return;
    const msg = store.cancelReservation(id, isSindico);
    if (msg) setFineMsg(msg);
    setSelectedRes(null);
  };

  const handleSaveArea = (data: Omit<CommonArea, 'id'>) => {
    if (editArea) {
      store.updateCommonArea(editArea.id, data);
    } else {
      store.addCommonArea(data);
    }
    setEditArea(null);
    setShowAreaForm(false);
  };

  const todayRes = allRes.filter(r => r.date === today && r.status === 'confirmed');
  const thisWeekRes = allRes.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    const startWeek = new Date(now); startWeek.setDate(now.getDate() - now.getDay());
    const endWeek = new Date(startWeek); endWeek.setDate(startWeek.getDate() + 6);
    return d >= startWeek && d <= endWeek && r.status === 'confirmed';
  });
  const totalRevenue = allRes.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.totalCost, 0);
  const myActiveRes = myRes.filter(r => r.status === 'confirmed' && r.date >= today);

  const tabs = [
    { key: 'overview', label: '🏠 Visão Geral' },
    { key: 'calendar', label: '📅 Agenda' },
    { key: 'myres', label: isMorador ? '📋 Minhas Reservas' : '📋 Todas as Reservas' },
    ...(isSindico ? [{ key: 'manage', label: '⚙️ Gerenciar Áreas' }] : []),
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Fine alert */}
      {fineMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">💸</span>
          <div>
            <p className="font-bold text-red-700">Multa por cancelamento tardio</p>
            <p className="text-sm text-red-600">{fineMsg}</p>
          </div>
          <button onClick={() => setFineMsg(null)} className="ml-auto text-gray-400 hover:text-gray-600 font-bold">✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: '📅', label: 'Hoje', value: todayRes.length, sub: 'reservas', color: 'from-violet-500 to-purple-600' },
          { icon: '📆', label: 'Esta Semana', value: thisWeekRes.length, sub: 'reservas', color: 'from-blue-500 to-indigo-600' },
          { icon: '💰', label: 'Receita Total', value: fmtMoney(totalRevenue), sub: 'em reservas', color: 'from-emerald-500 to-teal-600' },
          { icon: '🏢', label: 'Minhas Ativas', value: myActiveRes.length, sub: 'próximas', color: 'from-orange-500 to-red-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 flex items-center gap-3 hover:shadow-md transition-all hover:-translate-y-0.5 group">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-lg sm:text-xl shadow-md group-hover:scale-110 transition-transform`}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">{stat.label}</p>
              <p className="text-base sm:text-lg font-black text-gray-800 truncate">{stat.value}</p>
              <p className="text-xs text-gray-400 hidden sm:block">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto w-full sm:w-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key as typeof view)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${view === tab.key ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {isMorador && (
            <Btn variant="primary" onClick={() => setShowForm(true)}>📅 Nova Reserva</Btn>
          )}
          {isSindico && view === 'manage' && (
            <Btn variant="primary" onClick={() => { setEditArea(null); setShowAreaForm(true); }}>
              ➕ Nova Área
            </Btn>
          )}
        </div>
      </div>

      {/* VIEW: OVERVIEW */}
      {view === 'overview' && (
        <div className="space-y-5">
          {areas.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
              <div className="text-5xl mb-3">🏗️</div>
              <p className="font-semibold text-gray-600">Nenhuma área cadastrada</p>
              {isSindico && <p className="text-sm mt-1">Acesse "Gerenciar Áreas" para cadastrar as áreas comuns.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {areas.map(area => {
                const todayCount = allRes.filter(r => r.areaId === area.id && r.date === today && r.status === 'confirmed').length;
                const myNextRes = myRes.find(r => r.areaId === area.id && r.date >= today && r.status === 'confirmed');
                const color = getAreaColor(area.id);
                return (
                  <div key={area.id} className={`bg-white rounded-2xl border-2 ${color.border} shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden group`}>
                    {/* Foto ou gradiente */}
                    <div className={`h-24 sm:h-32 relative flex items-center justify-center`}>
                      {area.photoUrl ? (
                        <>
                          <img src={area.photoUrl} alt={area.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                          <span className="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full bg-black/40 text-white">
                            {todayCount === 0 ? '🟢 Livre' : `${todayCount} reservas`}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className={`absolute inset-0 bg-gradient-to-br ${color.bg}`} />
                          <span className="relative text-4xl sm:text-5xl drop-shadow-lg group-hover:scale-110 transition-transform">{area.image}</span>
                          <span className="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full bg-black/30 text-white">
                            {todayCount === 0 ? '🟢 Livre' : `${todayCount}`}
                          </span>
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                        </>
                      )}
                    </div>
                    <div className="p-3 sm:p-4">
                      <h3 className="font-bold text-gray-800 mb-1 text-sm sm:text-base">{area.name}</h3>
                      <p className="text-xs text-gray-500 mb-2 sm:mb-3 line-clamp-2">{area.description}</p>
                      <div className="space-y-1 mb-2 sm:mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">👥</span>
                          <span className="font-semibold">{area.capacity} pessoas</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">⏱️</span>
                          <span className="font-semibold">{area.maxHours}h máx.</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">💰</span>
                          <span className={`font-bold ${color.text}`}>
                            {area.pricePerHour === 0 ? 'Grátis' : `${fmtMoney(area.pricePerHour)}/h`}
                          </span>
                        </div>
                      </div>
                      {myNextRes && (
                        <div className={`${color.badge} rounded-lg p-2 text-xs mb-2`}>
                          <p className="font-bold">Sua próxima:</p>
                          <p>{fmtDate(myNextRes.date)} · {myNextRes.startTime}–{myNextRes.endTime}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Próximas reservas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">🗓️ Próximas Reservas (7 dias)</h3>
            </div>
            <div className="p-4">
              {allRes.filter(r => r.date >= today && r.date <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] && r.status === 'confirmed').length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p>Nenhuma reserva nos próximos 7 dias</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allRes
                    .filter(r => r.date >= today && r.date <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] && r.status === 'confirmed')
                    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                    .map(r => {
                      const color = getAreaColor(r.areaId);
                      const isMyRes = r.userId === user.id;
                      const area = areas.find(a => a.id === r.areaId);
                      return (
                        <button key={r.id} onClick={() => setSelectedRes(r)}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5
                            ${isMyRes ? `${color.border} bg-gradient-to-r from-white to-gray-50` : 'border-gray-100 hover:border-gray-200'}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow flex-shrink-0 overflow-hidden`}>
                            {area?.photoUrl ? (
                              <img src={area.photoUrl} alt={area.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${color.bg} flex items-center justify-center`}>{area?.image ?? '🏢'}</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-800 text-sm">{r.areaName}</p>
                              {isMyRes && <Badge label="Sua" color="violet" />}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{fmtDate(r.date)} · {r.startTime}–{r.endTime} · {r.userName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-bold ${color.text}`}>
                              {r.totalCost === 0 ? 'Grátis' : fmtMoney(r.totalCost)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: CALENDAR */}
      {view === 'calendar' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <Calendar selectedDate={agendaDate} onSelectDate={setAgendaDate} reservations={allRes} areaId="" />
            </div>
            <div className="lg:col-span-2">
              <AgendaView reservations={allRes} areas={areas} selectedDate={agendaDate} onSelectRes={setSelectedRes} />
            </div>
          </div>
        </div>
      )}

      {/* VIEW: LIST */}
      {view === 'myres' && (
        <div className="space-y-3">
          {myRes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-medium">Nenhuma reserva encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myRes.sort((a, b) => b.date.localeCompare(a.date)).map((r, i) => {
                const color = getAreaColor(r.areaId);
                const isPast = r.date < today;
                const diffDays = Math.ceil((new Date(r.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
                const area = areas.find(a => a.id === r.areaId);
                return (
                  <div key={r.id} style={{ animationDelay: `${i * 40}ms` }}
                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${r.status === 'confirmed' ? color.border : 'border-gray-200'}`}>
                    <div className="flex items-stretch">
                      <div className={`w-2 bg-gradient-to-b ${r.status === 'confirmed' ? color.bg : 'from-gray-300 to-gray-400'} shrink-0`} />
                      <div className="flex-1 p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow flex-shrink-0 overflow-hidden`}>
                              {area?.photoUrl ? (
                                <img src={area.photoUrl} alt={area.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${r.status === 'confirmed' ? color.bg : 'from-gray-200 to-gray-300'} flex items-center justify-center`}>
                                  {area?.image ?? '🏢'}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-sm">{r.areaName}</p>
                              <p className="text-xs text-gray-500">{fmtDate(r.date)} · {r.startTime}–{r.endTime}</p>
                              {isSindico && <p className="text-xs text-gray-400">{r.userName} · Unid. {r.unit}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              label={r.status === 'confirmed' ? (isPast ? '✅ Realizada' : '🟢 Confirmada') : '❌ Cancelada'}
                              color={r.status === 'confirmed' ? (isPast ? 'gray' : 'green') : 'red'}
                            />
                            {!isPast && r.status === 'confirmed' && diffDays === 0 && <Badge label="Hoje!" color="purple" />}
                            {!isPast && r.status === 'confirmed' && diffDays === 1 && <Badge label="Amanhã" color="orange" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold ${r.status === 'confirmed' ? color.text : 'text-gray-400'}`}>
                              {r.totalCost === 0 ? '🆓 Grátis' : fmtMoney(r.totalCost)}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Btn size="sm" variant="ghost" onClick={() => setSelectedRes(r)}>Detalhes</Btn>
                            {r.status === 'confirmed' && !isPast && (
                              <Btn size="sm" variant="danger" onClick={() => handleCancel(r.id)}>❌ Cancelar</Btn>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: MANAGE AREAS (Síndico) */}
      {view === 'manage' && isSindico && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{areas.length} área{areas.length !== 1 ? 's' : ''} cadastrada{areas.length !== 1 ? 's' : ''}</p>
            <Btn variant="primary" onClick={() => { setEditArea(null); setShowAreaForm(true); }}>
              ➕ Nova Área
            </Btn>
          </div>
          {areas.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
              <div className="text-5xl mb-3">🏗️</div>
              <p className="font-semibold text-gray-600 mb-2">Nenhuma área cadastrada</p>
              <p className="text-sm">Clique em "Nova Área" para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {areas.map(area => {
                const todayCount = allRes.filter(r => r.areaId === area.id && r.date === today && r.status === 'confirmed').length;
                return (
                  <AreaCard
                    key={area.id}
                    area={area}
                    selected={false}
                    onClick={() => { }}
                    reservationsCount={todayCount}
                    canManage
                    onEdit={() => { setEditArea(area); setShowAreaForm(true); }}
                    onDelete={() => {
                      if (confirm(`Excluir "${area.name}"? Todas as reservas serão canceladas.`)) {
                        store.deleteCommonArea(area.id);
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {showForm && (
        <ReservationFormModal
          user={user} areas={areas} allReservations={allRes}
          onSave={handleAddReservation} onClose={() => setShowForm(false)}
        />
      )}
      {showAreaForm && (
        <AreaFormModal
          initial={editArea ?? undefined}
          condoId={user.condoId!}
          onSave={handleSaveArea}
          onClose={() => { setShowAreaForm(false); setEditArea(null); }}
        />
      )}
      {selectedRes && (
        <ReservationDetailModal
          res={selectedRes} onClose={() => setSelectedRes(null)}
          onCancel={() => handleCancel(selectedRes.id)}
          canCancel={isSindico || selectedRes.userId === user.id}
        />
      )}
    </div>
  );
}
