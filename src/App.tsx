import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { useStore, formatCPF, validateCPF } from './store';
import { QRScannerCamera } from './QRScanner';
import { ReservationsSection } from './ReservationsModule';
import { MarketplaceSection } from './Marketplace';
import { ToastContainer, useToasts } from './PushNotificationSystem';
import { WhatsAppChatSection } from './WhatsAppChat';
import { MaintenanceSection, DocumentsSection, AccessControlSection, LostFoundSection, ReportsSection } from './MissingFeatures';
import { GatewayConfigSection } from './GatewayConfig';
import { PaymentGatewayUI as MasterGatewayUI } from './PaymentGatewayUIv2';
import { SindicoGatewayUI } from './SindicoGatewayUI';
import { LandingPage } from './LandingPage';
import { LicenseSindicoPanel } from './LicensePayment';
import { SupportCenterSection } from './SupportCenter';
import { ApiDashboard } from './pages/ApiDashboard';
import { CondoManagement } from './pages/CondoManagement';
import { LicenseAdmin } from './pages/LicenseAdmin';
import { AssemblySection } from './AssemblySection';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import type { User, UserRole, Employee } from './types';
import { useTheme, Theme, ThemeId } from './ThemeContext';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('pt-BR');
}
function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtCPFInput(e: React.ChangeEvent<HTMLInputElement>, set: (v: string) => void) {
  set(formatCPF(e.target.value));
}
function calcAge(birth: string): number {
  const b = new Date(birth);
  const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
}

// ─── QR CODE CANVAS ──────────────────────────────────────────────────────────
function QRCanvas({ data, size = 180 }: { data: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && data) {
      QRCode.toCanvas(ref.current, data, { width: size, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } });
    }
  }, [data, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'panel-tag success',
    red: 'panel-tag error',
    yellow: 'panel-tag warning',
    blue: 'panel-tag info',
    purple: 'panel-tag info',
    gray: 'panel-tag',
    orange: 'panel-tag warning',
  };
  return <span className={colors[color] || colors.gray}>{label}</span>;
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-3 sm:p-4 pt-8 sm:pt-12 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        className={`panel-modal-refined w-full ${wide ? 'max-w-2xl lg:max-w-3xl' : 'max-w-md lg:max-w-lg'} max-h-[92vh] overflow-y-auto panel-animate-fade mb-8`}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.92)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 className="text-base sm:text-lg font-black text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-red-500 transition-all duration-200 text-lg font-bold">✕</button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, error, children, required }: { label: string; error?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-red-600">
          <span>!</span>
          {error}
        </p>
      )}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const { error, className, ...rest } = props;
  return (
    <input
      {...rest}
      className={`panel-input-refined ${error ? 'border-red-300 bg-red-50' : ''} ${className ?? ''}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`panel-input-refined ${props.className ?? ''}`}
    >
      {props.children}
    </select>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`panel-input-refined resize-none ${props.className ?? ''}`}
    />
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: string | number; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-indigo-600'
  };

  const iconGradient = colors[color];

  return (
    <div
      className="panel-stat-refined group"
    >
      <div className="flex items-start gap-4">
        <div
          className={`panel-stat-icon flex-shrink-0 ${iconGradient ? `bg-gradient-to-br ${iconGradient}` : ''}`}
          style={iconGradient ? undefined : { background: 'linear-gradient(135deg, #06b6d4, #10b981)' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-800 group-hover:text-cyan-700 transition-colors">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function Table({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: string }) {
  return (
    <div className="panel-card-refined overflow-hidden">
      <table className="panel-table-refined">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {!children || (Array.isArray(children) && children.length === 0) ? (
        <div className="panel-empty-state">
          <div className="panel-empty-icon">📋</div>
          <p className="panel-empty-title">{empty || 'Nenhum dado encontrado'}</p>
          <p className="panel-empty-desc">Os dados aparecerão aqui quando estiverem disponíveis.</p>
        </div>
      ) : null}
    </div>
  );
}

function TR({ children, idx }: { children: React.ReactNode; idx?: number }) {
  return (
    <tr className="transition-colors hover:bg-[var(--theme-accent-soft,rgba(99,102,241,0.08))]" style={{ animationDelay: `${(idx ?? 0) * 50}ms` }}>
      {children}
    </tr>
  );
}

function TD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-700 ${className ?? ''}`}>{children}</td>;
}

function Btn({ children, onClick, variant = 'primary', size = 'md', type = 'button', disabled }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'danger' | 'success' | 'secondary' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg'; type?: 'button' | 'submit'; disabled?: boolean;
}) {
  const variants: Record<'primary' | 'danger' | 'success' | 'secondary' | 'warning' | 'ghost', { className: string; style?: React.CSSProperties }> = {
    primary: {
      className: 'text-[var(--theme-accent-text,#fff)] shadow-indigo-200 btn-glow-indigo btn-gradient-anim',
      style: { background: 'var(--theme-accent, linear-gradient(135deg, #06b6d4, #10b981))' }
    },
    danger: {
      className: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-200 btn-glow-red'
    },
    success: {
      className: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-200 btn-glow-green'
    },
    secondary: {
      className: 'border text-slate-700 btn-glow-white',
      style: {
        background: 'var(--card-bg, rgba(255,255,255,0.92))',
        borderColor: 'var(--card-border, rgba(148, 163, 184, 0.32))'
      }
    },
    warning: {
      className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-200 btn-glow-orange'
    },
    ghost: {
      className: 'bg-transparent text-slate-600 hover:bg-slate-100'
    }
  };

  const config = variants[variant];
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={config.style}
      className={`btn-animated btn-pulse-ring inline-flex items-center gap-2 rounded-xl font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus-ring,rgba(99,102,241,0.24))] disabled:cursor-not-allowed disabled:opacity-50 ${config.className} ${sizes[size]}`}
    >
      {children}
    </button>
  );
}
interface UserFormProps {
  onClose: () => void;
  onSave: (data: Partial<User>) => void;
  initial?: Partial<User>;
  condoOptions: { id: string; name: string }[];
  isEdit?: boolean;
}

function UserFormModal({ onClose, onSave, initial, condoOptions, isEdit }: UserFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [cpf, setCpf] = useState(initial?.cpf ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'morador');
  const [condoId, setCondoId] = useState(initial?.condoId ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPass, setShowPass] = useState(false);
  const [photo, setPhoto] = useState<string>(initial?.photo ?? '');
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { setShowCamera(false); alert('Câmera não disponível.'); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    setPhoto(c.toDataURL('image/jpeg', 0.8));
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 3) e.name = 'Nome completo é obrigatório (mín. 3 caracteres)';
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'E-mail inválido';
    if (!isEdit && password.length < 6) e.password = 'Senha deve ter no mínimo 6 caracteres';
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) e.cpf = 'CPF deve ter 11 dígitos';
    else if (!validateCPF(cpf)) e.cpf = 'CPF inválido';
    if (!birthDate) e.birthDate = 'Data de nascimento é obrigatória';
    else {
      const age = calcAge(birthDate);
      if (age < 0 || age > 120) e.birthDate = 'Data de nascimento inválida';
      if (age < 18) e.birthDate = 'Usuário deve ter no mínimo 18 anos';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({ name: name.trim(), email: email.trim(), password, cpf, birthDate, phone, role, condoId: condoId || undefined, unit: unit || undefined, active: true, photo: photo || undefined });
    onClose();
  };

  const roleLabels: Record<string, string> = {
    admin: '👨‍💼 Admin Master',
    sindico: '🏢 Síndico',
    porteiro: '🚪 Porteiro',
    morador: '🏠 Morador',
  };

  const age = birthDate ? calcAge(birthDate) : null;

  return (
    <Modal title={isEdit ? '✏️ Editar Usuário' : '➕ Novo Usuário'} onClose={onClose} wide>
      <div className="space-y-5">

        {/* FOTO DO USUÁRIO */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs">📷</span>
            Foto do Usuário
          </h4>
          <div className="flex items-center gap-4">
            {/* Preview da foto */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center">
                {photo ? (
                  <img src={photo} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <div className="text-3xl">👤</div>
                    <p className="text-xs text-gray-400 mt-1">Sem foto</p>
                  </div>
                )}
              </div>
              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto('')}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 shadow-md"
                >✕</button>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex-1 space-y-2">
              <p className="text-xs text-gray-500">Adicione uma foto tirada com a câmera ou escolha um arquivo do dispositivo.</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  📷 Tirar Foto (Câmera)
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors border border-gray-200"
                >
                  📁 Escolher Arquivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              <p className="text-xs text-gray-400">JPG, PNG ou WebP · Máx. 5MB</p>
            </div>
          </div>

          {/* Câmera ao vivo */}
          {showCamera && (
            <div className="mt-4 rounded-2xl overflow-hidden border-2 border-indigo-300 bg-black relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-64 object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={takePhoto}
                  className="px-5 py-2.5 bg-white text-gray-900 font-black rounded-full text-sm shadow-lg hover:bg-indigo-50 transition-colors flex items-center gap-2"
                >
                  📸 Capturar Foto
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 bg-red-500 text-white font-bold rounded-full text-sm shadow-lg hover:bg-red-600 transition-colors"
                >
                  ✕ Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* INFORMAÇÕES PESSOAIS */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
          <h4 className="text-sm font-bold text-indigo-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
            Informações Pessoais
          </h4>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Nome Completo" required error={errors.name}>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: João da Silva Santos"
                error={!!errors.name}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="CPF" required error={errors.cpf}>
                <Input
                  value={cpf}
                  onChange={e => fmtCPFInput(e, setCpf)}
                  placeholder="000.000.000-00"
                  error={!!errors.cpf}
                  maxLength={14}
                />
              </Field>
              <Field label="Data de Nascimento" required error={errors.birthDate}>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  error={!!errors.birthDate}
                  max={new Date().toISOString().split('T')[0]}
                />
              </Field>
            </div>
            {age !== null && age >= 0 && (
              <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                <span>🎂</span>
                <span><strong>{age} anos</strong> de idade</span>
              </div>
            )}
            <Field label="Telefone">
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
              />
            </Field>
          </div>
        </div>

        {/* ACESSO AO PAINEL */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
          <h4 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
            Acesso ao Dashboard
          </h4>
          <div className="grid grid-cols-1 gap-4">
            <Field label="E-mail (login)" required error={errors.email}>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                error={!!errors.email}
              />
            </Field>
            <Field label={isEdit ? 'Nova Senha (deixe vazio para manter)' : 'Senha de Acesso'} required={!isEdit} error={errors.password}>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isEdit ? 'Nova senha (opcional)' : 'Mínimo 6 caracteres'}
                  error={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {password && password.length < 6 && (
                <div className="flex gap-1 mt-1">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${password.length >= i ? 'bg-red-400' : 'bg-gray-200'}`} />
                  ))}
                </div>
              )}
              {password && password.length >= 6 && (
                <div className="flex gap-1 mt-1">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${password.length >= i + 2 ? 'bg-emerald-400' : password.length >= i ? 'bg-amber-400' : 'bg-gray-200'}`} />
                  ))}
                </div>
              )}
            </Field>
          </div>
        </div>

        {/* PERFIL E CONDOMÍNIO */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
          <h4 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
            Perfil e Condomínio
          </h4>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Perfil / Função" required>
              <Select value={role} onChange={e => setRole(e.target.value as UserRole)}>
                {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            {role !== 'admin' && (
              <Field label="Condomínio">
                <Select value={condoId} onChange={e => setCondoId(e.target.value)}>
                  <option value="">Selecionar condomínio...</option>
                  {condoOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            )}
            {(role === 'morador' || role === 'sindico') && (
              <Field label="Unidade / Apartamento">
                <Input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="Ex: 101-A, AP 202, Bloco B-304"
                />
              </Field>
            )}
          </div>
        </div>

        {/* RESUMO */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">📋 Resumo do Cadastro</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span className={name.trim().length >= 3 ? 'text-emerald-500' : 'text-gray-300'}>✓</span>
              <span>Nome completo</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={cpf.replace(/\D/g,'').length === 11 ? 'text-emerald-500' : 'text-gray-300'}>✓</span>
              <span>CPF</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={birthDate ? 'text-emerald-500' : 'text-gray-300'}>✓</span>
              <span>Data de nascimento</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={email.includes('@') ? 'text-emerald-500' : 'text-gray-300'}>✓</span>
              <span>E-mail</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={(isEdit || password.length >= 6) ? 'text-emerald-500' : 'text-gray-300'}>✓</span>
              <span>Senha de acesso</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-emerald-500">✓</span>
              <span>Perfil: {roleLabels[role]}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={handleSubmit} type="submit">
            {isEdit ? '💾 Salvar Alterações' : '✅ Criar Usuário'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}



// ═══════════════════════════════════════════════════════════════════════════
// LOGIN SCREEN — MODERNO E SOFISTICADO
// ═══════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const store = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const login = async () => {
    if (!email || !password) { setError('Preencha e-mail e senha.'); return; }
    setLoading(true);
    let backendAuthError = '';

    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const authData = await authRes.json().catch(() => ({}));

      if (authRes.ok && authData?.user) {
        if (authData?.token) {
          localStorage.setItem('auth_token', authData.token);
          localStorage.setItem('authToken', authData.token);
        }

        const localUser = store.getUsers().find(u => u.id === authData.user.id || u.email === authData.user.email);
        const mergedUser = localUser
          ? { ...localUser, ...authData.user, password: localUser.password }
          : ({
              ...authData.user,
              password,
              birthDate: authData.user.birthDate || '1990-01-01',
              cpf: authData.user.cpf || '000.000.000-00',
              createdAt: authData.user.createdAt || new Date().toISOString(),
              active: authData.user.active !== false
            } as User);

        onLogin(mergedUser);
        setLoading(false);
        return;
      }

      if (authRes.status === 401 || authRes.status === 403) {
        backendAuthError = authData?.error || 'E-mail ou senha incorretos.';
      }
    } catch {
      // fallback local
    }

    await new Promise(r => setTimeout(r, 500));
    const user = store.getUsers().find(u => u.email === email && u.password === password && u.active);
    if (user) {
      if (user.role === 'admin') {
        onLogin(user);
      } else if (user.condoId) {
        const condo = store.getCondos().find(c => c.id === user.condoId);
        if (condo?.blocked) {
          setError('Acesso suspenso! A licença do seu condomínio está em atraso.');
          setLoading(false);
          return;
        }
        onLogin(user);
      } else {
        onLogin(user);
      }
    } else {
      setError(backendAuthError || 'E-mail ou senha incorretos.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: '#050810' }}>

      {/* ── CIDADE AO FUNDO — fullscreen ── */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=85&w=2560"
          alt="cidade"
          className="w-full h-full object-cover object-center"
          style={{ filter: 'brightness(0.55) saturate(0.7)' }}
        />
        {/* Gradiente escurecendo base e topo */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(5,8,16,0.65) 0%, rgba(5,8,16,0.30) 40%, rgba(5,8,16,0.75) 100%)'
        }} />
        {/* Luzes de cidade ciano/azul */}
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 right-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="relative z-10 flex w-full min-h-screen items-center justify-center px-4 py-12">

        <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-stretch gap-10 lg:gap-16">

          {/* ── BRANDING ── */}
          <div className="flex-1 flex flex-col justify-center text-center lg:text-left max-w-lg mx-auto lg:mx-0"
            style={{ animation: 'slideUp 0.6s cubic-bezier(0.16,1,0.3,1)' }}>

            {/* Logo */}
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-2xl border border-white/10"
                style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.25),rgba(59,130,246,0.25))', backdropFilter: 'blur(20px)' }}>
                🏙️
              </div>
              <div>
                <div className="text-2xl font-black text-white tracking-tight leading-none">INOVATECH</div>
                <div className="text-[11px] font-bold tracking-[0.45em] mt-0.5" style={{ color: 'rgba(6,182,212,0.85)' }}>CONNECT</div>
              </div>
            </div>

            {/* Headline */}
            <div className="mb-2 inline-flex items-center justify-center lg:justify-start gap-2 self-center lg:self-start px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-widest"
              style={{ background: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.25)', color: 'rgba(6,182,212,0.85)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Plataforma Online
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mt-4 mb-5">
              Gestão de<br />
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg,#67e8f9,#60a5fa,#a78bfa)' }}>
                Condomínios
              </span><br />
              <span className="text-white/50 text-3xl font-bold">Inteligente</span>
            </h1>

            <p className="text-white/50 leading-relaxed mb-8 text-sm sm:text-base">
              QR Code exclusivo, chat integrado, marketplace, PIX e dashboards em tempo real.
            </p>

            {/* Feature pills */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '📦', label: 'Encomendas QR' },
                { icon: '💬', label: 'Chat em tempo real' },
                { icon: '💚', label: 'Pagamento PIX' },
                { icon: '📅', label: 'Reservas Online' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)', backdropFilter: 'blur(10px)' }}>
                  <span className="text-lg">{f.icon}</span>
                  <span className="text-white/60 text-xs font-semibold">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── CARD DE LOGIN ── */}
          <div className="w-full max-w-sm lg:max-w-md flex-shrink-0"
            style={{ animation: 'slideUp 0.7s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}>

            <div className="rounded-3xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 50px 120px -30px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.10)'
              }}>

              {/* Top accent bar */}
              <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6)' }} />

              <div className="p-8 sm:p-10">
                {/* Header */}
                <div className="mb-8">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: 'rgba(6,182,212,0.8)', borderColor: 'rgba(6,182,212,0.2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Ambiente seguro
                  </div>
                  <h2 className="text-2xl font-black text-white leading-tight mb-1">Bem-vindo de volta 👋</h2>
                  <p className="text-white/40 text-sm">Acesse sua conta para continuar</p>
                </div>

                {/* Campos */}
                <div className="space-y-4">
                  {/* E-mail */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>E-mail</label>
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && login()}
                      placeholder="seu@email.com"
                      className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)', color: '#f1f5f9' }}
                      onFocus={e => { e.currentTarget.style.border = '1.5px solid rgba(6,182,212,0.55)'; e.currentTarget.style.background = 'rgba(6,182,212,0.07)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(6,182,212,0.10)'; }}
                      onBlur={e => { e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>

                  {/* Senha */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Senha</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && login()}
                        placeholder="••••••••"
                        className="w-full px-4 py-3.5 pr-12 rounded-xl text-white text-sm outline-none transition-all duration-200"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)', color: '#f1f5f9' }}
                        onFocus={e => { e.currentTarget.style.border = '1.5px solid rgba(6,182,212,0.55)'; e.currentTarget.style.background = 'rgba(6,182,212,0.07)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(6,182,212,0.10)'; }}
                        onBlur={e => { e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                      <button type="button" onClick={() => setShowPass(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors p-1.5 rounded-lg text-sm">
                        {showPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  {/* Erro */}
                  {error && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.22)' }}>
                      <span className="text-red-400 text-sm shrink-0 mt-0.5">⚠️</span>
                      <p className="text-red-300 text-xs font-semibold leading-snug">{error}</p>
                    </div>
                  )}

                  {/* Botão */}
                  <button
                    onClick={login}
                    disabled={loading}
                    className="w-full py-4 rounded-xl font-black text-sm text-white tracking-wide transition-all duration-300 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                    style={{
                      background: 'linear-gradient(135deg,#0891b2 0%,#2563eb 55%,#7c3aed 100%)',
                      boxShadow: '0 10px 40px -10px rgba(6,182,212,0.55)'
                    }}>
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                      style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0) 100%)' }} />
                    <span className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Verificando...</span></>
                      ) : (
                        <><span>🔐</span><span>ENTRAR NO SISTEMA</span></>
                      )}
                    </span>
                  </button>
                </div>

                {/* Rodapé */}
                <div className="mt-8 pt-5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} INOVATECH</p>
                  <div className="flex items-center gap-3 text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    <span>🔐 Seguro</span>
                    <span>⚡ Rápido</span>
                    <span>📱 Mobile</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════
const MENU_ADMIN = [
  { id: 'admin-master', icon: '🏢', label: 'Gerenciar Condominios' },
  { id: 'dashboard', icon: '📊', label: 'Back-end e APIs' },
  { id: 'license-admin', icon: '💳', label: 'Cobranças de Licença' },
  { id: 'chat', icon: '💬', label: 'Mensagens' },
  { id: 'support', icon: '🎧', label: 'Support Hub' },
  { id: 'gateway-config', icon: '⚙️', label: 'Config. Gateway API' },
];
const MENU_SINDICO = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'people', icon: '👥', label: 'Gestão de Pessoas' },
  { id: 'finance', icon: '💰', label: 'Financeiro' },
  { id: 'gateway-config', icon: '⚙️', label: 'Gateway de Pagamento' },
  { id: 'deliveries', icon: '📦', label: 'Encomendas' },
  { id: 'announcements', icon: '📢', label: 'Comunicados' },
  { id: 'reservations', icon: '📅', label: 'Reservas' },
  { id: 'votes', icon: '🗳️', label: 'Assembleia Virtual' },
  { id: 'complaints', icon: '⚠️', label: 'Denúncias' },
  { id: 'market', icon: '🛒', label: 'Marketplace' },
  { id: 'maintenance', icon: '🔧', label: 'Manutenção' },
  { id: 'documents', icon: '📁', label: 'Documentos' },
  { id: 'reports', icon: '📊', label: 'Relatórios' },
  { id: 'lost-found', icon: '🔍', label: 'Achados e Perdidos' },
  { id: 'chat', icon: '💬', label: 'Mensagens' },
  { id: 'support', icon: '🎧', label: 'Support Hub' },
  { id: 'license-sindico', icon: '💳', label: 'Licença INOVATECH' },
];
const MENU_PORTEIRO = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'deliveries', icon: '📦', label: 'Encomendas' },
  { id: 'access-control', icon: '🚪', label: 'Controle de Acesso' },
  { id: 'residents', icon: '👥', label: 'Moradores' },
  { id: 'chat', icon: '💬', label: 'Mensagens' },
  { id: 'support', icon: '🎧', label: 'Support Hub' },
];
const MENU_MORADOR = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'finance', icon: '💰', label: 'Financeiro' },
  { id: 'deliveries', icon: '📦', label: 'Encomendas' },
  { id: 'announcements', icon: '📢', label: 'Comunicados' },
  { id: 'reservations', icon: '📅', label: 'Reservas' },
  { id: 'votes', icon: '🗳️', label: 'Assembleia Virtual' },
  { id: 'complaints', icon: '⚠️', label: 'Denúncias' },
  { id: 'market', icon: '🛒', label: 'Marketplace' },
  { id: 'maintenance', icon: '🔧', label: 'Manutenção' },
  { id: 'documents', icon: '📁', label: 'Documentos' },
  { id: 'lost-found', icon: '🔍', label: 'Achados e Perdidos' },
  { id: 'chat', icon: '💬', label: 'Mensagens' },
  { id: 'support', icon: '🎧', label: 'Support Hub' },
];

function ThemedSidebar({ user, active, onNav, collapsed, onToggle, notifCount, licenseAlertCount, chatUnread, theme }:
  { user: User; active: string; onNav: (s: string) => void; collapsed: boolean; onToggle: () => void; notifCount: number; licenseAlertCount: number; chatUnread: number; theme: Theme }) {
  const menus: Record<UserRole, typeof MENU_ADMIN> = {
    admin: MENU_ADMIN, 'admin-master': MENU_ADMIN, sindico: MENU_SINDICO, porteiro: MENU_PORTEIRO, morador: MENU_MORADOR,
  };
  const menu = menus[user.role];
  const roleColors: Record<UserRole, string> = {
    admin: 'from-cyan-600 to-blue-700',
    'admin-master': 'from-cyan-600 to-blue-700',
    sindico: 'from-cyan-500 to-emerald-600',
    porteiro: 'from-amber-500 to-orange-600',
    morador: 'from-emerald-500 to-teal-600',
  };
  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin Master', 'admin-master': 'Admin Master', sindico: 'Síndico', porteiro: 'Porteiro', morador: 'Morador',
  };
  const sidebarBackgroundByTheme: Record<string, string> = {
    indigo: 'linear-gradient(180deg, #312e81 0%, #3730a3 48%, #581c87 100%)',
    gold: 'linear-gradient(180deg, #020617 0%, #111827 55%, #78350f 100%)',
    emerald: 'linear-gradient(180deg, #064e3b 0%, #115e59 55%, #164e63 100%)',
    rose: 'linear-gradient(180deg, #581c87 0%, #881337 52%, #9d174d 100%)',
    arctic: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 52%, #f0f9ff 100%)',
    modern: 'linear-gradient(180deg, #083344 0%, #0f3f63 52%, #064e3b 100%)',
    midnight: 'linear-gradient(180deg, #000000 0%, #0a0a0a 50%, #000000 100%)',
    snow: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)',
  };
  const sidebarBackground = sidebarBackgroundByTheme[theme.id];
  const isLightSidebar = theme.id === 'light' || theme.id === 'blue';
  const isMidnightTheme = theme.id === 'dark';
  const sidebarPalette = isMidnightTheme ? {
    brand: '#ffffff',
    brandSub: '#d4d4d8',
    toggleBg: 'rgba(255, 255, 255, 0.12)',
    toggleText: '#e2e8f0',
    navText: 'rgba(255, 255, 255, 0.74)',
    navTextStrong: '#ffffff',
    navHoverBg: 'rgba(255, 255, 255, 0.1)',
    navActiveBg: 'rgba(255, 255, 255, 0.18)',
    navActiveBorder: 'rgba(255, 255, 255, 0.32)',
    statusTitle: 'rgba(255, 255, 255, 0.9)',
    statusSub: 'rgba(255, 255, 255, 0.68)',
    statusBorder: 'rgba(255, 255, 255, 0.16)',
  } : theme.id === 'light' ? {
    brand: '#0f172a',
    brandSub: '#06b6d4',
    toggleBg: 'rgba(6, 182, 212, 0.16)',
    toggleText: '#0f172a',
    navText: 'rgba(15, 23, 42, 0.6)',
    navTextStrong: '#0f172a',
    navHoverBg: 'rgba(6, 182, 212, 0.08)',
    navActiveBg: 'rgba(6, 182, 212, 0.15)',
    navActiveBorder: 'rgba(6, 182, 212, 0.34)',
    statusTitle: 'rgba(15, 23, 42, 0.9)',
    statusSub: 'rgba(15, 23, 42, 0.5)',
    statusBorder: 'rgba(15, 23, 42, 0.08)',
  } : {
    brand: isLightSidebar ? '#0f172a' : '#ffffff',
    brandSub: isLightSidebar ? '#0e7490' : '#67e8f9',
    toggleBg: isLightSidebar ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.15)',
    toggleText: isLightSidebar ? '#0f172a' : '#ffffff',
    navText: isLightSidebar ? 'rgba(15,23,42,0.72)' : '#e2e8f0',
    navTextStrong: isLightSidebar ? '#0f172a' : '#ffffff',
    navHoverBg: isLightSidebar ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.12)',
    navActiveBg: isLightSidebar ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.2)',
    navActiveBorder: isLightSidebar ? 'rgba(6,182,212,0.45)' : 'rgba(255,255,255,0.3)',
    statusTitle: isLightSidebar ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
    statusSub: isLightSidebar ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.5)',
    statusBorder: isLightSidebar ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.1)',
  };

  // Separar itens por grupos visuais
  const mainItems = menu.slice(0, Math.ceil(menu.length / 2));
  const extraItems = menu.slice(Math.ceil(menu.length / 2));

  return (
    <aside
      className={`sidebar-modern ${collapsed ? 'collapsed' : ''}`}
    >
      {/* Logo Section */}
      <div className="logo-section">
        <div className="logo-brand">
          <div className="logo-icon">🏙️</div>
          {!collapsed && (
            <div className="logo-text">
              <div className="logo-main">INOVATECH</div>
              <div className="logo-sub">CONNECT</div>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="toggle-btn"
        >
          <span style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>‹</span>
        </button>
      </div>

      {/* User Info Card */}
      {!collapsed && (
        <div className="user-card">
          <div className="user-card-info">
            <div className="user-avatar">
              {user.photo ? (
                <img src={user.photo} alt={user.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                user.name[0].toUpperCase()
              )}
            </div>
            <div className="user-details">
              <p className="user-name">{user.name}</p>
              <p className="user-role">{roleLabels[user.role]}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed user avatar */}
      {collapsed && (
        <div style={{ padding: '1rem', textAlign: 'center' }}>
          <div className="user-avatar" style={{ margin: '0 auto', width: '40px', height: '40px', fontSize: '1rem' }}>
            {user.name[0].toUpperCase()}
          </div>
        </div>
      )}

      {/* Section Label */}
      {!collapsed && (
        <div className="menu-label">
          Menu Principal
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="nav-menu">
        {menu.map((item, i) => {
          const isActive = active === item.id;
          const badge = item.id === 'deliveries' ? notifCount
            : item.id === 'license-sindico' ? licenseAlertCount
            : item.id === 'chat' ? chatUnread : 0;

          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="nav-text">{item.label}</span>
                  {badge > 0 && (
                    <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>
                  )}
                </>
              )}
              {collapsed && badge > 0 && (
                <span className="nav-badge" style={{ position: 'absolute', top: '4px', right: '4px', minWidth: '16px', height: '16px', fontSize: '0.5rem' }}>{badge > 9 ? '9+' : badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Status Footer */}
      <div className="status-footer">
        <div className="status-dot" />
        {!collapsed && (
          <div>
            <p className="text-white font-semibold text-sm">Sistema Online</p>
            <p className="text-white/50 text-xs">Todos os serviços operacionais</p>
          </div>
        )}
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════════════
const TYPE_NOTIF_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  delivery:     { icon: '📦', color: 'text-amber-700',   bg: 'from-amber-500 to-orange-500' },
  charge:       { icon: '💰', color: 'text-emerald-700', bg: 'from-emerald-500 to-green-500' },
  announcement: { icon: '📢', color: 'text-blue-700',    bg: 'from-blue-500 to-indigo-500' },
  vote:         { icon: '🗳️', color: 'text-purple-700',  bg: 'from-purple-500 to-violet-500' },
  reservation:  { icon: '📅', color: 'text-teal-700',    bg: 'from-teal-500 to-cyan-500' },
  complaint:    { icon: '⚠️', color: 'text-red-700',     bg: 'from-red-500 to-rose-500' },
};

function timeAgoHeader(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  if (m < 1) return 'Agora';
  if (m < 60) return `${m}min atrás`;
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(diff / 86400000)}d atrás`;
}

function ThemedHeader({ user, section, onLogout, notifCount, notifications, onMarkRead, onMenuToggle, theme }:
  { user: User; section: string; onLogout: () => void; notifCount: number; notifications: any[]; onMarkRead: () => void; onMenuToggle?: () => void; theme: Theme }) {
  const [showNotif, setShowNotif] = useState(false);
  const [notifTab, setNotifTab] = useState<'all' | 'unread'>('all');
  const [showTheme, setShowTheme] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Fechar theme picker ao clicar fora
  useEffect(() => {
    if (!showTheme) return;
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setShowTheme(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTheme]);

  const sectionLabels: Record<string, string> = {
    dashboard: user.role === 'admin' || user.role === 'admin-master' ? 'Back-end e APIs' : 'Dashboard', condos: 'Gerenciar Condominios', users: 'Usuários',
    people: '👥 Gestão de Pessoas', finance: 'Financeiro', deliveries: 'Encomendas', residents: 'Moradores',
    announcements: 'Comunicados', reservations: 'Reservas', votes: 'Assembleia Virtual',
    complaints: 'Denúncias', market: 'Marketplace', chat: '💬 Mensagens',
    maintenance: '🔧 Manutenção e Chamados', documents: '📁 Documentos Digitais',
    'access-control': '🚪 Controle de Acesso', 'lost-found': '🔍 Achados e Perdidos',
    reports: '📊 Relatórios e Analytics',
    'license-admin': '💳 Cobranças de Licença', 'license-sindico': '💳 Licença INOVATECH CONNECT',
    'gateway-config': '⚙️ Configuração de Gateway de Pagamento',
    support: '🎧 Support Hub',
    'support-admin': '🎧 Support Hub',
  };

  // Fechar ao clicar fora
  useEffect(() => {
    if (!showNotif) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotif]);

  const unread = notifications.filter(n => !n.read);
  const displayNotifs = notifTab === 'unread' ? unread : notifications;

  const roleColors: Record<string, string> = {
    admin: 'from-cyan-600 to-blue-700',
    'admin-master': 'from-cyan-600 to-blue-700',
    sindico: 'from-cyan-600 to-emerald-700',
    porteiro: 'from-amber-600 to-orange-600',
    morador: 'from-emerald-600 to-teal-700',
  };

  const headerThemes: Record<string, {
    surface: string;
    border: string;
    title: string;
    subtitle: string;
    buttonBg: string;
    buttonText: string;
    popoverSurface: string;
    popoverBorder: string;
    chipBorder: string;
  }> = {
    indigo: {
      surface: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(238,242,255,0.96) 100%)',
      border: 'rgba(99, 102, 241, 0.14)',
      title: '#1e1b4b',
      subtitle: '#06b6d4',
      buttonBg: 'rgba(255,255,255,0.72)',
      buttonText: '#4338ca',
      popoverSurface: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(238,242,255,0.96) 100%)',
      popoverBorder: 'rgba(99, 102, 241, 0.14)',
      chipBorder: 'rgba(255,255,255,0.28)',
    },
    gold: {
      surface: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(51,65,85,0.92) 100%)',
      border: 'rgba(245, 158, 11, 0.22)',
      title: '#f8fafc',
      subtitle: 'rgba(245, 158, 11, 0.88)',
      buttonBg: 'rgba(255,255,255,0.08)',
      buttonText: '#f8fafc',
      popoverSurface: 'linear-gradient(180deg, rgba(255,251,235,0.98) 0%, rgba(254,243,199,0.95) 100%)',
      popoverBorder: 'rgba(245, 158, 11, 0.2)',
      chipBorder: 'rgba(245, 158, 11, 0.26)',
    },
    emerald: {
      surface: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(236,253,245,0.97) 100%)',
      border: 'rgba(16, 185, 129, 0.16)',
      title: '#064e3b',
      subtitle: '#059669',
      buttonBg: 'rgba(255,255,255,0.74)',
      buttonText: '#047857',
      popoverSurface: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(236,253,245,0.97) 100%)',
      popoverBorder: 'rgba(16, 185, 129, 0.16)',
      chipBorder: 'rgba(255,255,255,0.28)',
    },
    rose: {
      surface: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,241,242,0.97) 100%)',
      border: 'rgba(244, 63, 94, 0.16)',
      title: '#881337',
      subtitle: '#e11d48',
      buttonBg: 'rgba(255,255,255,0.74)',
      buttonText: '#be123c',
      popoverSurface: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(255,241,242,0.98) 100%)',
      popoverBorder: 'rgba(244, 63, 94, 0.16)',
      chipBorder: 'rgba(255,255,255,0.28)',
    },
    arctic: {
      surface: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,249,255,0.96) 100%)',
      border: 'rgba(14, 165, 233, 0.14)',
      title: '#0f172a',
      subtitle: '#0284c7',
      buttonBg: 'rgba(255,255,255,0.8)',
      buttonText: '#0369a1',
      popoverSurface: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(240,249,255,0.98) 100%)',
      popoverBorder: 'rgba(14, 165, 233, 0.14)',
      chipBorder: 'rgba(14, 165, 233, 0.18)',
    },
    modern: {
      surface: 'linear-gradient(135deg, rgba(236,254,255,0.95) 0%, rgba(240,249,255,0.98) 52%, rgba(236,253,245,0.97) 100%)',
      border: 'rgba(6, 182, 212, 0.16)',
      title: '#1e3a5f',
      subtitle: '#0891b2',
      buttonBg: 'rgba(6, 182, 212, 0.12)',
      buttonText: '#0e7490',
      popoverSurface: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.98) 52%, rgba(236,253,245,0.97) 100%)',
      popoverBorder: 'rgba(6, 182, 212, 0.16)',
      chipBorder: 'rgba(6, 182, 212, 0.22)',
    },
    midnight: {
      surface: 'linear-gradient(135deg, rgba(10,10,10,0.98) 0%, rgba(0,0,0,1) 100%)',
      border: 'rgba(255, 255, 255, 0.2)',
      title: '#e2e8f0',
      subtitle: '#d4d4d8',
      buttonBg: 'rgba(255, 255, 255, 0.1)',
      buttonText: '#f1f5f9',
      popoverSurface: 'linear-gradient(180deg, rgba(8,8,8,0.99) 0%, rgba(0,0,0,1) 100%)',
      popoverBorder: 'rgba(255, 255, 255, 0.2)',
      chipBorder: 'rgba(255, 255, 255, 0.26)',
    },
    snow: {
      surface: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.99) 54%, rgba(236,254,255,0.98) 100%)',
      border: 'rgba(6, 182, 212, 0.18)',
      title: '#0f172a',
      subtitle: '#06b6d4',
      buttonBg: 'rgba(6, 182, 212, 0.12)',
      buttonText: '#0e7490',
      popoverSurface: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(240,249,255,0.98) 52%, rgba(236,254,255,0.98) 100%)',
      popoverBorder: 'rgba(6, 182, 212, 0.2)',
      chipBorder: 'rgba(6, 182, 212, 0.22)',
    },
  };

  const headerPalette = headerThemes[theme.id];
  const headerBg = headerPalette.surface;
  const headerBorder = headerPalette.border;
  const titleColor = headerPalette.title;
  const subtitleColor = headerPalette.subtitle;
  const btnBg = headerPalette.buttonBg;
  const btnColor = headerPalette.buttonText;
  const popoverBg = headerPalette.popoverSurface;
  const popoverBorder = headerPalette.popoverBorder;

  return (
    <header
      className="header-shell panel-header-surface sticky top-2 z-30 mx-1.5 mt-1.5 flex items-center justify-between gap-2 overflow-hidden rounded-2xl border px-3 py-2.5 sm:mx-2 sm:mt-2 sm:px-4 sm:rounded-2xl"
      style={{ background: headerBg, borderColor: headerBorder }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          onClick={onMenuToggle}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors font-bold text-base border"
          style={{ background: btnBg, color: btnColor, borderColor: headerBorder }}
        >☰</button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold sm:text-base" style={{ color: titleColor }}>{sectionLabels[section] ?? section}</h2>
          <div className="hidden sm:flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-medium" style={{ color: subtitleColor, opacity: 0.7 }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
            </span>
            <span className="w-1 h-1 rounded-full" style={{ background: subtitleColor, opacity: 0.3 }} />
            <span className="text-[10px] font-medium" style={{ color: subtitleColor, opacity: 0.5 }}>
              {theme.name}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
        {/* Notificações */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotif(p => !p); if (!showNotif) onMarkRead(); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 relative border hover:scale-105"
            style={{ background: btnBg, color: btnColor, borderColor: headerBorder }}
          >
            🔔
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-bounce px-1">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="panel-popover absolute right-0 top-13 mt-1 w-[22rem] max-w-[calc(100vw-1rem)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
              style={{ animation: 'slideUp 0.2s ease-out', top: '3.25rem', background: popoverBg, borderColor: popoverBorder }}>
              {/* Header do painel */}
              <div className="p-4 flex items-center justify-between" style={{ background: 'var(--theme-accent)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-lg">🔔</div>
                  <div>
                    <p className="text-white font-bold text-sm">Notificações</p>
                    {unread.length > 0 && <p className="text-white/50 text-xs">{unread.length} não lida{unread.length > 1 ? 's' : ''}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unread.length > 0 && (
                    <button onClick={onMarkRead} className="text-xs text-white/50 hover:text-white transition-colors">
                      Marcar todas
                    </button>
                  )}
                  <button onClick={() => setShowNotif(false)} className="w-7 h-7 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white flex items-center justify-center text-sm font-bold transition-colors">✕</button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                {(['all', 'unread'] as const).map(t => (
                  <button key={t} onClick={() => setNotifTab(t)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-all ${notifTab === t ? 'text-cyan-700 border-b-2 border-cyan-500' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t === 'all' ? 'Todas' : 'Não lidas'}
                    {t === 'unread' && unread.length > 0 && (
                      <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unread.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Lista */}
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {displayNotifs.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-2">🔕</div>
                    <p className="text-sm font-medium">Nenhuma notificação</p>
                  </div>
                )}
                {[...displayNotifs].reverse().map(n => {
                  const cfg = TYPE_NOTIF_CONFIG[n.type] ?? { icon: '🔔', color: 'text-gray-600', bg: 'from-gray-500 to-slate-500' };
                  const waMsg = `🔔 *INOVATECH CONNECT*\n${n.title}\n${n.message}`;
                  return (
                    <div key={n.id} className={`px-4 py-3.5 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-cyan-50/40' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cfg.bg} flex items-center justify-center text-base shadow flex-shrink-0 mt-0.5`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>
                              {n.type}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{timeAgoHeader(n.createdAt)}</span>
                          </div>
                          <p className={`text-sm font-semibold leading-tight ${n.read ? 'text-gray-600' : 'text-gray-900'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                          {/* Botão WhatsApp na notificação */}
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg border border-green-200 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                        {!n.read && <div className="w-2 h-2 bg-cyan-500 rounded-full flex-shrink-0 mt-2" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rodapé */}
              <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
                <p className="text-xs text-gray-400">{notifications.length} notificação{notifications.length !== 1 ? 'ões' : ''} no total</p>
              </div>
            </div>
          )}
        </div>

        {/* User info - mobile compact */}
        <div className={`sm:hidden w-9 h-9 rounded-xl bg-gradient-to-r ${roleColors[user.role]} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
          {user.name[0]}
        </div>

        {/* User info - desktop */}
        <div className={`hidden sm:flex items-center gap-2 bg-gradient-to-r ${roleColors[user.role]} px-3 py-1.5 rounded-xl border shadow-sm`}
          style={{ borderColor: headerPalette.chipBorder }}>
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
            {user.name[0]}
          </div>
          <span className="text-sm font-semibold text-white">{user.name.split(' ')[0]}</span>
        </div>

        {/* Botão de tema */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => setShowTheme(p => !p)}
            title="Mudar tema"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all duration-200 hover:scale-105 border"
            style={{ background: btnBg, color: btnColor, borderColor: headerBorder }}
          >
            🎨
          </button>

          {showTheme && (
            <div
              className="theme-popover absolute right-0 mt-2 w-80 rounded-3xl shadow-2xl border overflow-hidden z-50 backdrop-blur-xl bg-white/95"
              style={{ 
                background: popoverBg,
                borderColor: popoverBorder, 
                animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)', 
                top: '2.75rem' 
              }}
            >
              {/* ThemeSelector removed */}
            </div>
          )}
        </div>

        <button onClick={onLogout}
          className="w-9 h-9 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 border hover:scale-105"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
        >
          <span>🚪</span><span className="hidden sm:block text-xs">Sair</span>
        </button>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CONDOS (Admin)
// ═══════════════════════════════════════════════════════════════════════════
interface CondoData { id: string; name: string; cnpj?: string; email?: string; address: string; city: string; units: number; residents: number; sindico?: string; sindicoId?: string; active: boolean; monthlyRevenue: number; pendingCharges: number; createdAt: string; }

function CondosSection({ store }: { store: ReturnType<typeof useStore> }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CondoData | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [units, setUnits] = useState('');
  const condos = store.getCondos();

  const openNew = () => { setEditing(null); setName(''); setAddress(''); setCity(''); setUnits(''); setShowModal(true); };
  const openEdit = (c: CondoData) => { setEditing(c); setName(c.name); setAddress(c.address); setCity(c.city); setUnits(String(c.units)); setShowModal(true); };
  const save = () => {
    if (!name.trim()) return;
    if (editing) {
      store.updateCondo(editing.id, { name, address, city, units: parseInt(units) || 0 });
    } else {
      store.addCondo({ name, address, city, units: parseInt(units) || 0, residents: 0, active: true, blocked: false, monthlyRevenue: 0, pendingCharges: 0, licenseValue: 299 });
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{condos.length} condomínios cadastrados</p>
        <Btn variant="primary" onClick={openNew}>➕ Novo Condomínio</Btn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {condos.map(c => (
          <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl shadow">🏢</div>
              <Badge label={c.active ? 'Ativo' : 'Inativo'} color={c.active ? 'green' : 'gray'} />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">{c.name}</h3>
            <p className="text-xs text-gray-500 mb-3">{c.address} · {c.city}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">Unidades</p>
                <p className="font-bold text-gray-800">{c.units}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">Moradores</p>
                <p className="font-bold text-gray-800">{c.residents}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg mb-3">
              <span className="text-xs text-emerald-600">Receita mensal</span>
              <span className="font-bold text-emerald-700 text-sm">{fmtMoney(c.monthlyRevenue)}</span>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => openEdit(c)}>✏️ Editar</Btn>
              <Btn variant="danger" size="sm" onClick={() => { if (confirm('Excluir condomínio?')) store.deleteCondo(c.id); }}>🗑️</Btn>
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <Modal title={editing ? 'Editar Condomínio' : 'Novo Condomínio'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Nome do Condomínio" required><Input value={name} onChange={e => setName(e.target.value)} placeholder="Residencial..." /></Field>
            <Field label="Endereço"><Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Av. das Flores, 1200" /></Field>
            <Field label="Cidade"><Input value={city} onChange={e => setCity(e.target.value)} placeholder="São Paulo - SP" /></Field>
            <Field label="Número de Unidades"><Input type="number" value={units} onChange={e => setUnits(e.target.value)} placeholder="120" /></Field>
            <div className="flex gap-3"><Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn><Btn variant="primary" onClick={save}>Salvar</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
void CondosSection;

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: USERS (Admin)
// ═══════════════════════════════════════════════════════════════════════════
function UsersSection({ store }: { store: ReturnType<typeof useStore> }) {
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [filter, setFilter] = useState('all');
  const users = store.getUsers();
  const condos = store.getCondos();

  const filtered = filter === 'all' ? users : users.filter(u => u.role === filter);

  const roleLabels: Record<UserRole, string> = { admin: '👨‍💼 Admin', 'admin-master': '👨‍💼 Admin Master', sindico: '🏢 Síndico', porteiro: '🚪 Porteiro', morador: '🏠 Morador' };
  const roleColors: Record<UserRole, string> = { admin: 'blue', 'admin-master': 'blue', sindico: 'blue', porteiro: 'orange', morador: 'green' };

  const handleSave = (data: Partial<User>) => {
    if (editUser) {
      store.updateUser(editUser.id, data);
    } else {
      store.addUser(data as Omit<User, 'id' | 'createdAt'>);
    }
    setShowModal(false);
    setEditUser(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'admin', 'sindico', 'porteiro', 'morador'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${filter === f ? 'bg-indigo-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'all' ? 'Todos' : roleLabels[f as UserRole]}
            </button>
          ))}
        </div>
        <Btn variant="primary" onClick={() => { setEditUser(null); setShowModal(true); }}>➕ Novo Usuário</Btn>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <Table headers={['Usuário', 'CPF', 'Nascimento', 'Perfil', 'Condomínio', 'Unidade', 'Status', 'Ações']}>
          {filtered.map((u, i) => (
            <TR key={u.id} idx={i}>
              <TD>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">{u.name[0]}</div>
                  <div>
                    <p className="font-semibold text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                    {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                  </div>
                </div>
              </TD>
              <TD><span className="font-mono text-xs text-gray-600">{u.cpf}</span></TD>
              <TD>
                <div>
                  <p className="text-sm">{u.birthDate ? fmtDate(u.birthDate) : '-'}</p>
                  {u.birthDate && <p className="text-xs text-gray-400">{calcAge(u.birthDate)} anos</p>}
                </div>
              </TD>
              <TD><Badge label={roleLabels[u.role]} color={roleColors[u.role]} /></TD>
              <TD><span className="text-sm text-gray-600">{u.condoId ? condos.find(c => c.id === u.condoId)?.name ?? '-' : '-'}</span></TD>
              <TD><span className="text-sm">{u.unit ?? '-'}</span></TD>
              <TD><Badge label={u.active ? 'Ativo' : 'Inativo'} color={u.active ? 'green' : 'gray'} /></TD>
              <TD>
                <div className="flex gap-1">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditUser(u); setShowModal(true); }}>✏️</Btn>
                  <Btn size="sm" variant="danger" onClick={() => { if (confirm('Excluir usuário?')) store.deleteUser(u.id); }}>🗑️</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </div>

      {showModal && (
        <UserFormModal
          onClose={() => { setShowModal(false); setEditUser(null); }}
          onSave={handleSave}
          initial={editUser ?? undefined}
          condoOptions={condos}
          isEdit={!!editUser}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: PEOPLE MANAGEMENT (Síndico) — Moradores, Porteiros, Funcionários
// ═══════════════════════════════════════════════════════════════════════════
export function AdminMasterSection({ store }: { store: ReturnType<typeof useStore> }) {
  const condos = store.getCondos();
  const users = store.getUsers();
  const [showCondoModal, setShowCondoModal] = useState(false);
  const [editingCondo, setEditingCondo] = useState<CondoData | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedCondoId, setSelectedCondoId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [units, setUnits] = useState('');

  const openNewCondo = () => {
    setEditingCondo(null);
    setName('');
    setAddress('');
    setCity('');
    setUnits('');
    setShowCondoModal(true);
  };

  const openEditCondo = (condo: CondoData) => {
    setEditingCondo(condo);
    setName(condo.name);
    setAddress(condo.address);
    setCity(condo.city);
    setUnits(String(condo.units));
    setShowCondoModal(true);
  };

  const saveCondo = () => {
    if (!name.trim()) return;
    if (editingCondo) {
      store.updateCondo(editingCondo.id, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        units: parseInt(units, 10) || 0,
      });
    } else {
      store.addCondo({
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        units: parseInt(units, 10) || 0,
        residents: 0,
        active: true,
        blocked: false,
        monthlyRevenue: 0,
        pendingCharges: 0,
        licenseValue: 299,
      });
    }
    setShowCondoModal(false);
  };

  const openNewUserForCondo = (condoId: string) => {
    setSelectedCondoId(condoId);
    setEditingUser(null);
    setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
    setSelectedCondoId(user.condoId ?? '');
    setEditingUser(user);
    setShowUserModal(true);
  };

  const saveUser = (data: Partial<User>) => {
    const payload = { ...data, condoId: data.condoId ?? selectedCondoId };
    if (editingUser) {
      store.updateUser(editingUser.id, payload);
    } else {
      store.addUser(payload as Omit<User, 'id' | 'createdAt'>);
    }
    setShowUserModal(false);
    setEditingUser(null);
    setSelectedCondoId('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gerenciar Condomínios</h2>
          <p className="text-sm text-gray-500">Crie condomínios e gerencie os usuários de cada um na mesma tela.</p>
        </div>
        <Btn variant="primary" onClick={openNewCondo}>➕ Novo Condomínio</Btn>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {condos.map((condo) => {
          const condoUsers = users.filter((user) => user.condoId === condo.id);
          return (
            <div key={condo.id} className="panel-card-refined overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-indigo-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{condo.name}</h3>
                    <p className="text-sm text-gray-500">{condo.address}{condo.city ? ` · ${condo.city}` : ''}</p>
                  </div>
                  <Badge label={condo.active ? 'Ativo' : 'Inativo'} color={condo.active ? 'green' : 'gray'} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600">{condo.units} unidades</span>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600">{condoUsers.length} usuários</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Btn size="sm" variant="primary" onClick={() => openNewUserForCondo(condo.id)}>➕ Novo Usuário</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => openEditCondo(condo)}>✏️ Editar Condomínio</Btn>
                  <Btn size="sm" variant="danger" onClick={() => { if (confirm(`Excluir condomínio ${condo.name}?`)) store.deleteCondo(condo.id); }}>🗑️ Remover</Btn>
                </div>
              </div>

              <div className="p-5">
                {condoUsers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    Nenhum usuário cadastrado neste condomínio.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {condoUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge label={user.role} color={user.role === 'sindico' ? 'blue' : user.role === 'porteiro' ? 'orange' : user.role === 'morador' ? 'green' : 'purple'} />
                            <Badge label={user.active ? 'Ativo' : 'Inativo'} color={user.active ? 'green' : 'gray'} />
                            {user.unit && <Badge label={`Unidade ${user.unit}`} color="gray" />}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Btn size="sm" variant="secondary" onClick={() => openEditUser(user)}>✏️</Btn>
                          <Btn size="sm" variant="danger" onClick={() => { if (confirm(`Excluir usuário ${user.name}?`)) store.deleteUser(user.id); }}>🗑️</Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCondoModal && (
        <Modal title={editingCondo ? 'Editar Condomínio' : 'Novo Condomínio'} onClose={() => setShowCondoModal(false)}>
          <div className="space-y-4">
            <Field label="Nome do Condomínio" required><Input value={name} onChange={e => setName(e.target.value)} /></Field>
            <Field label="Endereço"><Input value={address} onChange={e => setAddress(e.target.value)} /></Field>
            <Field label="Cidade"><Input value={city} onChange={e => setCity(e.target.value)} /></Field>
            <Field label="Número de Unidades"><Input type="number" value={units} onChange={e => setUnits(e.target.value)} /></Field>
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setShowCondoModal(false)}>Cancelar</Btn>
              <Btn variant="primary" onClick={saveCondo}>Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showUserModal && (
        <UserFormModal
          onClose={() => { setShowUserModal(false); setEditingUser(null); setSelectedCondoId(''); }}
          onSave={saveUser}
          initial={editingUser ? editingUser : selectedCondoId ? { condoId: selectedCondoId } : undefined}
          condoOptions={condos}
          isEdit={!!editingUser}
        />
      )}
    </div>
  );
}
function _AdminMasterSectionV2({ store }: { store: ReturnType<typeof useStore> }) {
  const condos = store.getCondos();
  const users = store.getUsers();
  const [expandedCondoId, setExpandedCondoId] = useState<string | null>(null);
  const [showCondoModal, setShowCondoModal] = useState(false);
  const [editingCondo, setEditingCondo] = useState<CondoData | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedCondoId, setSelectedCondoId] = useState('');
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [units, setUnits] = useState('');

  const openNewCondo = () => {
    setEditingCondo(null);
    setName('');
    setCnpj('');
    setEmail('');
    setAddress('');
    setCity('');
    setUnits('');
    setShowCondoModal(true);
  };

  const openEditCondo = (condo: CondoData) => {
    setEditingCondo(condo);
    setName(condo.name);
    setCnpj(condo.cnpj ?? '');
    setEmail(condo.email ?? '');
    setAddress(condo.address);
    setCity(condo.city);
    setUnits(String(condo.units));
    setShowCondoModal(true);
  };

  const saveCondo = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      cnpj: cnpj.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      units: parseInt(units, 10) || 0,
    };
    if (editingCondo) {
      store.updateCondo(editingCondo.id, payload);
    } else {
      store.addCondo({
        ...payload,
        residents: 0,
        active: true,
        blocked: false,
        monthlyRevenue: 0,
        pendingCharges: 0,
        licenseValue: 299,
      });
    }
    setShowCondoModal(false);
  };

  const openNewUserForCondo = (condoId: string) => {
    setSelectedCondoId(condoId);
    setEditingUser(null);
    setExpandedCondoId(condoId);
    setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
    setSelectedCondoId(user.condoId ?? '');
    setEditingUser(user);
    if (user.condoId) setExpandedCondoId(user.condoId);
    setShowUserModal(true);
  };

  const saveUser = (data: Partial<User>) => {
    const payload = { ...data, condoId: data.condoId ?? selectedCondoId };
    if (editingUser) {
      store.updateUser(editingUser.id, payload);
    } else {
      store.addUser(payload as Omit<User, 'id' | 'createdAt'>);
    }
    setShowUserModal(false);
    setEditingUser(null);
    setSelectedCondoId('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gerenciar Condominios</h2>
          <p className="text-sm text-gray-500">Clique em um condominio para abrir os usuarios dele.</p>
        </div>
        <Btn variant="primary" onClick={openNewCondo}>Novo Condominio</Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {condos.map((condo) => {
          const condoUsers = users.filter((user) => user.condoId === condo.id);
          const moradores = condoUsers.filter((user) => user.role === 'morador').length;
          const isExpanded = expandedCondoId === condo.id;

          return (
            <div key={condo.id} className="panel-card-refined overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedCondoId((current) => current === condo.id ? null : condo.id)}
                className="w-full p-4 text-left bg-gradient-to-r from-slate-50 to-indigo-50 hover:from-slate-100 hover:to-indigo-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-800 text-base">{condo.name}</h3>
                    <p className="text-xs text-gray-500">{condo.city || condo.address || 'Sem local informado'}</p>
                  </div>
                  <Badge label={condo.active ? 'Ativo' : 'Inativo'} color={condo.active ? 'green' : 'gray'} />
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Moradores</p>
                    <p className="text-lg font-bold text-gray-800">{moradores}</p>
                  </div>
                  <div className="rounded-xl bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Unidades</p>
                    <p className="text-lg font-bold text-gray-800">{condo.units}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-medium text-indigo-600">
                  <span>{isExpanded ? 'Ocultar usuarios' : 'Ver usuarios'}</span>
                  <span aria-hidden="true">{isExpanded ? '^' : 'v'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Btn size="sm" variant="primary" onClick={() => openNewUserForCondo(condo.id)}>+ Novo Usuario</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => openEditCondo(condo)}>Editar Condominio</Btn>
                    <Btn size="sm" variant="danger" onClick={() => { if (confirm(`Excluir condominio ${condo.name}?`)) store.deleteCondo(condo.id); }}>Remover</Btn>
                  </div>

                  {condoUsers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      Nenhum usuario cadastrado neste condominio.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {condoUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge label={user.role} color={user.role === 'sindico' ? 'blue' : user.role === 'porteiro' ? 'orange' : user.role === 'morador' ? 'green' : 'purple'} />
                              <Badge label={user.active ? 'Ativo' : 'Inativo'} color={user.active ? 'green' : 'gray'} />
                              {user.unit && <Badge label={`Unidade ${user.unit}`} color="gray" />}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Btn size="sm" variant="secondary" onClick={() => openEditUser(user)}>Editar</Btn>
                            <Btn size="sm" variant="danger" onClick={() => { if (confirm(`Excluir usuario ${user.name}?`)) store.deleteUser(user.id); }}>Remover</Btn>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCondoModal && (
        <Modal title={editingCondo ? 'Editar Condominio' : 'Novo Condominio'} onClose={() => setShowCondoModal(false)}>
          <div className="space-y-4">
            <Field label="Nome do Condominio" required><Input value={name} onChange={e => setName(e.target.value)} /></Field>
            <Field label="CNPJ"><Input value={cnpj} onChange={e => setCnpj(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field label="Endereco"><Input value={address} onChange={e => setAddress(e.target.value)} /></Field>
            <Field label="Cidade"><Input value={city} onChange={e => setCity(e.target.value)} /></Field>
            <Field label="Numero de Unidades"><Input type="number" value={units} onChange={e => setUnits(e.target.value)} /></Field>
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setShowCondoModal(false)}>Cancelar</Btn>
              <Btn variant="primary" onClick={saveCondo}>Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showUserModal && (
        <UserFormModal
          onClose={() => { setShowUserModal(false); setEditingUser(null); setSelectedCondoId(''); }}
          onSave={saveUser}
          initial={editingUser ? editingUser : selectedCondoId ? { condoId: selectedCondoId } : undefined}
          condoOptions={condos}
          isEdit={!!editingUser}
        />
      )}
    </div>
  );
}

function PeopleSection({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  const [tab, setTab] = useState<'moradores' | 'porteiros' | 'funcionarios'>('moradores');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);

  // Form states para usuário (morador/porteiro)
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uCpf, setUCpf] = useState('');
  const [uBirth, setUBirth] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uUnit, setUUnit] = useState('');
  const [uCanViewCharges, setUCanViewCharges] = useState(true);
  const [uKinship, setUKinship] = useState('');
  const [uErrors, setUErrors] = useState<Record<string, string>>({});
  const [showUPass, setShowUPass] = useState(false);
  const [uPhoto, setUPhoto] = useState('');
  const [uShowCamera, setUShowCamera] = useState(false);
  const uVideoRef = useRef<HTMLVideoElement>(null);
  const uCanvasRef = useRef<HTMLCanvasElement>(null);
  const uStreamRef = useRef<MediaStream | null>(null);
  const uFileRef = useRef<HTMLInputElement>(null);

  const startUCamera = async () => {
    setUShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      uStreamRef.current = stream;
      setTimeout(() => { if (uVideoRef.current) uVideoRef.current.srcObject = stream; }, 100);
    } catch { setUShowCamera(false); alert('Câmera não disponível.'); }
  };
  const stopUCamera = () => {
    uStreamRef.current?.getTracks().forEach(t => t.stop());
    uStreamRef.current = null;
    setUShowCamera(false);
  };
  const takeUPhoto = () => {
    if (!uVideoRef.current || !uCanvasRef.current) return;
    const v = uVideoRef.current; const c = uCanvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    setUPhoto(c.toDataURL('image/jpeg', 0.8));
    stopUCamera();
  };
  const handleUFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setUPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Form states para funcionário (apenas documentação)
  const [eName, setEName] = useState('');
  const [eCpf, setECpf] = useState('');
  const [eBirth, setEBirth] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [eRole, setERole] = useState('Zelador');
  const [eDept, setEDept] = useState('Manutenção');
  const [eAdmission, setEAdmission] = useState('');
  const [eSalary, setESalary] = useState('');
  const [eAddress, setEAddress] = useState('');
  const [eDocument, setEDocument] = useState('');
  const [eNotes, setENotes] = useState('');
  const [eErrors, setEErrors] = useState<Record<string, string>>({});

  const condoUsers = store.getUsersByCondoId(user.condoId!);
  const moradores = condoUsers.filter(u => u.role === 'morador');
  const porteiros = condoUsers.filter(u => u.role === 'porteiro');
  const employees = store.getEmployees(user.condoId!);

  const cargos = ['Zelador', 'Faxineiro(a)', 'Jardineiro', 'Vigia', 'Auxiliar de Limpeza', 'Administrador', 'Outro'];
  const departamentos = ['Manutenção', 'Limpeza', 'Segurança', 'Paisagismo', 'Administração', 'Outro'];

  const resetUserForm = () => { setUName(''); setUEmail(''); setUPassword(''); setUCpf(''); setUBirth(''); setUPhone(''); setUUnit(''); setUCanViewCharges(true); setUKinship(''); setUErrors({}); setUPhoto(''); stopUCamera(); };
  const resetEmpForm = () => { setEName(''); setECpf(''); setEBirth(''); setEPhone(''); setEEmail(''); setERole('Zelador'); setEDept('Manutenção'); setEAdmission(''); setESalary(''); setEAddress(''); setEDocument(''); setENotes(''); setEErrors({}); };

  const openNewUser = () => { setEditUser(null); resetUserForm(); setShowUserModal(true); };
  const openEditUser = (u: User) => {
    setEditUser(u);
    setUName(u.name); setUEmail(u.email); setUPassword(''); setUCpf(u.cpf ?? '');
    setUBirth(u.birthDate ?? ''); setUPhone(u.phone ?? ''); setUUnit(u.unit ?? '');
    setUCanViewCharges(u.canViewCharges !== false);
    setUKinship(u.kinship ?? '');
    setUPhoto(u.photo ?? '');
    setUErrors({});
    setShowUserModal(true);
  };

  const openNewEmp = () => { setEditEmp(null); resetEmpForm(); setShowEmpModal(true); };
  const openEditEmp = (e: Employee) => {
    setEditEmp(e);
    setEName(e.name); setECpf(e.cpf); setEBirth(e.birthDate); setEPhone(e.phone);
    setEEmail(e.email ?? ''); setERole(e.role); setEDept(e.department);
    setEAdmission(e.admissionDate); setESalary(e.salary ? String(e.salary) : '');
    setEAddress(e.address ?? ''); setEDocument(e.document ?? ''); setENotes(e.notes ?? '');
    setEErrors({});
    setShowEmpModal(true);
  };

  const validateUser = () => {
    const e: Record<string, string> = {};
    if (!uName.trim() || uName.trim().length < 3) e.name = 'Nome obrigatório (mín. 3 caracteres)';
    if (!uEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'E-mail inválido';
    if (!editUser && uPassword.length < 6) e.password = 'Senha deve ter no mínimo 6 caracteres';
    if (!uCpf || uCpf.replace(/\D/g, '').length !== 11) e.cpf = 'CPF deve ter 11 dígitos';
    if (!uBirth) e.birth = 'Data de nascimento obrigatória';
    setUErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateEmp = () => {
    const e: Record<string, string> = {};
    if (!eName.trim() || eName.trim().length < 3) e.name = 'Nome obrigatório';
    if (!eCpf || eCpf.replace(/\D/g, '').length !== 11) e.cpf = 'CPF inválido';
    if (!eBirth) e.birth = 'Data de nascimento obrigatória';
    if (!ePhone.trim()) e.phone = 'Telefone obrigatório';
    if (!eAdmission) e.admission = 'Data de admissão obrigatória';
    setEErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveUser = () => {
    if (!validateUser()) return;
    const role = tab === 'moradores' ? 'morador' : 'porteiro';
    if (editUser) {
      store.updateUser(editUser.id, {
        name: uName.trim(), email: uEmail.trim(), cpf: uCpf, birthDate: uBirth,
        phone: uPhone, unit: uUnit || undefined,
        canViewCharges: uCanViewCharges,
        kinship: uKinship || undefined,
        photo: uPhoto || undefined,
        ...(uPassword ? { password: uPassword } : {})
      });
    } else {
      store.addUser({
        name: uName.trim(), email: uEmail.trim(), password: uPassword, cpf: uCpf,
        birthDate: uBirth, phone: uPhone, role, condoId: user.condoId!,
        unit: uUnit || undefined, active: true,
        canViewCharges: uCanViewCharges,
        kinship: uKinship || undefined,
        photo: uPhoto || undefined,
      });
    }
    setShowUserModal(false); resetUserForm();
  };

  const saveEmp = () => {
    if (!validateEmp()) return;
    const data = {
      condoId: user.condoId!, name: eName.trim(), cpf: eCpf, birthDate: eBirth,
      phone: ePhone, email: eEmail || undefined, role: eRole, department: eDept,
      admissionDate: eAdmission, salary: eSalary ? parseFloat(eSalary) : undefined,
      address: eAddress || undefined, document: eDocument || undefined, notes: eNotes || undefined,
    };
    if (editEmp) { store.updateEmployee(editEmp.id, data); }
    else { store.addEmployee(data); }
    setShowEmpModal(false); resetEmpForm();
  };

  const tabConfig = [
    { key: 'moradores', icon: '🏠', label: 'Moradores', count: moradores.length, color: 'emerald' },
    { key: 'porteiros', icon: '🚪', label: 'Porteiros', count: porteiros.length, color: 'amber' },
    { key: 'funcionarios', icon: '👷', label: 'Funcionários', count: employees.length, color: 'blue' },
  ];

  const age = uBirth ? calcAge(uBirth) : null;

  return (
    <div className="space-y-4">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tabConfig.map(t => (
          <div key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`cursor-pointer rounded-2xl p-4 border-2 transition-all hover:-translate-y-0.5 ${tab === t.key
              ? t.color === 'emerald' ? 'border-emerald-400 bg-emerald-50' : t.color === 'amber' ? 'border-amber-400 bg-amber-50' : 'border-blue-400 bg-blue-50'
              : 'border-gray-100 bg-white hover:border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow ${
                tab === t.key
                  ? t.color === 'emerald' ? 'bg-emerald-500' : t.color === 'amber' ? 'bg-amber-500' : 'bg-blue-500'
                  : 'bg-gray-100'
              }`}>{t.icon}</div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{t.label}</p>
                <p className="text-2xl font-black text-gray-800">{t.count}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {tabConfig.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div>
          {tab !== 'funcionarios' && (
            <Btn variant="primary" onClick={openNewUser}>
              ➕ {tab === 'moradores' ? 'Novo Morador' : 'Novo Porteiro'}
            </Btn>
          )}
          {tab === 'funcionarios' && (
            <Btn variant="primary" onClick={openNewEmp}>👷 Novo Funcionário</Btn>
          )}
        </div>
      </div>

      {/* ABA: MORADORES */}
      {tab === 'moradores' && (
        <div className="space-y-3">
          {/* Info box */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="text-sm font-bold text-emerald-800">Moradores com Acesso ao Dashboard</p>
              <p className="text-xs text-emerald-600 mt-0.5">Moradores cadastrados aqui recebem login e senha para acessar o sistema. Eles podem visualizar cobranças, encomendas, reservas e muito mais.</p>
            </div>
          </div>
          {moradores.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <div className="text-5xl mb-3">🏠</div>
              <p className="font-medium">Nenhum morador cadastrado</p>
              <p className="text-sm mt-1">Clique em "Novo Morador" para adicionar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {moradores.map((m, i) => (
                <div key={m.id} style={{ animationDelay: `${i * 50}ms` }}
                  className="panel-card-refined hover:shadow-md transition-all p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold shadow flex-shrink-0">
                      {m.photo ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" /> : m.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-800">{m.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{m.email}</p>
                        </div>
                        <Badge label={m.active ? '🟢 Ativo' : '🔴 Inativo'} color={m.active ? 'green' : 'red'} />
                      </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Unidade</p>
                          <p className="text-sm font-bold text-gray-700">{m.unit ?? '-'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Telefone</p>
                          <p className="text-sm font-bold text-gray-700">{m.phone ?? '-'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">CPF</p>
                          <p className="text-xs font-mono text-gray-700">{m.cpf ?? '-'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Idade</p>
                          <p className="text-sm font-bold text-gray-700">{m.birthDate ? `${calcAge(m.birthDate)} anos` : '-'}</p>
                        </div>
                      </div>
                      {/* Parentesco e permissão de cobranças */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {m.kinship && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg">
                            👨‍👩‍👧 {m.kinship}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg ${
                          m.canViewCharges !== false
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {m.canViewCharges !== false ? '👁️ Vê cobranças' : '🚫 Sem acesso financeiro'}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Btn size="sm" variant="secondary" onClick={() => openEditUser(m)}>✏️ Editar</Btn>
                        <Btn size="sm" variant="danger" onClick={() => { if (confirm(`Remover ${m.name}?`)) store.deleteUser(m.id); }}>🗑️ Remover</Btn>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: PORTEIROS */}
      {tab === 'porteiros' && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">🚪</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Porteiros com Acesso ao Dashboard</p>
              <p className="text-xs text-amber-600 mt-0.5">Porteiros cadastrados aqui podem fazer login no sistema para registrar encomendas, controlar acessos e consultar moradores.</p>
            </div>
          </div>
          {porteiros.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <div className="text-5xl mb-3">🚪</div>
              <p className="font-medium">Nenhum porteiro cadastrado</p>
              <p className="text-sm mt-1">Clique em "Novo Porteiro" para adicionar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {porteiros.map((p, i) => (
                <div key={p.id} style={{ animationDelay: `${i * 50}ms` }}
                  className="panel-card-refined hover:shadow-md transition-all p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl font-bold shadow flex-shrink-0">
                      {p.photo ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" /> : p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{p.email}</p>
                        </div>
                        <Badge label={p.active ? '🟢 Ativo' : '🔴 Inativo'} color={p.active ? 'green' : 'red'} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">CPF</p>
                          <p className="text-xs font-mono text-gray-700">{p.cpf ?? '-'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Telefone</p>
                          <p className="text-sm font-bold text-gray-700">{p.phone ?? '-'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 col-span-2">
                          <p className="text-xs text-gray-400">Nascimento</p>
                          <p className="text-sm font-bold text-gray-700">{p.birthDate ? `${fmtDate(p.birthDate)} (${calcAge(p.birthDate)} anos)` : '-'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Btn size="sm" variant="secondary" onClick={() => openEditUser(p)}>✏️ Editar</Btn>
                        <Btn size="sm" variant="danger" onClick={() => { if (confirm(`Remover ${p.name}?`)) store.deleteUser(p.id); }}>🗑️ Remover</Btn>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: FUNCIONÁRIOS */}
      {tab === 'funcionarios' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">👷</span>
            <div>
              <p className="text-sm font-bold text-blue-800">Funcionários — Apenas Registro Documental</p>
              <p className="text-xs text-blue-600 mt-0.5">Funcionários como zeladores, faxineiros e jardineiros são cadastrados apenas para fins de documentação e controle interno. <strong>Eles não recebem acesso ao sistema.</strong></p>
            </div>
          </div>
          {employees.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <div className="text-5xl mb-3">👷</div>
              <p className="font-medium">Nenhum funcionário cadastrado</p>
              <p className="text-sm mt-1">Clique em "Novo Funcionário" para registrar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((e, i) => (
                <div key={e.id} style={{ animationDelay: `${i * 50}ms` }}
                  className="panel-card-refined hover:shadow-md transition-all overflow-hidden">
                  <div className="flex items-stretch">
                    <div className="w-1.5 bg-gradient-to-b from-blue-500 to-indigo-600 flex-shrink-0" />
                    <div className="p-4 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow flex-shrink-0">
                            {e.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{e.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{e.role}</span>
                              <span className="text-xs text-gray-400">{e.department}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Btn size="sm" variant="secondary" onClick={() => openEditEmp(e)}>✏️</Btn>
                          <Btn size="sm" variant="danger" onClick={() => { if (confirm(`Remover ${e.name}?`)) store.deleteEmployee(e.id); }}>🗑️</Btn>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">CPF</p>
                          <p className="text-xs font-mono text-gray-700">{e.cpf}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Telefone</p>
                          <p className="text-xs font-bold text-gray-700">{e.phone}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Admissão</p>
                          <p className="text-xs font-bold text-gray-700">{fmtDate(e.admissionDate)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Salário</p>
                          <p className="text-xs font-bold text-gray-700">{e.salary ? fmtMoney(e.salary) : '-'}</p>
                        </div>
                      </div>
                      {e.notes && (
                        <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2 italic">📝 {e.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Novo/Editar Morador ou Porteiro */}
      {showUserModal && (
        <Modal
          title={editUser ? `✏️ Editar ${tab === 'moradores' ? 'Morador' : 'Porteiro'}` : `➕ ${tab === 'moradores' ? 'Novo Morador' : 'Novo Porteiro'}`}
          onClose={() => { setShowUserModal(false); resetUserForm(); }}
          wide
        >
          <div className="space-y-5">
            {/* Info de acesso */}
            <div className={`rounded-xl p-4 border ${tab === 'moradores' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{tab === 'moradores' ? '🏠' : '🚪'}</span>
                <div>
                  <p className={`text-sm font-bold ${tab === 'moradores' ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {tab === 'moradores' ? 'Cadastro de Morador com Acesso ao Sistema' : 'Cadastro de Porteiro com Acesso ao Sistema'}
                  </p>
                  <p className={`text-xs mt-0.5 ${tab === 'moradores' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {tab === 'moradores' ? 'O morador receberá e-mail e senha para acessar o painel e gerenciar cobranças, reservas e encomendas.' : 'O porteiro receberá acesso para registrar encomendas e consultar moradores.'}
                  </p>
                </div>
              </div>
            </div>

            {/* FOTO DO MORADOR/PORTEIRO */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-lg">📷</span> Foto do {tab === 'moradores' ? 'Morador' : 'Porteiro'}
              </h4>
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center shadow-inner">
                    {uPhoto ? (
                      <img src={uPhoto} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <div className="text-3xl">👤</div>
                        <p className="text-xs text-gray-400 mt-1">Sem foto</p>
                      </div>
                    )}
                  </div>
                  {uPhoto && (
                    <button type="button" onClick={() => setUPhoto('')}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 shadow-md">✕</button>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-gray-500">Tire uma foto com a câmera ou escolha um arquivo do dispositivo.</p>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={startUCamera}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm">
                      📷 Câmera
                    </button>
                    <button type="button" onClick={() => uFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors border border-gray-200">
                      📁 Arquivo
                    </button>
                    <input ref={uFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUFileUpload} />
                  </div>
                  <p className="text-xs text-gray-400">JPG, PNG ou WebP · Máx. 5MB</p>
                </div>
              </div>
              {uShowCamera && (
                <div className="mt-4 rounded-2xl overflow-hidden border-2 border-indigo-300 bg-black relative">
                  <video ref={uVideoRef} autoPlay playsInline muted className="w-full max-h-56 object-cover" />
                  <canvas ref={uCanvasRef} className="hidden" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                    <button type="button" onClick={takeUPhoto}
                      className="px-5 py-2.5 bg-white text-gray-900 font-black rounded-full text-sm shadow-lg hover:bg-indigo-50 transition-colors flex items-center gap-2">
                      📸 Capturar
                    </button>
                    <button type="button" onClick={stopUCamera}
                      className="px-4 py-2.5 bg-red-500 text-white font-bold rounded-full text-sm shadow-lg hover:bg-red-600 transition-colors">
                      ✕ Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* INFORMAÇÕES PESSOAIS */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
              <h4 className="text-sm font-bold text-indigo-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                Informações Pessoais
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Nome Completo" required error={uErrors.name}>
                  <Input value={uName} onChange={e => setUName(e.target.value)} placeholder="Ex: Maria da Silva Santos" error={!!uErrors.name} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="CPF" required error={uErrors.cpf}>
                    <Input value={uCpf} onChange={e => { setUCpf(formatCPF(e.target.value)); }} placeholder="000.000.000-00" maxLength={14} error={!!uErrors.cpf} />
                  </Field>
                  <Field label="Data de Nascimento" required error={uErrors.birth}>
                    <Input type="date" value={uBirth} onChange={e => setUBirth(e.target.value)} max={new Date().toISOString().split('T')[0]} error={!!uErrors.birth} />
                  </Field>
                </div>
                {age !== null && age >= 0 && (
                  <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                    <span>🎂</span><span><strong>{age} anos</strong> de idade</span>
                  </div>
                )}
                <Field label="Telefone">
                  <Input value={uPhone} onChange={e => setUPhone(e.target.value)} placeholder="(11) 99999-0000" />
                </Field>
              </div>
            </div>

            {/* ACESSO AO PAINEL */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
              <h4 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                Acesso ao Dashboard
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <Field label="E-mail (login)" required error={uErrors.email}>
                  <Input type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} placeholder="email@exemplo.com" error={!!uErrors.email} />
                </Field>
                <Field label={editUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha de Acesso'} required={!editUser} error={uErrors.password}>
                  <div className="relative">
                    <Input type={showUPass ? 'text' : 'password'} value={uPassword} onChange={e => setUPassword(e.target.value)}
                      placeholder={editUser ? 'Nova senha (opcional)' : 'Mínimo 6 caracteres'} error={!!uErrors.password} />
                    <button type="button" onClick={() => setShowUPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                      {showUPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {uPassword && (
                    <div className="flex gap-1 mt-1">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${uPassword.length >= i + 2 ? 'bg-emerald-400' : uPassword.length >= i ? 'bg-amber-400' : 'bg-gray-200'}`} />
                      ))}
                    </div>
                  )}
                </Field>
                {tab === 'moradores' && (
                  <Field label="Unidade / Apartamento">
                    <Input value={uUnit} onChange={e => setUUnit(e.target.value)} placeholder="Ex: 101-A, AP 202" />
                  </Field>
                )}
              </div>
            </div>

            {/* PERMISSÕES E PARENTESCO (apenas moradores) */}
            {tab === 'moradores' && (
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                <h4 className="text-sm font-bold text-violet-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-violet-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                  Permissões e Vínculo
                </h4>
                <div className="space-y-4">
                  {/* Parentesco */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">
                      Parentesco / Vínculo com o titular
                      <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {['Titular', 'Cônjuge', 'Filho(a)', 'Pai/Mãe', 'Inquilino', 'Outro'].map(k => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setUKinship(k === uKinship ? '' : k)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border-2 ${
                            uKinship === k
                              ? 'border-violet-500 bg-violet-500 text-white shadow-md'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:bg-violet-50'
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Toggle: Visualizar cobranças */}
                  <div className={`flex items-start justify-between gap-4 p-4 rounded-2xl border-2 transition-all ${
                    uCanViewCharges ? 'border-emerald-300 bg-emerald-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{uCanViewCharges ? '👁️' : '🚫'}</span>
                        <p className="text-sm font-bold text-gray-800">
                          {uCanViewCharges ? 'Pode visualizar cobranças' : 'Não visualiza cobranças'}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {uCanViewCharges
                          ? 'Este morador pode ver todas as cobranças e pendências financeiras da unidade.'
                          : 'Este morador NÃO terá acesso ao módulo financeiro da unidade.'}
                      </p>
                      {!uCanViewCharges && (
                        <p className="text-xs text-red-600 font-semibold mt-1">
                          ⚠️ Útil para dependentes cadastrados apenas para outros fins.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setUCanViewCharges(p => !p)}
                      className={`relative flex-shrink-0 w-14 h-7 rounded-full transition-all duration-300 focus:outline-none shadow-inner ${
                        uCanViewCharges ? 'bg-emerald-500' : 'bg-red-400'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                        uCanViewCharges ? 'left-7' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => { setShowUserModal(false); resetUserForm(); }}>Cancelar</Btn>
              <Btn variant="primary" onClick={saveUser}>
                {editUser ? '💾 Salvar Alterações' : `✅ Criar ${tab === 'moradores' ? 'Morador' : 'Porteiro'}`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Novo/Editar Funcionário */}
      {showEmpModal && (
        <Modal
          title={editEmp ? `✏️ Editar Funcionário` : `👷 Novo Funcionário`}
          onClose={() => { setShowEmpModal(false); resetEmpForm(); }}
          wide
        >
          <div className="space-y-5">
            {/* Aviso */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-sm font-bold text-blue-800">Registro Documental — Sem Acesso ao Sistema</p>
                  <p className="text-xs text-blue-600 mt-0.5">Funcionários são cadastrados apenas para controle interno e documentação. Eles não têm login no sistema INOVATECH CONNECT.</p>
                </div>
              </div>
            </div>

            {/* DADOS PESSOAIS */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                Dados Pessoais
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Nome Completo" required error={eErrors.name}>
                  <Input value={eName} onChange={e => setEName(e.target.value)} placeholder="Nome do funcionário..." error={!!eErrors.name} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="CPF" required error={eErrors.cpf}>
                    <Input value={eCpf} onChange={e => setECpf(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} error={!!eErrors.cpf} />
                  </Field>
                  <Field label="RG / Documento">
                    <Input value={eDocument} onChange={e => setEDocument(e.target.value)} placeholder="12.345.678-9" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Data de Nascimento" required error={eErrors.birth}>
                    <Input type="date" value={eBirth} onChange={e => setEBirth(e.target.value)} max={new Date().toISOString().split('T')[0]} error={!!eErrors.birth} />
                  </Field>
                  <Field label="Telefone" required error={eErrors.phone}>
                    <Input value={ePhone} onChange={e => setEPhone(e.target.value)} placeholder="(11) 99999-0000" error={!!eErrors.phone} />
                  </Field>
                </div>
                <Field label="E-mail (opcional)">
                  <Input type="email" value={eEmail} onChange={e => setEEmail(e.target.value)} placeholder="email@exemplo.com" />
                </Field>
                <Field label="Endereço">
                  <Input value={eAddress} onChange={e => setEAddress(e.target.value)} placeholder="Rua, número, bairro, cidade..." />
                </Field>
              </div>
            </div>

            {/* CARGO E CONTRATO */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
              <h4 className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                Cargo e Contrato
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Cargo">
                    <Select value={eRole} onChange={e => setERole(e.target.value)}>
                      {cargos.map(c => <option key={c}>{c}</option>)}
                    </Select>
                  </Field>
                  <Field label="Departamento">
                    <Select value={eDept} onChange={e => setEDept(e.target.value)}>
                      {departamentos.map(d => <option key={d}>{d}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Data de Admissão" required error={eErrors.admission}>
                    <Input type="date" value={eAdmission} onChange={e => setEAdmission(e.target.value)} max={new Date().toISOString().split('T')[0]} error={!!eErrors.admission} />
                  </Field>
                  <Field label="Salário (R$)">
                    <Input type="number" value={eSalary} onChange={e => setESalary(e.target.value)} placeholder="2200.00" step="0.01" />
                  </Field>
                </div>
                <Field label="Observações">
                  <Textarea value={eNotes} onChange={e => setENotes(e.target.value)} rows={2} placeholder="Observações sobre o funcionário, turno, responsabilidades..." />
                </Field>
              </div>
            </div>

            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => { setShowEmpModal(false); resetEmpForm(); }}>Cancelar</Btn>
              <Btn variant="primary" onClick={saveEmp}>
                {editEmp ? '💾 Salvar Alterações' : '👷 Registrar Funcionário'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: RESIDENTS (mantido para porteiro consultar)
// ═══════════════════════════════════════════════════════════════════════════
function ResidentsSection({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  const residents = store.getUsersByCondoId(user.condoId!).filter(u => u.role !== 'admin');
  const roleLabels: Record<UserRole, string> = { admin: '👨‍💼 Admin', 'admin-master': '👨‍💼 Admin Master', sindico: '🏢 Síndico', porteiro: '🚪 Porteiro', morador: '🏠 Morador' };
  const roleColors: Record<UserRole, string> = { admin: 'blue', 'admin-master': 'blue', sindico: 'blue', porteiro: 'orange', morador: 'green' };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <Table headers={['Nome', 'CPF', 'Nascimento', 'Telefone', 'Perfil', 'Unidade']}>
        {residents.map((r, i) => (
          <TR key={r.id} idx={i}>
            <TD>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">{r.name[0]}</div>
                <div>
                  <p className="font-semibold text-gray-800">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.email}</p>
                </div>
              </div>
            </TD>
            <TD><span className="font-mono text-xs">{r.cpf}</span></TD>
            <TD>
              <div>
                <p className="text-sm">{r.birthDate ? fmtDate(r.birthDate) : '-'}</p>
                {r.birthDate && <p className="text-xs text-gray-400">{calcAge(r.birthDate)} anos</p>}
              </div>
            </TD>
            <TD>{r.phone ?? '-'}</TD>
            <TD><Badge label={roleLabels[r.role]} color={roleColors[r.role]} /></TD>
            <TD>{r.unit ?? '-'}</TD>
          </TR>
        ))}
      </Table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL PIX — Pagamento via PIX com QR Code
// ═══════════════════════════════════════════════════════════════════════════
interface PixModalProps {
  invoice: Invoice;
  onClose: () => void;
  onConfirm: () => void;
}

interface Invoice {
  id: string;
  condoId: string;
  userId: string;
  userName: string;
  unit: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
  createdAt: string;
}

function PixModal({ invoice, onClose, onConfirm }: PixModalProps) {
  const store = useStore();
  const pixConfig = store.getPixConfig(invoice.condoId);
  const PIX_KEY = pixConfig?.pixKey || '11.999.888/0001-77';
  const PIX_NAME = pixConfig?.receiverName || 'CONDOMÍNIO';
  const PIX_BANK = pixConfig?.bankName || 'Banco Inter';
  const PIX_TYPE = pixConfig ? { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', phone: 'Telefone', random: 'Chave Aleatória' }[pixConfig.pixKeyType] : 'CNPJ';
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'choose' | 'qr' | 'key' | 'success'>('choose');
  const [countdown, setCountdown] = useState(5);

  // Gera payload PIX simulado (EMV format simplificado)
  const pixPayload = `00020126580014BR.GOV.BCB.PIX0136${PIX_KEY}5204000053039865406${invoice.amount.toFixed(2).replace('.', '')}5802BR5925${PIX_NAME.slice(0, 25)}6008SAOPAULO62070503***6304ABCD`;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = PIX_KEY;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handlePaid = () => {
    setStep('success');
    let c = 5;
    const iv = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) { clearInterval(iv); onConfirm(); onClose(); }
    }, 1000);
  };

  return (
    <Modal title="💚 Pagamento via PIX" onClose={onClose} wide>
      <div className="space-y-4">

        {/* Header com valor */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
              💚
            </div>
            <p className="text-white/80 text-sm font-medium mb-1">{invoice.description}</p>
            <p className="text-white/60 text-xs mb-3">Unidade {invoice.unit} · {invoice.userName}</p>
            <div className="text-4xl font-black tracking-tight">
              {fmtMoney(invoice.amount)}
            </div>
            <p className="text-white/60 text-xs mt-2">Vencimento: {fmtDate(invoice.dueDate)}</p>
          </div>
        </div>

        {/* STEP: ESCOLHER MÉTODO */}
        {step === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700 text-center">Escolha como deseja pagar:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* QR Code */}
              <button
                onClick={() => setStep('qr')}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-all group"
              >
                <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-white text-3xl group-hover:scale-110 transition-transform shadow-lg shadow-green-200">
                  ⬛
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-800 text-sm">QR Code PIX</p>
                  <p className="text-xs text-gray-500 mt-0.5">Escaneie com o app do banco</p>
                </div>
              </button>

              {/* Chave PIX */}
              <button
                onClick={() => setStep('key')}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-all group"
              >
                <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-3xl group-hover:scale-110 transition-transform shadow-lg shadow-blue-200">
                  📋
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-800 text-sm">Copiar Chave</p>
                  <p className="text-xs text-gray-500 mt-0.5">Cole no seu app bancário</p>
                </div>
              </button>
            </div>

            {/* Info do recebedor */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Dados do Recebedor</p>
              <div className="space-y-2">
                {[
                  { label: 'Nome', value: PIX_NAME },
                  { label: 'CNPJ', value: PIX_KEY },
                  { label: 'Banco', value: PIX_BANK },
                  { label: 'Tipo', value: PIX_TYPE },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs font-bold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP: QR CODE */}
        {step === 'qr' && (
          <div className="space-y-4">
            <button onClick={() => setStep('choose')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              ← Voltar
            </button>

            {/* QR Code visual */}
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white rounded-3xl p-5 shadow-xl border-2 border-green-100 relative">
                {/* Logo PIX no centro do QR */}
                <div className="relative">
                  <QRCanvas data={pixPayload} size={220} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg border-2 border-white">
                      <span className="text-white font-black text-xs">PIX</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instrução */}
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-gray-700">Escaneie com o app do seu banco</p>
                <p className="text-xs text-gray-500">Abra o app → PIX → Ler QR Code</p>
              </div>

              {/* Copiar código PIX copia e cola */}
              <button
                onClick={copyPixCode}
                className={`w-full py-3 rounded-2xl font-bold text-sm transition-all border-2 flex items-center justify-center gap-2 ${
                  copied
                    ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-200'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-green-400 hover:text-green-600'
                }`}
              >
                {copied ? '✅ Código PIX copiado!' : '📋 Copiar código PIX (copia e cola)'}
              </button>
            </div>

            {/* Timer simulado */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">⏱️</div>
              <div>
                <p className="text-sm font-bold text-amber-800">QR Code válido por 30 minutos</p>
                <p className="text-xs text-amber-600">Após o pagamento, confirme abaixo para atualizar o status</p>
              </div>
            </div>

            {/* Botão confirmar pagamento */}
            <Btn variant="success" onClick={handlePaid}>
              ✅ Já fiz o pagamento PIX
            </Btn>
          </div>
        )}

        {/* STEP: CHAVE PIX */}
        {step === 'key' && (
          <div className="space-y-4">
            <button onClick={() => setStep('choose')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              ← Voltar
            </button>

            {/* Passos */}
            <div className="space-y-3">
              {[
                { n: '1', icon: '📱', title: 'Abra o app do seu banco', desc: 'Acesse a área de PIX no aplicativo' },
                { n: '2', icon: '🔑', title: 'Escolha "PIX com chave"', desc: 'Selecione transferência via chave PIX' },
                { n: '3', icon: '📋', title: 'Cole a chave PIX abaixo', desc: 'Cole o CNPJ como chave de destino' },
                { n: '4', icon: '💰', title: `Informe o valor: ${fmtMoney(invoice.amount)}`, desc: 'Digite o valor exato da cobrança' },
              ].map(s => (
                <div key={s.n} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-black flex-shrink-0">{s.n}</div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-1">{s.icon} {s.title}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chave PIX com botão copiar */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-5">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">🔑 Chave PIX (CNPJ)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white rounded-xl border border-green-200 px-4 py-3">
                  <p className="font-mono font-bold text-gray-800 text-lg tracking-wider">{PIX_KEY}</p>
                </div>
                <button
                  onClick={copyKey}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center shadow ${
                    copied
                      ? 'bg-green-500 text-white shadow-green-200'
                      : 'bg-white border-2 border-green-300 text-green-600 hover:bg-green-500 hover:text-white hover:border-green-500'
                  }`}
                >
                  {copied ? '✅' : '📋'}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 font-semibold mt-2 flex items-center gap-1">
                  ✅ Chave PIX copiada para a área de transferência!
                </p>
              )}
            </div>

            {/* Dados completos */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Confirme os dados do recebedor</p>
              <div className="space-y-2">
                {[
                  { label: 'Favorecido', value: PIX_NAME, icon: '🏢' },
                  { label: 'Banco', value: PIX_BANK, icon: '🏦' },
                  { label: 'Valor', value: fmtMoney(invoice.amount), icon: '💰', highlight: true },
                  { label: 'Descrição', value: invoice.description, icon: '📝' },
                ].map(item => (
                  <div key={item.label} className={`flex items-center justify-between p-2 rounded-xl ${item.highlight ? 'bg-green-50' : ''}`}>
                    <span className="text-xs text-gray-500 flex items-center gap-1">{item.icon} {item.label}</span>
                    <span className={`text-sm font-bold ${item.highlight ? 'text-green-700' : 'text-gray-800'}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botão confirmar */}
            <Btn variant="success" onClick={handlePaid}>
              ✅ Já fiz o pagamento PIX
            </Btn>
          </div>
        )}

        {/* STEP: SUCESSO */}
        {step === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-5xl"
              style={{ animation: 'bounceIn 0.5s ease-out' }}>
              ✅
            </div>
            <div>
              <h3 className="text-2xl font-black text-green-600">Pagamento Registrado!</h3>
              <p className="text-gray-500 text-sm mt-2">Seu pagamento de <strong>{fmtMoney(invoice.amount)}</strong> foi confirmado.</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="text-sm text-green-700 font-semibold">Comprovante gerado com sucesso</p>
              <p className="text-xs text-green-600 mt-1">O status da cobrança foi atualizado para <strong>PAGO</strong>.</p>
              <div className="mt-3 text-xs text-gray-500 font-mono bg-white rounded-xl p-3 border border-green-100">
                TXN: PIX{Date.now().toString().slice(-8)}<br />
                Data: {new Date().toLocaleString('pt-BR')}<br />
                Valor: {fmtMoney(invoice.amount)}<br />
                Status: APROVADO ✅
              </div>
            </div>
            <p className="text-sm text-gray-400">Fechando automaticamente em <strong className="text-green-600">{countdown}s</strong>...</p>
          </div>
        )}

        {/* Rodapé de segurança */}
        {step !== 'success' && (
          <div className="flex items-center justify-center gap-4 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span>🔒</span><span>Transação segura</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span>🏦</span><span>Banco Central</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span>⚡</span><span>Instantâneo</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: FINANCE
// ═══════════════════════════════════════════════════════════════════════════
function FinanceSection({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  const [showModal, setShowModal] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState('all');
  const isMorador = user.role === 'morador';
  // Verificar se morador tem permissão para ver cobranças
  if (isMorador && user.canViewCharges === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mb-4">🚫</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h3>
        <p className="text-gray-500 text-sm max-w-sm">Você não tem permissão para visualizar as cobranças desta unidade. Entre em contato com o síndico do condomínio.</p>
      </div>
    );
  }
  const invoices = isMorador ? store.getInvoicesByUser(user.id) : store.getInvoices(user.condoId);
  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const users = store.getUsersByCondoId(user.condoId!).filter(u => u.role === 'morador');

  const statusColors: Record<string, string> = { paid: 'green', pending: 'yellow', overdue: 'red' };
  const statusLabels: Record<string, string> = { paid: '✅ Pago', pending: '⏳ Pendente', overdue: '❌ Vencido' };

  const save = () => {
    const target = users.find(u => u.unit === targetUnit);
    if (!target || !desc || !amount || !dueDate) return;
    store.addInvoice({ condoId: user.condoId!, userId: target.id, userName: target.name, unit: targetUnit, description: desc, amount: parseFloat(amount), dueDate, status: 'pending' });
    setShowModal(false); setDesc(''); setAmount(''); setDueDate(''); setTargetUnit('');
  };

  const openPix = (inv: Invoice) => {
    setSelectedInvoice(inv as Invoice);
    setShowPixModal(true);
  };

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon="✅" label="Total Recebido" value={fmtMoney(totalPaid)} color="green" />
        <StatCard icon="⏳" label="A Receber" value={fmtMoney(totalPending)} color="orange" />
        <StatCard icon="📄" label="Total de Cobranças" value={invoices.length} color="blue" />
      </div>

      {/* PIX banner para moradores */}
      {isMorador && invoices.filter(i => i.status !== 'paid').length > 0 && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-green-100">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">💚</div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Pague suas cobranças via PIX</p>
            <p className="text-white/70 text-xs mt-0.5">Instantâneo, seguro e sem taxas. Clique em "Pagar PIX" em qualquer cobrança pendente.</p>
          </div>
          <div className="text-white font-black text-2xl">PIX</div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'paid', 'overdue'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${filter === f ? 'bg-indigo-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'all' ? 'Todas' : statusLabels[f]}
            </button>
          ))}
        </div>
        {!isMorador && <Btn variant="primary" onClick={() => setShowModal(true)}>➕ Nova Cobrança</Btn>}
      </div>

      {/* Tabela de cobranças */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile: cards */}
        <div className="block sm:hidden divide-y divide-gray-50">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm">Nenhuma cobrança encontrada.</p>
            </div>
          )}
          {filtered.map((inv, i) => (
            <div key={inv.id} className="p-4 hover:bg-gray-50 transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{inv.description}</p>
                  <p className="text-xs text-gray-400">{inv.userName} · Unidade {inv.unit}</p>
                </div>
                <Badge label={statusLabels[inv.status]} color={statusColors[inv.status]} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-black text-gray-800">{fmtMoney(inv.amount)}</p>
                  <p className="text-xs text-gray-400">Vence: {fmtDate(inv.dueDate)}</p>
                </div>
                <div className="flex gap-2">
                  {inv.status !== 'paid' && (
                    <button
                      onClick={() => openPix(inv)}
                      className="px-3 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition-colors shadow-sm flex items-center gap-1"
                    >
                      💚 PIX
                    </button>
                  )}
                  {!isMorador && (
                    <>
                      {inv.status !== 'paid' && (
                        <Btn size="sm" variant="success" onClick={() => store.markInvoicePaid(inv.id)}>✅</Btn>
                      )}
                      <Btn size="sm" variant="danger" onClick={() => { if (confirm('Excluir cobrança?')) store.deleteInvoice(inv.id); }}>🗑️</Btn>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden sm:block">
          <Table headers={['Descrição', 'Unidade', 'Valor', 'Vencimento', 'Status', 'Ações']}>
            {filtered.map((inv, i) => (
              <TR key={inv.id} idx={i}>
                <TD>
                  <div className="font-medium text-gray-800">{inv.description}</div>
                  <div className="text-xs text-gray-400">{inv.userName}</div>
                </TD>
                <TD>{inv.unit}</TD>
                <TD><span className="font-bold text-gray-800">{fmtMoney(inv.amount)}</span></TD>
                <TD>{fmtDate(inv.dueDate)}</TD>
                <TD><Badge label={statusLabels[inv.status]} color={statusColors[inv.status]} /></TD>
                <TD>
                  <div className="flex gap-1.5 items-center">
                    {/* Botão PIX para qualquer cobrança pendente */}
                    {inv.status !== 'paid' && (
                      <button
                        onClick={() => openPix(inv)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                      >
                        <span className="text-base leading-none">💚</span>
                        <span>Pagar PIX</span>
                      </button>
                    )}
                    {!isMorador && (
                      <>
                        {inv.status !== 'paid' && (
                          <Btn size="sm" variant="success" onClick={() => store.markInvoicePaid(inv.id)}>✅ Pago</Btn>
                        )}
                        <Btn size="sm" variant="danger" onClick={() => { if (confirm('Excluir cobrança?')) store.deleteInvoice(inv.id); }}>🗑️</Btn>
                      </>
                    )}
                    {inv.status === 'paid' && (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        ✅ Quitado
                      </span>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        </div>
      </div>

      {/* Modal nova cobrança (síndico) */}
      {showModal && (
        <Modal title="Nova Cobrança" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Morador / Unidade" required>
              <Select value={targetUnit} onChange={e => setTargetUnit(e.target.value)}>
                <option value="">Selecionar morador...</option>
                {users.map(u => <option key={u.id} value={u.unit!}>{u.name} - {u.unit}</option>)}
              </Select>
            </Field>
            <Field label="Descrição" required>
              <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Taxa Condominial..." />
            </Field>
            <Field label="Valor (R$)" required>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="450.00" />
            </Field>
            <Field label="Vencimento" required>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </Field>

            {/* PIX info no modal do síndico */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">💚</span>
              <p className="text-sm text-green-700 font-medium">O morador poderá pagar esta cobrança via PIX diretamente pelo painel.</p>
            </div>

            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
              <Btn variant="primary" onClick={save}>Salvar Cobrança</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal PIX */}
      {showPixModal && selectedInvoice && (
        <PixModal
          invoice={selectedInvoice}
          onClose={() => { setShowPixModal(false); setSelectedInvoice(null); }}
          onConfirm={() => store.markInvoicePaid(selectedInvoice.id)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: DELIVERIES — QR CODE SYSTEM COM CÂMERA REAL
// ═══════════════════════════════════════════════════════════════════════════
function DeliveriesSection({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  const isPorteiro = user.role === 'porteiro';
  const isMorador = user.role === 'morador';
  const isSindico = user.role === 'sindico';
  const [tab, setTab] = useState<'waiting' | 'delivered'>('waiting');
  const [showForm, setShowForm] = useState(false);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sender, setSender] = useState('');
  const [tracking, setTracking] = useState('');
  const [desc, setDesc] = useState('');
  const [unit, setUnit] = useState('');
  const residents = store.getUsersByCondoId(user.condoId!).filter(u => u.role === 'morador');
  const allDeliveries = isMorador
    ? store.getDeliveriesByUnit(user.unit!)
    : store.getDeliveries(user.condoId!);
  const filtered = allDeliveries.filter(d => d.status === (tab === 'waiting' ? 'waiting' : 'delivered'));

  const addDelivery = () => {
    const resident = residents.find(r => r.unit === unit);
    if (!resident || !sender) return;
    store.addDelivery({
      condoId: user.condoId!, unit, residentName: resident.name, sender,
      trackingCode: tracking || `TRK${Date.now()}`,
      description: desc || 'Encomenda', status: 'waiting', notified: true
    });
    setSender(''); setTracking(''); setDesc(''); setUnit(''); setShowForm(false);
  };

  // Callback quando câmera lê um QR Code real
  const handleCameraScan = (data: string) => {
    setShowCameraScanner(false);
    const ok = store.confirmDeliveryByQR(data.trim());
    if (ok) {
      setScanResult({ ok: true, msg: '✅ Encomenda confirmada com sucesso! Status atualizado para RECEBIDA.' });
    } else {
      setScanResult({ ok: false, msg: '❌ QR Code não reconhecido pelo sistema INOVATECH CONNECT. Certifique-se de escanear o código correto.' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('waiting')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'waiting' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
          📦 Aguardando ({allDeliveries.filter(d => d.status === 'waiting').length})
        </button>
        <button onClick={() => setTab('delivered')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'delivered' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
          ✅ Entregues ({allDeliveries.filter(d => d.status === 'delivered').length})
        </button>
      </div>

      {/* Ações */}
      <div className="flex gap-3 flex-wrap">
        {isPorteiro && <Btn variant="primary" onClick={() => setShowForm(true)}>📦 Registrar Encomenda</Btn>}
        {isMorador && (
          <button
            onClick={() => { setScanResult(null); setShowCameraScanner(true); }}
            className="btn-animated btn-glow-indigo inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #10b981)' }}
          >
            <span className="text-lg">📷</span>
            <span>Ler QR Code da Encomenda</span>
          </button>
        )}
      </div>

      {/* Banner explicativo para morador */}
      {isMorador && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📷</div>
          <div>
            <p className="text-sm font-bold text-indigo-800">Como retirar sua encomenda</p>
            <p className="text-xs text-indigo-600 mt-1">
              1. Quando sua encomenda chegar, você receberá uma notificação.<br/>
              2. Vá à portaria e peça ao porteiro para exibir o QR Code.<br/>
              3. Clique em <strong>"Ler QR Code da Encomenda"</strong> e aponte para o código.<br/>
              4. O sistema confirmará automaticamente a entrega! 🎉
            </p>
          </div>
        </div>
      )}

      {/* Scan result */}
      {scanResult && (
        <div className={`p-4 rounded-xl border ${scanResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'} flex items-center gap-3`}>
          <span className="text-2xl">{scanResult.ok ? '✅' : '❌'}</span>
          <p className="font-semibold text-sm">{scanResult.msg}</p>
          <button onClick={() => setScanResult(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Grid de encomendas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-medium">Nenhuma encomenda {tab === 'waiting' ? 'aguardando' : 'entregue'}</p>
          </div>
        )}
        {filtered.map(d => (
          <div key={d.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all ${d.status === 'waiting' ? 'border-amber-200' : 'border-emerald-200'} overflow-hidden`}>
            <div className={`h-1.5 ${d.status === 'waiting' ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-green-500'}`} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${d.status === 'waiting' ? 'bg-amber-100' : 'bg-emerald-100'} flex items-center justify-center text-2xl`}>
                    {d.status === 'waiting' ? '📦' : '✅'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{d.residentName}</p>
                    <p className="text-xs text-gray-500">Unidade {d.unit}</p>
                  </div>
                </div>
                <Badge label={d.status === 'waiting' ? 'Aguardando' : 'Entregue'} color={d.status === 'waiting' ? 'yellow' : 'green'} />
              </div>
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>🏪</span><span><strong>Remetente:</strong> {d.sender}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>🔍</span><span><strong>Rastreio:</strong> <span className="font-mono">{d.trackingCode}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>📝</span><span>{d.description}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>📅</span><span><strong>Chegou:</strong> {fmtDate(d.arrivedAt)}</span>
                </div>
                {d.deliveredAt && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <span>✅</span><span><strong>Entregue:</strong> {fmtDate(d.deliveredAt)}</span>
                  </div>
                )}
              </div>

              {/* QR Code actions */}
              <div className="flex gap-2 flex-wrap">
                {(isPorteiro || isSindico) && d.status === 'waiting' && (
                  <Btn size="sm" variant="secondary" onClick={() => setShowQR(d.qrToken)}>
                    ⬛ Exibir QR Code
                  </Btn>
                )}
                {isMorador && d.status === 'waiting' && (
                  <button
                    onClick={() => { setScanResult(null); setShowCameraScanner(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 transition-colors"
                  >
                    📷 Escanear QR para Retirar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Registrar Encomenda (Porteiro) */}
      {showForm && (
        <Modal title="📦 Registrar Nova Encomenda" onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <Field label="Unidade do Morador" required>
              <Select value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="">Selecionar unidade...</option>
                {residents.filter(r => r.unit).map(r => <option key={r.id} value={r.unit!}>{r.unit} - {r.name}</option>)}
              </Select>
            </Field>
            <Field label="Remetente / Loja" required><Input value={sender} onChange={e => setSender(e.target.value)} placeholder="Amazon, Mercado Livre..." /></Field>
            <Field label="Código de Rastreio"><Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="AMZ123456BR" /></Field>
            <Field label="Descrição"><Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Caixa grande, envelope..." /></Field>
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <p className="text-sm text-indigo-700 font-semibold">🔐 Sistema de QR Code Interno</p>
              <p className="text-xs text-indigo-500 mt-1">Ao registrar, um QR Code exclusivo será gerado. O morador deverá escanear com a câmera do celular pelo sistema para confirmar o recebimento.</p>
            </div>
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Btn>
              <Btn variant="primary" onClick={addDelivery}>✅ Registrar + Gerar QR</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: QR Code Display (Porteiro mostra ao morador) */}
      {showQR && (
        <Modal title="🔐 QR Code da Encomenda" onClose={() => setShowQR(null)}>
          <div className="flex flex-col items-center gap-5">
            <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-indigo-100">
              <QRCanvas data={showQR} size={220} />
            </div>
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 w-full text-center">
              <p className="text-sm font-bold text-indigo-800 mb-1">📱 Peça ao morador para escanear</p>
              <p className="text-xs text-indigo-600">O morador deve clicar em "Ler QR Code da Encomenda" no painel e apontar a câmera para este código.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 w-full">
              <p className="text-sm text-amber-700 font-semibold flex items-center gap-2">
                <span>🔒</span> QR Code Interno INOVATECH CONNECT
              </p>
              <p className="text-xs text-amber-600 mt-1">Este código é criptografado e reconhecido exclusivamente pelo sistema. Câmeras externas não conseguem processar a entrega.</p>
            </div>
          </div>
        </Modal>
      )}

      {/* CÂMERA REAL — Scanner fullscreen */}
      {showCameraScanner && (
        <QRScannerCamera
          onScan={handleCameraScan}
          onClose={() => setShowCameraScanner(false)}
          onError={(err) => {
            setShowCameraScanner(false);
            if (err === 'denied') {
              setScanResult({ ok: false, msg: '🚫 Permissão de câmera negada. Permita o acesso nas configurações do navegador.' });
            } else if (err === 'not_found') {
              setScanResult({ ok: false, msg: '📷 Câmera não encontrada. Verifique se seu dispositivo possui câmera.' });
            }
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════════════════
function AnnouncementsSection({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const items = store.getAnnouncements(user.condoId);
  const canCreate = user.role === 'sindico' || user.role === 'admin';
  const prioColors: Record<string, string> = { normal: 'blue', important: 'orange', urgent: 'red' };
  const prioLabels: Record<string, string> = { normal: '📌 Normal', important: '⚠️ Importante', urgent: '🚨 Urgente' };

  const save = () => {
    if (!title.trim() || !content.trim()) return;
    store.addAnnouncement({ condoId: user.condoId!, title, content, authorId: user.id, authorName: user.name, priority });
    setTitle(''); setContent(''); setPriority('normal'); setShowModal(false);
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Btn variant="primary" onClick={() => setShowModal(true)}>📢 Novo Comunicado</Btn>
        </div>
      )}
      <div className="space-y-3">
        {items.length === 0 && <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">📭</div><p>Nenhum comunicado</p></div>}
        {items.slice().reverse().map((a, i) => (
          <div key={a.id} style={{ animationDelay: `${i * 80}ms` }}
            className={`bg-white rounded-2xl border shadow-sm p-5 ${a.priority === 'urgent' ? 'border-red-200' : a.priority === 'important' ? 'border-amber-200' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge label={prioLabels[a.priority]} color={prioColors[a.priority]} />
                <span className="text-xs text-gray-400">{fmtDate(a.createdAt)}</span>
              </div>
              {canCreate && (
                <Btn size="sm" variant="danger" onClick={() => { if (confirm('Excluir comunicado?')) store.deleteAnnouncement(a.id); }}>🗑️</Btn>
              )}
            </div>
            <h3 className="font-bold text-gray-800 mb-2">{a.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{a.content}</p>
            <p className="text-xs text-gray-400 mt-3">— {a.authorName}</p>
          </div>
        ))}
      </div>
      {showModal && (
        <Modal title="📢 Novo Comunicado" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Título"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do comunicado..." /></Field>
            <Field label="Prioridade">
              <Select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}>
                <option value="normal">📌 Normal</option>
                <option value="important">⚠️ Importante</option>
                <option value="urgent">🚨 Urgente</option>
              </Select>
            </Field>
            <Field label="Mensagem"><Textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Escreva o comunicado..." /></Field>
            <div className="flex gap-3"><Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn><Btn variant="primary" onClick={save}>Publicar</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ReservationsSection is imported from ReservationsModule.tsx

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: LICENSE ADMIN — Admin cria cobranças de licença por condomínio
// ═══════════════════════════════════════════════════════════════════════════
function _LicenseAdminSection({ store }: { store: ReturnType<typeof useStore> }) {
  const condos = store.getCondos();
  const charges = store.getLicenseCharges();
  const [showForm, setShowForm] = useState(false);
  const [selectedCondoId, setSelectedCondoId] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reference, setReference] = useState('');
  const [filterCondo, setFilterCondo] = useState('all');

  const filtered = filterCondo === 'all' ? charges : charges.filter(c => c.condoId === filterCondo);

  const statusColors: Record<string, string> = { paid: 'green', pending: 'yellow', overdue: 'red' };
  const statusLabels: Record<string, string> = { paid: '✅ Pago', pending: '⏳ Pendente', overdue: '❌ Vencido' };

  const totalPending = charges.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPaid = charges.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalCharges = charges.length;

  const handleSave = async () => {
    const condo = condos.find(c => c.id === selectedCondoId);
    if (!condo || !desc.trim() || !amount || !dueDate || !reference.trim()) return;

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    const createdLocalCharge = {
      condoId: selectedCondoId,
      condoName: condo.name,
      description: desc.trim(),
      amount: parsedAmount,
      dueDate,
      reference: reference.trim(),
      status: 'pending' as const,
      viewedBySindico: false,
    };

    const token = localStorage.getItem('auth_token') || localStorage.getItem('authToken');
    let syncedBillingId: string | undefined;
    let syncedCreatedAt: string | undefined;
    let gatewayWarning = '';

    if (token) {
      try {
        const manualBillingRes = await fetch(`/api/master-gateway/condos/${selectedCondoId}/manual-license-billing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            description: desc.trim(),
            amount: parsedAmount,
            dueDate,
            customerName: condo.name,
            customerEmail: condo.email || null,
            customerCnpj: condo.cnpj || null
          })
        });

        const manualBillingData = await manualBillingRes.json();
        if (!manualBillingRes.ok) {
          throw new Error(manualBillingData?.error || 'Falha ao salvar cobranca no banco');
        }

        syncedBillingId = manualBillingData?.billing?.id;
        syncedCreatedAt = manualBillingData?.billing?.createdAt;

        if (!syncedBillingId) {
          throw new Error('Resposta invalida ao criar cobranca no banco');
        }

        try {
          const chargeRes = await fetch(`/api/master-gateway/condos/${selectedCondoId}/charge-license`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              billingId: syncedBillingId,
              method: 'pix'
            })
          });

          const chargeData = await chargeRes.json();
          if (!chargeRes.ok) {
            throw new Error(chargeData?.error || chargeData?.details || 'Falha ao criar cobranca no gateway');
          }
        } catch (error: any) {
          gatewayWarning = error?.message || 'erro desconhecido';
        }
      } catch (error: any) {
        alert(`Falha ao criar cobranca no banco/gateway: ${error?.message || 'erro desconhecido'}`);
        return;
      }
    } else {
      alert('Token nao encontrado. A cobranca foi criada apenas localmente.');
    }

    store.addLicenseCharge({
      ...createdLocalCharge,
      id: syncedBillingId,
      createdAt: syncedCreatedAt,
    });

    if (gatewayWarning) {
      alert(`Cobranca criada no banco, mas houve falha na emissao no gateway: ${gatewayWarning}`);
    }

    setShowForm(false);
    setSelectedCondoId(''); setDesc(''); setAmount(''); setDueDate(''); setReference('');
  };

  const handleMarkPaid = (id: string) => {
    const charge = store.getLicenseCharges().find(c => c.id === id);
    const condo = condos.find(c => c.id === charge?.condoId);
    const msg = condo?.blocked
      ? `✅ Confirmar pagamento da licença de "${charge?.condoName}"?\n\n🔓 O condomínio será DESBLOQUEADO automaticamente e todos os usuários voltarão a ter acesso.`
      : `✅ Confirmar pagamento da licença de "${charge?.condoName}"?`;
    if (confirm(msg)) {
      store.markLicensePaid(id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon="💳" label="Total Cobranças" value={totalCharges} color="blue" sub="licenças emitidas" />
        <StatCard icon="✅" label="Total Recebido" value={fmtMoney(totalPaid)} color="green" sub="licenças pagas" />
        <StatCard icon="⚠️" label="A Receber" value={fmtMoney(totalPending)} color="orange" sub="pendente/vencido" />
      </div>

      {/* Status dos condomínios */}
      <div className="panel-card-refined p-5">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-sm">🏢</span>
          Status de Licença por Condomínio
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {condos.map(condo => {
            const condoCharges = charges.filter(c => c.condoId === condo.id);
            const hasPending = condoCharges.some(c => c.status === 'pending');
            const hasOverdue = condoCharges.some(c => c.status === 'overdue');
            const lastCharge = condoCharges.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            return (
              <div key={condo.id} className={`rounded-2xl border-2 p-4 transition-all ${
                condo.blocked ? 'border-red-300 bg-red-50' :
                hasOverdue ? 'border-orange-300 bg-orange-50' :
                hasPending ? 'border-amber-200 bg-amber-50' :
                'border-emerald-200 bg-emerald-50'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{condo.name}</p>
                    <p className="text-xs text-gray-500">{condo.city}</p>
                  </div>
                  <Badge
                    label={condo.blocked ? '🔒 Bloqueado' : hasOverdue ? '❌ Vencido' : hasPending ? '⏳ Pendente' : '✅ Em dia'}
                    color={condo.blocked ? 'red' : hasOverdue ? 'orange' : hasPending ? 'yellow' : 'green'}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>💰 Licença: <strong className="text-gray-700">{fmtMoney(condo.licenseValue)}/mês</strong></span>
                </div>
                {lastCharge && (
                  <div className="text-xs text-gray-500 mb-2">
                    Última cobrança: {lastCharge.reference}
                    {lastCharge.viewedBySindico && <span className="ml-1 text-emerald-600 font-semibold">· 👁️ Visualizada</span>}
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  {condo.blocked ? (
                    <button
                      onClick={() => {
                        if (confirm(`Desbloquear "${condo.name}"?\nTodos os usuários voltarão a ter acesso ao sistema.`)) {
                          store.unblockCondo(condo.id);
                        }
                      }}
                      className="flex-1 py-2 text-xs font-bold bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-1"
                    >
                      🔓 Desbloquear Acesso
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (confirm(`Bloquear "${condo.name}"?\nTodos os usuários (síndico, porteiro e moradores) perderão o acesso.`)) {
                          store.blockCondo(condo.id);
                        }
                      }}
                      className="flex-1 py-2 text-xs font-bold bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:bg-red-300 transition-colors border border-red-200 flex items-center justify-center gap-1"
                    >
                      🔒 Bloquear Acesso
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista de cobranças */}
      <div className="panel-card-refined">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-gray-800">💳 Cobranças de Licença</h3>
            <select
              value={filterCondo}
              onChange={e => setFilterCondo(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-indigo-400"
            >
              <option value="all">Todos os condomínios</option>
              {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Btn variant="primary" onClick={() => setShowForm(true)}>➕ Nova Cobrança de Licença</Btn>
        </div>
        <div className="overflow-x-auto">
          <Table headers={['Condomínio', 'Descrição', 'Referência', 'Valor', 'Vencimento', 'Status', 'Visualizado', 'Ações']}>
            {filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((charge, i) => (
              <TR key={charge.id} idx={i}>
                <TD>
                  <div className="font-semibold text-gray-800 text-sm">{charge.condoName}</div>
                  {condos.find(c => c.id === charge.condoId)?.blocked && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-lg mt-1">
                      🔒 Bloqueado
                    </span>
                  )}
                </TD>
                <TD><span className="text-sm text-gray-600">{charge.description}</span></TD>
                <TD>
                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
                    {charge.reference}
                  </span>
                </TD>
                <TD><span className="font-bold text-gray-800">{fmtMoney(charge.amount)}</span></TD>
                <TD><span className="text-sm">{fmtDate(charge.dueDate)}</span></TD>
                <TD><Badge label={statusLabels[charge.status]} color={statusColors[charge.status]} /></TD>
                <TD>
                  {charge.viewedBySindico ? (
                    <div>
                      <Badge label="👁️ Sim" color="green" />
                      {charge.viewedAt && <p className="text-xs text-gray-400 mt-0.5">{fmtDate(charge.viewedAt)}</p>}
                    </div>
                  ) : (
                    <Badge label="🔕 Não" color="gray" />
                  )}
                </TD>
                <TD>
                  <div className="flex gap-1.5">
                    {charge.status !== 'paid' && (
                      <Btn size="sm" variant="success" onClick={() => handleMarkPaid(charge.id)}>✅ Pago</Btn>
                    )}
                    <Btn size="sm" variant="danger" onClick={() => { if (confirm('Excluir cobrança?')) store.deleteLicenseCharge(charge.id); }}>🗑️ Remover</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        </div>
      </div>

      {/* Modal Nova Cobrança */}
      {showForm && (
        <Modal title="💳 Nova Cobrança de Licença" onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl">💳</div>
                <div>
                  <p className="font-bold text-indigo-800">Cobrança de Licença INOVATECH CONNECT</p>
                  <p className="text-xs text-indigo-600">Esta cobrança será visível apenas para o síndico do condomínio selecionado.</p>
                </div>
              </div>
            </div>
            <Field label="Condomínio" required>
              <Select value={selectedCondoId} onChange={e => {
                setSelectedCondoId(e.target.value);
                const condo = condos.find(c => c.id === e.target.value);
                if (condo) {
                  setAmount(String(condo.licenseValue));
                  const now2 = new Date();
                  const mes = now2.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                  setReference(mes.charAt(0).toUpperCase() + mes.slice(1));
                  setDesc(`Licença INOVATECH CONNECT - ${mes.charAt(0).toUpperCase() + mes.slice(1)}`);
                }
              }}>
                <option value="">Selecionar condomínio...</option>
                {condos.map(c => <option key={c.id} value={c.id}>{c.name} (Licença: {fmtMoney(c.licenseValue)}/mês)</option>)}
              </Select>
            </Field>
            <Field label="Referência (período)" required>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ex: Novembro/2024" />
            </Field>
            <Field label="Descrição" required>
              <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Licença INOVATECH CONNECT..." />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Valor (R$)" required>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="299.00" step="0.01" />
              </Field>
              <Field label="Vencimento" required>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </Field>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-700 font-semibold">⚠️ Regra de bloqueio automático</p>
              <p className="text-xs text-amber-600 mt-1">Condomínios com licença vencida além dos dias configurados no Gateway Master serão bloqueados automaticamente. Nenhum usuário conseguirá fazer login.</p>
            </div>
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Btn>
              <Btn variant="primary" onClick={handleSave}>💳 Criar Cobrança</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: LICENSE SINDICO — substituída por LicenseSindicoPanel (LicensePayment.tsx)
// ═══════════════════════════════════════════════════════════════════════════
function LicenseSindicoSection_UNUSED({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  void user; void store; return null;
}
void LicenseSindicoSection_UNUSED;
function LicenseSindicoSection({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  const charges = store.getLicenseCharges(user.condoId!);
  const condo = store.getCondos().find(c => c.id === user.condoId);

  // Marcar como visualizado ao entrar na tela
  charges.filter(c => !c.viewedBySindico).forEach(c => {
    store.markLicenseViewed(c.id, user.id);
  });

  const statusColors: Record<string, string> = { paid: 'green', pending: 'yellow', overdue: 'red' };
  const statusLabels: Record<string, string> = { paid: '✅ Pago', pending: '⏳ Pendente', overdue: '❌ Vencido' };

  const totalPending = charges.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPaid = charges.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header da licença */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-sm">
              💳
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium uppercase tracking-wide">Licença de Software</p>
              <h2 className="text-xl font-black">INOVATECH CONNECT</h2>
              <p className="text-white/80 text-sm">{condo?.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs uppercase tracking-wide">Valor mensal</p>
            <p className="text-3xl font-black">{fmtMoney(condo?.licenseValue ?? 0)}</p>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-1 ${
              condo?.blocked ? 'bg-red-400/30 text-red-100' : 'bg-emerald-400/30 text-emerald-100'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${condo?.blocked ? 'bg-red-300 animate-pulse' : 'bg-emerald-300'}`} />
              {condo?.blocked ? '🔒 Acesso Bloqueado' : '🟢 Acesso Liberado'}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de bloqueio */}
      {condo?.blocked && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🚨</div>
          <div>
            <h3 className="font-bold text-red-800 text-base">Condomínio BLOQUEADO por inadimplência</h3>
            <p className="text-red-600 text-sm mt-1">
              O acesso ao sistema está bloqueado devido ao não pagamento da licença INOVATECH CONNECT.
              Entre em contato com o suporte para regularizar sua situação.
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-red-700 font-semibold">
              <span>📞</span>
              <span>Suporte: (11) 99999-0000 · suporte@inovatech.com</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon="📋" label="Total de Cobranças" value={charges.length} color="blue" sub="emitidas pelo admin" />
        <StatCard icon="✅" label="Total Pago" value={fmtMoney(totalPaid)} color="green" sub="licenças quitadas" />
        <StatCard icon="⚠️" label="A Pagar" value={fmtMoney(totalPending)} color="orange" sub="pendente/vencido" />
      </div>

      {/* Histórico de cobranças */}
      <div className="panel-card-refined">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <span>📜</span> Histórico de Cobranças da Licença
          </h3>
          <p className="text-xs text-gray-500 mt-1">Apenas o administrador INOVATECH pode criar ou marcar como pago estas cobranças.</p>
        </div>
        {charges.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-medium">Nenhuma cobrança de licença até o momento</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {charges.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((charge, i) => (
              <div key={charge.id} style={{ animationDelay: `${i * 60}ms` }}
                className={`p-4 sm:p-5 hover:bg-gray-50/50 transition-colors ${!charge.viewedBySindico ? 'bg-indigo-50/30' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                      charge.status === 'paid' ? 'bg-emerald-100' : charge.status === 'overdue' ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      {charge.status === 'paid' ? '✅' : charge.status === 'overdue' ? '❌' : '⏳'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{charge.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Referência: <span className="font-semibold text-indigo-600">{charge.reference}</span></p>
                      <p className="text-xs text-gray-400 mt-0.5">Vencimento: {fmtDate(charge.dueDate)}</p>
                      {charge.paidAt && <p className="text-xs text-emerald-600 font-semibold">Pago em: {fmtDate(charge.paidAt)}</p>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-black text-gray-800">{fmtMoney(charge.amount)}</p>
                    <div className="mt-1">
                      <Badge label={statusLabels[charge.status]} color={statusColors[charge.status]} />
                    </div>
                    {!charge.viewedBySindico && (
                      <div className="mt-1">
                        <Badge label="🔔 Novo" color="blue" />
                      </div>
                    )}
                  </div>
                </div>
                {charge.status === 'pending' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs text-amber-700 font-semibold">⚠️ Pagamento pendente</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Após os dias configurados de atraso, o acesso ao sistema será bloqueado automaticamente para todos os usuários do condomínio.
                      Entre em contato com o administrador INOVATECH para realizar o pagamento.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 font-semibold">
                      <span>📞</span>
                      <span>suporte@inovatech.com · (11) 99999-0000</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info sobre o sistema de licença */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>ℹ️</span> Sobre a Licença INOVATECH CONNECT
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '💳', title: 'Cobrança Mensal', desc: 'A licença é cobrada mensalmente pelo uso do sistema de gestão.' },
            { icon: '🔒', title: 'Bloqueio Automático', desc: 'Após o prazo configurado de inadimplência, o acesso é suspenso para todos os usuários.' },
            { icon: '🔓', title: 'Liberação Imediata', desc: 'Ao confirmar o pagamento, o acesso é restaurado imediatamente pelo administrador.' },
            { icon: '📞', title: 'Suporte', desc: 'Para dúvidas ou renegociação, entre em contato: suporte@inovatech.com' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-gray-100">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-bold text-gray-800 text-sm">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: VOTES
// ═══════════════════════════════════════════════════════════════════════════
function VotesSection({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [endDate, setEndDate] = useState('');
  const votes = store.getVotes(user.condoId!);
  const canCreate = user.role === 'sindico' || user.role === 'admin';

  const save = () => {
    if (!title || options.filter(o => o.trim()).length < 2) return;
    store.addVote({ condoId: user.condoId!, title, description: desc, options: options.filter(o => o.trim()).map((o, i) => ({ id: `opt${i}`, text: o, votes: [] })), createdBy: user.id, endDate, status: 'open' });
    setTitle(''); setDesc(''); setOptions(['', '']); setEndDate(''); setShowModal(false);
  };

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="flex justify-end">
          <Btn variant="primary" size="sm" onClick={() => setShowModal(true)}>🗳️ Nova Votação</Btn>
        </div>
      )}
      <div className="space-y-3">
        {votes.length === 0 && <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">🗳️</div><p className="text-sm">Nenhuma votação ativa</p></div>}
        {votes.map((v, i) => {
          const totalVotes = v.options.reduce((s, o) => s + o.votes.length, 0);
          const userVoted = v.options.some(o => o.votes.includes(user.id));
          return (
            <div key={v.id} style={{ animationDelay: `${i * 60}ms` }} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 text-sm truncate">{v.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{v.description}</p>
                </div>
                <div className="flex gap-1.5 items-center flex-shrink-0 ml-2">
                  <Badge label={v.status === 'open' ? 'Aberta' : 'Encerrada'} color={v.status === 'open' ? 'green' : 'red'} />
                  {canCreate && <Btn size="sm" variant="danger" onClick={() => { if (confirm('Excluir votação?')) store.deleteVote(v.id); }}>🗑️</Btn>}
                </div>
              </div>
              <div className="space-y-2">
                {v.options.map(opt => {
                  const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                  return (
                    <div key={opt.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700 truncate flex-1">{opt.text}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{opt.votes.length} votos</span>
                          {!userVoted && v.status === 'open' && user.role === 'morador' && (
                            <Btn size="sm" variant="primary" onClick={() => store.castVote(v.id, opt.id, user.id)}>Votar</Btn>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">{totalVotes} votos · Encerra: {fmtDate(v.endDate)}</span>
                {userVoted && <Badge label="Votou" color="green" />}
              </div>
            </div>
          );
        })}
      </div>
      {showModal && (
        <Modal title="🗳️ Nova Votação" onClose={() => setShowModal(false)} wide>
          <div className="space-y-3">
            <Field label="Título"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da votação..." /></Field>
            <Field label="Descrição"><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Descreva a pauta..." /></Field>
            <Field label="Data de Encerramento"><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></Field>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Opções de Voto</p>
              {options.map((o, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input value={o} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={`Opção ${i + 1}...`} />
                  {options.length > 2 && <Btn size="sm" variant="danger" onClick={() => setOptions(options.filter((_, j) => j !== i))}>✕</Btn>}
                </div>
              ))}
              <Btn size="sm" variant="secondary" onClick={() => setOptions([...options, ''])}>+ Adicionar Opção</Btn>
            </div>
            <div className="flex gap-3"><Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn><Btn variant="primary" onClick={save}>Criar Votação</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
void VotesSection;

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: COMPLAINTS
// ═══════════════════════════════════════════════════════════════════════════
function ComplaintsSection({ user, store }: { user: User; store: ReturnType<typeof useStore> }) {
  const [showModal, setShowModal] = useState(false);
  const [cat, setCat] = useState('Barulho');
  const [desc, setDesc] = useState('');
  const [loc, setLoc] = useState('');
  const [urg, setUrg] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const isMorador = user.role === 'morador';
  const items = store.getComplaints(user.condoId!);
  const urgColors: Record<string, string> = { low: 'blue', medium: 'yellow', high: 'orange', critical: 'red' };
  const urgLabels: Record<string, string> = { low: '🟢 Baixa', medium: '🟡 Média', high: '🟠 Alta', critical: '🔴 Crítica' };
  const statusColors: Record<string, string> = { pending: 'yellow', read: 'blue', resolved: 'green' };
  const statusLabels: Record<string, string> = { pending: '⏳ Pendente', read: '👁️ Lida', resolved: '✅ Resolvida' };
  const categories = ['Barulho', 'Vazamento', 'Limpeza', 'Segurança', 'Manutenção', 'Conduta', 'Outro'];

  const save = () => {
    if (!desc.trim() || !loc.trim()) return;
    store.addComplaint({ condoId: user.condoId!, category: cat, description: desc, location: loc, urgency: urg, status: 'pending', anonymous: true });
    setCat('Barulho'); setDesc(''); setLoc(''); setUrg('medium'); setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {!isMorador && <p className="text-sm text-gray-500">{items.filter(c => c.status === 'pending').length} pendentes</p>}
        <Btn variant="primary" onClick={() => setShowModal(true)}>
          {isMorador ? '⚠️ Enviar Denúncia' : '⚠️ Nova Ocorrência'}
        </Btn>
      </div>
      <div className="space-y-3">
        {items.length === 0 && <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">📋</div><p>Nenhuma denúncia</p></div>}
        {items.slice().reverse().map((c, i) => (
          <div key={c.id} style={{ animationDelay: `${i * 60}ms` }}
            className="panel-card-refined p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge label={urgLabels[c.urgency]} color={urgColors[c.urgency]} />
                <Badge label={statusLabels[c.status]} color={statusColors[c.status]} />
                <Badge label={c.category} color="gray" />
                {c.anonymous && <Badge label="🔒 Anônima" color="purple" />}
              </div>
              {!isMorador && (
                <div className="flex gap-1">
                  {c.status === 'pending' && <Btn size="sm" variant="secondary" onClick={() => store.updateComplaint(c.id, { status: 'read' })}>👁️</Btn>}
                  {c.status !== 'resolved' && <Btn size="sm" variant="success" onClick={() => store.updateComplaint(c.id, { status: 'resolved' })}>✅</Btn>}
                  <Btn size="sm" variant="danger" onClick={() => { if (confirm('Excluir?')) store.deleteComplaint(c.id); }}>🗑️</Btn>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{c.description}</p>
            <p className="text-xs text-gray-400 mt-2">📍 {c.location} · {fmtDate(c.createdAt)}</p>
          </div>
        ))}
      </div>
      {showModal && (
        <Modal title="⚠️ Nova Denúncia" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <p className="text-sm text-purple-700 font-semibold">🔒 Esta denúncia será enviada anonimamente</p>
            </div>
            <Field label="Categoria">
              <Select value={cat} onChange={e => setCat(e.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Urgência">
              <Select value={urg} onChange={e => setUrg(e.target.value as typeof urg)}>
                <option value="low">🟢 Baixa</option>
                <option value="medium">🟡 Média</option>
                <option value="high">🟠 Alta</option>
                <option value="critical">🔴 Crítica</option>
              </Select>
            </Field>
            <Field label="Local"><Input value={loc} onChange={e => setLoc(e.target.value)} placeholder="Bloco A, AP 304, garagem..." /></Field>
            <Field label="Descrição"><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Descreva o problema detalhadamente..." /></Field>
            <div className="flex gap-3"><Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn><Btn variant="primary" onClick={save}>Enviar Denúncia</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// MarketSection agora usa o novo MarketplaceSection importado

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: PORTAL EXTERNO (Síndico) — abre site externo dentro do painel
// ═══════════════════════════════════════════════════════════════════════════
function PortalExternoSection({ theme }: { theme: Theme }) {
  const [url, setUrl] = useState(() => localStorage.getItem('inovatech-portal-url') || '');
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(!url);
  const [iframeKey, setIframeKey] = useState(0);

  const isDark = theme.id === 'dark' || theme.id === 'blue';
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#111827';
  const subColor = isDark ? '#94a3b8' : '#6b7280';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#f8fafc';
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0';

  const saveUrl = () => {
    let finalUrl = inputUrl.trim();
    if (!finalUrl) { setError('Digite um link válido'); return; }
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    localStorage.setItem('inovatech-portal-url', finalUrl);
    setIsConfiguring(false);
    setIsLoading(true);
    setIframeKey(k => k + 1);
    setError('');
    setTimeout(() => setIsLoading(false), 3000);
  };

  const clearUrl = () => {
    setUrl('');
    setInputUrl('');
    localStorage.removeItem('inovatech-portal-url');
    setIsConfiguring(true);
    setError('');
  };

  const suggestions = [
    { label: '📰 Google Notícias', url: 'https://news.google.com/topstories?hl=pt-BR' },
    { label: '🗺️ Google Maps', url: 'https://maps.google.com' },
    { label: '📋 Google Drive', url: 'https://drive.google.com' },
    { label: '📅 Google Agenda', url: 'https://calendar.google.com' },
    { label: '🌤️ Previsão do Tempo', url: 'https://weather.com/pt-BR' },
    { label: '📊 YouTube', url: 'https://youtube.com' },
  ];

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 100px)' }}>
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between p-4 rounded-2xl mb-3 border"
        style={{ background: cardBg, borderColor: cardBorder }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg"
            style={{ background: 'linear-gradient(135deg,#06b6d4,#10b981)' }}>🌐</div>
          <div>
            <h2 className="font-bold text-base" style={{ color: textColor }}>Portal Externo</h2>
            <p className="text-xs truncate max-w-xs" style={{ color: subColor }}>
              {url || 'Nenhum site configurado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {url && (
            <>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:scale-105"
                style={{ borderColor: '#06b6d4', color: '#06b6d4', background: 'rgba(99,102,241,0.08)' }}>
                🔗 Nova aba
              </a>
              <button onClick={() => setIsConfiguring(c => !c)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#10b981)' }}>
                ⚙️ {isConfiguring ? 'Fechar' : 'Alterar link'}
              </button>
              <button onClick={clearUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                🗑️ Remover
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Config Panel ─── */}
      {isConfiguring && (
        <div className="rounded-2xl border p-5 mb-3"
          style={{ background: cardBg, borderColor: cardBorder }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🌐</span>
            <div>
              <h3 className="font-bold" style={{ color: textColor }}>Configurar Portal Externo</h3>
              <p className="text-xs" style={{ color: subColor }}>O site será carregado dentro do painel INOVATECH CONNECT</p>
            </div>
          </div>

          {/* Input URL */}
          <div className="flex gap-3 mb-4">
            <input
              type="url"
              value={inputUrl}
              onChange={e => { setInputUrl(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && saveUrl()}
              placeholder="https://www.exemplo.com.br"
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: inputBg,
                border: `1.5px solid ${error ? '#ef4444' : inputBorder}`,
                color: textColor,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#06b6d4'; }}
              onBlur={e => { e.currentTarget.style.borderColor = error ? '#ef4444' : inputBorder; }}
            />
            <button onClick={saveUrl}
              className="px-5 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg btn-animated"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#10b981)' }}>
              ✅ Carregar
            </button>
          </div>

          {error && <p className="text-red-500 text-xs mb-3">⚠️ {error}</p>}

          {/* Sugestões rápidas */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: subColor }}>Sugestões rápidas:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button key={s.url} onClick={() => { setInputUrl(s.url); setError(''); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105 border"
                  style={{
                    borderColor: 'rgba(99,102,241,0.3)',
                    background: 'rgba(99,102,241,0.08)',
                    color: isDark ? '#67e8f9' : '#06b6d4',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aviso sobre X-Frame */}
          <div className="mt-4 p-3 rounded-xl text-xs flex items-start gap-2"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: isDark ? '#fbbf24' : '#92400e' }}>
            <span className="text-base flex-shrink-0">⚠️</span>
            <span>Alguns sites (Google, Facebook, etc.) bloqueiam incorporação por segurança. Nesses casos, use o botão "🔗 Nova aba" para abrir externamente.</span>
          </div>
        </div>
      )}

      {/* ─── iFrame ─── */}
      {url && !isConfiguring && (
        <div className="flex-1 rounded-2xl overflow-hidden border relative"
          style={{ borderColor: cardBorder, minHeight: '400px' }}>
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-2xl"
              style={{ background: theme.colors.mainBg }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#10b981)', animation: 'pulse 1.5s ease-in-out infinite' }}>
                <span className="text-3xl">🌐</span>
              </div>
              <p className="text-sm font-bold mb-2" style={{ color: textColor }}>Carregando portal...</p>
              <p className="text-xs truncate max-w-xs" style={{ color: subColor }}>{url}</p>
              <div className="w-48 h-1.5 rounded-full mt-4 overflow-hidden" style={{ background: 'rgba(99,102,241,0.2)' }}>
                <div className="h-full rounded-full" style={{
                  background: 'linear-gradient(135deg,#06b6d4,#10b981)',
                  animation: 'shimmer 1.5s ease-in-out infinite',
                  width: '60%',
                }} />
              </div>
            </div>
          )}
          <iframe
            key={`${iframeKey}-${url}`}
            src={url}
            className="w-full h-full border-0"
            title="Portal Externo"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            allow="fullscreen; camera; microphone"
            style={{ minHeight: '500px', display: 'block' }}
          />
        </div>
      )}

      {/* ─── Empty state ─── */}
      {!url && !isConfiguring && (
        <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border"
          style={{ background: cardBg, borderColor: cardBorder }}>
          <div className="text-7xl mb-4">🌐</div>
          <h3 className="text-xl font-bold mb-2" style={{ color: textColor }}>Nenhum portal configurado</h3>
          <p className="text-sm text-center max-w-sm mb-6" style={{ color: subColor }}>
            Configure um link para acessar qualquer site dentro do painel, sem precisar sair do INOVATECH CONNECT.
          </p>
          <button onClick={() => setIsConfiguring(true)}
            className="px-6 py-3 rounded-xl font-bold text-white text-sm hover:scale-105 transition-all btn-animated"
            style={{ background: 'linear-gradient(135deg,#06b6d4,#10b981)' }}>
            ⚙️ Configurar Agora
          </button>
        </div>
      )}
    </div>
  );
}

// Themes are now imported from ThemeContext.tsx

// Theme picker is inlined inside ThemedHeader

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP — RESPONSIVO COM SIDEBAR MOBILE
// ═══════════════════════════════════════════════════════════════════════════
export function App() {
  const store = useStore();
  const [showLanding, setShowLanding] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [section, setSection] = useState('dashboard');
  const { currentTheme, setTheme, themes } = useTheme();
  const theme = currentTheme;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toastQueue, setToastQueue] = useState<ReturnType<typeof store.getNotifications>>([]);
  const [shownToastIds, setShownToastIds] = useState<Set<string>>(new Set());
  const [pendingChatUserId, setPendingChatUserId] = useState<string | null>(null);
  const [chatUnread, setChatUnread] = useState(0);

  const notifications = currentUser ? store.getNotifications(currentUser.id) : [];
  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = useCallback(() => currentUser && store.markAllRead(currentUser.id), [currentUser]);
  const { addToast } = useToasts();

  // Theme is now dynamically chosen via the UI picker

  const refreshChatUnread = useCallback(async () => {
    if (!currentUser) {
      setChatUnread(0);
      return;
    }

    const token = localStorage.getItem('auth_token') || localStorage.getItem('authToken');
    if (!token) {
      setChatUnread(0);
      return;
    }

    try {
      const response = await fetch('/api/chat/conversations', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) return;

      const payload = await response.json() as { conversations?: Array<{ unreadCount?: number }> };
      const totalUnread = Array.isArray(payload.conversations)
        ? payload.conversations.reduce((sum, conversation) => sum + (Number(conversation.unreadCount) || 0), 0)
        : 0;

      setChatUnread(totalUnread);
    } catch {
      // falhas pontuais de rede nao devem bloquear a navegacao
    }
  }, [currentUser]);

  // Monitorar novas notificações e exibir toast COM SOM
  useEffect(() => {
    if (!currentUser) return;
    const newNotifs = notifications.filter(n => !n.read && !shownToastIds.has(n.id));
    if (newNotifs.length === 0) return;
    const ids = new Set([...shownToastIds, ...newNotifs.map(n => n.id)]);
    setShownToastIds(ids);
    newNotifs.forEach(n => addToast(n));
    setToastQueue(prev => [...prev, ...newNotifs].slice(-5));
  }, [notifications.length, currentUser?.id]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (!currentUser) {
      setChatUnread(0);
      return;
    }

    void refreshChatUnread();
    const interval = window.setInterval(() => {
      void refreshChatUnread();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [currentUser, refreshChatUnread]);

  useEffect(() => {
    if (section !== 'chat') return;
    void refreshChatUnread();
  }, [section, refreshChatUnread]);

  if (showLanding && !currentUser) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  if (!currentUser) {
    return <LoginScreen onLogin={user => { setCurrentUser(user); setSection('dashboard'); }} />;
  }

  const handleNav = (s: string) => {
    setSection(s);
    setMobileSidebarOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSection('dashboard');
    setMobileSidebarOpen(false);
  };

  const renderSection = () => {
    const props = { user: currentUser, store };
    switch (section) {
      case 'dashboard':
        if (currentUser.role === 'admin' || currentUser.role === 'admin-master') {
          return <ApiDashboard user={currentUser} />;
        }
        return (
          <AnalyticsDashboard 
            user={currentUser} 
            data={{
              condos: store.getCondos(),
              users: store.getUsers(),
              invoices: store.getInvoices(currentUser.condoId),
              deliveries: store.getDeliveries(currentUser.condoId),
              complaints: currentUser.condoId ? store.getComplaints(currentUser.condoId) : [],
              notifications: store.getNotifications(currentUser.id),
            }}
          />
        );
      case 'admin-master': return <CondoManagement store={store} />;
      case 'condos': return <CondoManagement store={store} />;
      case 'users': return <UsersSection store={store} />;
      case 'finance': return <FinanceSection {...props} />;
      case 'deliveries': return <DeliveriesSection {...props} />;
      case 'people': return <PeopleSection {...props} />;
      case 'residents': return <ResidentsSection {...props} />;
      case 'announcements': return <AnnouncementsSection {...props} />;
      case 'reservations': return <ReservationsSection {...props} />;
      case 'votes':
        if (currentUser.role === 'sindico' || currentUser.role === 'morador') {
          return <AssemblySection user={currentUser} />;
        }
        return (
          <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm font-semibold text-amber-900">
            Assembleia Virtual disponivel apenas para síndicos e moradores.
          </div>
        );
      case 'complaints': return <ComplaintsSection user={currentUser} store={store} />;
      case 'market': return <MarketplaceSection user={currentUser} onOpenChat={(sellerId) => {
        // Navegar para o chat e abrir conversa com o vendedor
        setSection('chat');
        setPendingChatUserId(sellerId);
      }} />;
      case 'chat':
        return (
          <WhatsAppChatSection
            user={currentUser}
            initialChatUserId={pendingChatUserId ?? undefined}
            onChatOpened={() => setPendingChatUserId(null)}
          />
        );
      case 'maintenance': return <MaintenanceSection user={currentUser} />;
      case 'documents': return <DocumentsSection user={currentUser} />;
      case 'access-control': return <AccessControlSection user={currentUser} />;
      case 'lost-found': return <LostFoundSection user={currentUser} />;
      case 'reports': return <ReportsSection user={currentUser} />;
      case 'license-admin': return <LicenseAdmin store={store} />;
      case 'license-sindico': return <LicenseSindicoPanel
        charges={store.getLicenseCharges(currentUser.condoId!).map(c => ({
          id: c.id, condoId: c.condoId, condoName: c.condoName,
          amount: c.amount, dueDate: c.dueDate, reference: c.reference,
          status: c.status as 'pending' | 'paid' | 'overdue' | 'cancelled',
          createdAt: c.createdAt, paidAt: c.paidAt,
          gatewayChargeId: undefined, gatewayStatus: undefined,
        }))}
        condoName={store.getCondos().find(c => c.id === currentUser.condoId)?.name ?? ''}
        condoId={currentUser.condoId!}
        onMarkViewed={(id) => store.markLicenseViewed(id, currentUser.id)}
        onMarkPaid={(id) => store.markLicensePaid(id)}
        onCondoBlockedChange={(blocked) => {
          const condo = store.getCondos().find(c => c.id === currentUser.condoId);
          if (!condo) return;
          if (blocked && !condo.blocked) {
            store.blockCondo(condo.id);
          }
          if (!blocked && condo.blocked) {
            store.unblockCondo(condo.id);
          }
        }}
      />;
      case 'gateway-config':
        if (currentUser.role === 'sindico') return <SindicoGatewayUI user={currentUser} />;
        if (currentUser.role === 'admin' || currentUser.role === 'admin-master') return <MasterGatewayUI user={currentUser} />;
        return <GatewayConfigSection />;
      case 'support':
      case 'support-admin':
        return <SupportCenterSection user={currentUser} />;
      default: return (
        <AnalyticsDashboard 
          user={currentUser} 
          data={{
            condos: store.getCondos(),
            users: store.getUsers(),
            invoices: store.getInvoices(currentUser.role !== 'admin' ? currentUser.condoId : undefined),
            deliveries: store.getDeliveries(currentUser.condoId),
            complaints: currentUser.condoId ? store.getComplaints(currentUser.condoId) : [],
            notifications: store.getNotifications(currentUser.id),
          }}
        />
      );
    }
  };

  const removeToast = (id: string) => setToastQueue(prev => prev.filter(t => t.id !== id));

  const menus: Record<UserRole, typeof MENU_ADMIN> = {
    admin: MENU_ADMIN, 'admin-master': MENU_ADMIN, sindico: MENU_SINDICO, porteiro: MENU_PORTEIRO, morador: MENU_MORADOR,
  };
  const menu = menus[currentUser.role];

  const sectionLabels: Record<string, string> = {
    dashboard: currentUser.role === 'admin' || currentUser.role === 'admin-master' ? 'Back-end e APIs' : 'Dashboard',
    'admin-master': 'Gerenciar Condomínios',
    condos: 'Condomínios', users: 'Usuários',
    people: 'Gestão de Pessoas', finance: 'Financeiro', deliveries: 'Encomendas', residents: 'Moradores',
    announcements: 'Comunicados', reservations: 'Reservas', votes: 'Assembleia Virtual',
    complaints: 'Denúncias', market: 'Marketplace', chat: 'Mensagens',
    maintenance: 'Manutenção', documents: 'Documentos',
    'access-control': 'Controle de Acesso', 'lost-found': 'Achados e Perdidos',
    reports: 'Relatórios',
    'license-admin': 'Licenças', 'license-sindico': 'Minha Licença',
    'gateway-config': 'Gateway', support: 'Suporte',
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin Master', 'admin-master': 'Admin Master', sindico: 'Síndico', porteiro: 'Porteiro', morador: 'Morador',
  };

  const licenseAlertCount = currentUser.condoId ? store.getLicenseCharges(currentUser.condoId).filter(l => !l.viewedBySindico).length : 0;

  return (
    <div className="min-h-screen w-full flex overflow-hidden font-sans selection:bg-indigo-500/30 text-[var(--text-main)]" style={{ background: 'var(--main-bg)' }}>
      {/* City Skyline Background — same as landing & login */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=2560"
          alt=""
          className="w-full h-full object-cover object-[center_58%]"
          style={{ filter: theme.id === 'light' ? 'brightness(1.08) saturate(0.45)' : 'brightness(0.45) saturate(0.75)' }}
        />
        {/* Colored overlay per theme */}
        <div className="absolute inset-0 transition-all duration-700" style={{
          background: theme.id === 'light'
            ? 'linear-gradient(180deg, rgba(248,250,252,0.56) 0%, rgba(248,250,252,0.46) 40%, rgba(248,250,252,0.62) 100%)'
            : theme.id === 'blue'
              ? 'linear-gradient(180deg, rgba(2,6,23,0.52) 0%, rgba(2,6,23,0.40) 40%, rgba(2,6,23,0.60) 100%)'
              : 'linear-gradient(180deg, rgba(5,5,5,0.50) 0%, rgba(5,5,5,0.36) 40%, rgba(5,5,5,0.56) 100%)'
        }} />
        {/* Ambient glow lights */}
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] blur-[120px] rounded-full mix-blend-screen transition-all duration-1000" style={{ background: 'var(--glow-1)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full mix-blend-screen transition-all duration-1000" style={{ background: 'var(--glow-2)' }} />
      </div>

      <ToastContainer toasts={toastQueue} onRemove={removeToast} />

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md lg:hidden animate-fadeIn" 
          onClick={() => setMobileSidebarOpen(false)} 
        />
      )}

      {/* Modern Floating Sidebar (Dark Glass) */}
      <aside 
        className={`fixed lg:relative z-50 flex flex-col h-[calc(100vh-2rem)] m-4 rounded-[2rem] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-[32px] border border-[var(--glass-border)]
          ${sidebarCollapsed ? 'w-20' : 'w-72'} 
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: theme.id === 'light' ? 'rgba(255,255,255,0.42)' : theme.id === 'blue' ? 'rgba(2,6,23,0.42)' : 'rgba(8,8,8,0.42)' }}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-4 px-6 h-24 shrink-0 relative z-10 border-b border-[var(--glass-border)]">
          <div className="w-12 h-12 flex items-center justify-center rounded-[1rem] bg-gradient-to-br from-indigo-500 to-cyan-500 text-2xl shadow-[0_0_20px_rgba(99,102,241,0.4)] shrink-0 hover:scale-105 transition-transform duration-300">
            🏙️
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col animate-slideLeft overflow-hidden">
              <span className="text-xl font-black tracking-tight leading-none drop-shadow-md text-[var(--text-main)]">INOVATECH</span>
              <span className="text-[10px] font-bold tracking-[0.3em] mt-1 drop-shadow-sm text-[var(--text-muted)]">CONNECT</span>
            </div>
          )}
        </div>

        {/* User Card */}
        <div className="px-4 py-6 mb-2 relative z-10">
          <div className={`flex items-center gap-3 p-3 rounded-[1.25rem] shadow-sm transition-all hover:shadow-lg border bg-[var(--glass-bg)] border-[var(--glass-border)] ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="relative shrink-0 group cursor-pointer">
              <div className="w-11 h-11 rounded-[1rem] overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-inner group-hover:scale-105 transition-transform ring-1 ring-white/10">
                {currentUser.photo ? <img src={currentUser.photo} alt="" className="w-full h-full object-cover" /> : currentUser.name[0].toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--main-bg)] rounded-full ring-2 ring-emerald-500/30" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1 animate-fadeIn cursor-pointer" onClick={() => handleNav('users')}>
                <p className="text-sm font-bold truncate drop-shadow-sm text-[var(--text-main)]">{currentUser.name.split(' ')[0]}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider truncate drop-shadow-sm text-[var(--text-muted)]">{roleLabels[currentUser.role]}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 space-y-2 custom-scrollbar pb-6 relative z-10 cursor-default">
          {menu.map((item: { id: string; icon: string; label: string }) => {
            const isActive = section === item.id;
            const badge = item.id === 'deliveries' ? unreadCount : item.id === 'license-sindico' ? licenseAlertCount : item.id === 'chat' ? chatUnread : 0;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-[1.25rem] transition-all duration-300 group relative outline-none border border-transparent
                  ${isActive 
                    ? 'shadow-lg bg-[var(--glow-1)] border-[var(--glass-border)] text-[var(--text-main)]' 
                    : 'text-[var(--text-muted)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-main)] hover:border-[var(--glass-border)]'}`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--glow-2)] rounded-r-full shadow-[0_0_15px_rgba(6,182,212,0.8)] opacity-[0.8]" />
                )}
                <span className={`text-[1.4rem] leading-none transition-transform duration-300 transform group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] ${sidebarCollapsed ? 'mx-auto' : ''}`}>{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className={`text-[13px] font-bold truncate relative z-10 tracking-wide ${isActive ? 'drop-shadow-sm' : ''}`}>{item.label}</span>
                )}
                {!sidebarCollapsed && badge > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[10px] font-black text-white bg-gradient-to-br from-rose-500 to-rose-600 rounded-full shadow-[0_0_12px_rgba(244,63,94,0.6)]">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {/* Tooltip for collapsed state */}
                {sidebarCollapsed && (
                  <div className="absolute left-[calc(100%+16px)] px-3.5 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-2xl z-[60] origin-left scale-95 group-hover:scale-100 border border-slate-700 backdrop-blur-md">
                    {item.label} {badge > 0 && <span className="ml-1 text-rose-400">({badge})</span>}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Toggle & Status */}
        <div className="p-4 mt-auto relative z-10 border-t border-[var(--glass-border)] bg-[var(--glass-bg)]">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mb-2 rounded-xl border bg-[var(--glass-bg)] border-[var(--glass-border)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest drop-shadow-sm text-[var(--text-muted)]">Sistema Online</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarCollapsed(p => !p)}
            className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all duration-300 border border-transparent hover:border-[var(--glass-border)] hover:shadow-lg cursor-pointer"
          >
            <span className="text-xl leading-none font-light">{sidebarCollapsed ? '›' : '‹'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
        
        {/* Floating Dark Header */}
        <header className="h-[5rem] shrink-0 flex items-center justify-between px-6 lg:px-10 mt-4 mx-4 rounded-[1.5rem] backdrop-blur-[32px] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.15)] z-30 transition-all" style={{ background: theme.id === 'light' ? 'rgba(255,255,255,0.24)' : theme.id === 'blue' ? 'rgba(2,6,23,0.22)' : 'rgba(8,8,8,0.20)' }}>
          <div className="flex items-center gap-5 min-w-0">
            <button 
              className="lg:hidden w-11 h-11 flex items-center justify-center rounded-[1rem] bg-[var(--glass-bg)] hover:bg-[var(--glow-1)] text-[var(--text-main)] transition-colors shadow-sm border border-[var(--glass-border)]"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <span className="text-xl">☰</span>
            </button>
            <div className="flex flex-col truncate">
              <h1 className="text-xl sm:text-[1.5rem] font-black tracking-tight truncate drop-shadow-sm text-[var(--text-main)]">{sectionLabels[section] || section}</h1>
              <span className="text-[10px] font-bold tracking-[0.1em] uppercase mt-0.5 hidden sm:flex items-center gap-2 drop-shadow-sm text-[var(--text-muted)]">
                Painel Administrativo
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--glow-2)' }} />
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', '')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {/* Theme Picker */}
            <div className="relative group/theme hidden sm:block z-50">
              <button className="flex w-11 h-11 items-center justify-center rounded-[1rem] hover:scale-105 transition-all shadow-sm bg-[var(--glass-bg)] border-[var(--glass-border)] hover:bg-[var(--glow-1)] cursor-pointer border text-[var(--text-main)]">
                <span className="text-xl drop-shadow-md">✨</span>
              </button>
              <div className="absolute right-0 top-[calc(100%+8px)] w-40 rounded-[1.25rem] p-2 opacity-0 invisible group-hover/theme:opacity-100 group-hover/theme:visible transition-all shadow-2xl backdrop-blur-3xl z-[100] bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                <p className="px-3 md:pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Mudar Tema</p>
                {themes.map(t => (
                  <button key={t.id} onClick={() => setTheme(t.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold cursor-pointer ${theme.id === t.id ? 'bg-[var(--glow-1)] scale-100' : 'hover:bg-[var(--glass-bg)] hover:scale-105'}`} style={{ color: 'var(--text-main)' }}>
                    <span className="text-lg leading-none">{t.icon}</span>
                    <span className="text-sm tracking-wide">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search (visual only) */}
            <button className="hidden sm:flex w-11 h-11 items-center justify-center rounded-[1rem] bg-[var(--glass-bg)] hover:bg-[var(--glow-1)] text-[var(--text-muted)] hover:text-cyan-400 transition-all hover:shadow-lg hover:scale-105 border border-[var(--glass-border)] cursor-pointer">
              <span className="text-xl drop-shadow-md">🔍</span>
            </button>
            
            {/* Notifications */}
            <button className="relative w-11 h-11 flex items-center justify-center rounded-[1rem] bg-[var(--glass-bg)] hover:bg-[var(--glow-1)] text-[var(--text-muted)] hover:text-indigo-400 transition-all hover:shadow-lg hover:scale-105 border border-[var(--glass-border)] hover:border-indigo-400/30 cursor-pointer">
              <span className="text-xl drop-shadow-md">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 flex items-center justify-center text-[10px] font-black text-white bg-gradient-to-br from-rose-500 to-rose-600 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.8)] border border-[var(--main-bg)] animate-bounce pointer-events-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block" />
            
            {/* Logout */}
            <button
              onClick={handleLogout}
              className="group flex items-center justify-center gap-2.5 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-[1rem] transition-all border border-rose-500/20 hover:border-rose-500/40 hover:shadow-[0_0_20px_rgba(244,63,94,0.2)] cursor-pointer"
            >
              <span className="text-lg group-hover:-translate-x-1 transition-transform drop-shadow-sm">🚪</span>
              <span className="text-sm font-bold hidden sm:block">Sair</span>
            </button>
          </div>
        </header>

        {/* Page Content — main itself is the glass surface so it never ends */}
        <main 
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar backdrop-blur-[26px] border-t border-[var(--glass-border)] transition-all duration-500 mt-4 mx-4 mb-4 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
          style={{ background: theme.id === 'light' ? 'rgba(255,255,255,0.24)' : theme.id === 'blue' ? 'rgba(2,6,23,0.20)' : 'rgba(10,10,10,0.18)', border: `1px solid var(--glass-border)` }}
        >
          <div className="max-w-[1600px] mx-auto p-5 sm:p-8 lg:p-10 animate-slideUp">
            <div className="relative z-10 w-full text-[var(--text-main)] transition-colors duration-500">
              {renderSection()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}











