import { useState } from 'react';
import type { UserRole } from '../types';

interface CondoData {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  address: string;
  city: string;
  units: number;
  residents: number;
  active: boolean;
  blocked: boolean;
  monthlyRevenue: number;
  pendingCharges: number;
  licenseValue: number;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  password?: string;
  cpf?: string;
  birthDate?: string;
  role: UserRole;
  active: boolean;
  unit?: string;
  condoId?: string;
  photo?: string;
  kinship?: string;
  canViewCharges?: boolean;
}

interface Store {
  getCondos: () => CondoData[];
  getUsers: () => UserItem[];
  addCondo: (data: any) => void;
  updateCondo: (id: string, data: any) => void;
  deleteCondo: (id: string) => void;
  addUser: (data: any) => void;
  updateUser: (id: string, data: any) => void;
  deleteUser: (id: string) => void;
}

interface CondoManagementProps {
  store: Store;
}

export function CondoManagement({ store }: CondoManagementProps) {
  const condos = store.getCondos();
  const users = store.getUsers();
  const [expandedCondoId, setExpandedCondoId] = useState<string | null>(null);
  const [showCondoModal, setShowCondoModal] = useState(false);
  const [editingCondo, setEditingCondo] = useState<CondoData | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
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

  const openEditUser = (user: UserItem) => {
    setSelectedCondoId(user.condoId ?? '');
    setEditingUser(user);
    if (user.condoId) setExpandedCondoId(user.condoId);
    setShowUserModal(true);
  };

  const saveUser = (data: Partial<UserItem>) => {
    const payload = { ...data, condoId: data.condoId ?? selectedCondoId };
    if (editingUser) {
      store.updateUser(editingUser.id, payload);
    } else {
      store.addUser(payload as any);
    }
    setShowUserModal(false);
    setEditingUser(null);
    setSelectedCondoId('');
  };

  const stats = {
    total: condos.length,
    active: condos.filter((c) => c.active).length,
    totalUsers: users.length,
    totalUnits: condos.reduce((sum, c) => sum + c.units, 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 pb-6">
      <header className="relative overflow-hidden bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 pb-10 pt-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-28 -top-28 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-28 -bottom-28 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              <span className="text-lg">🏢</span> Administração
            </div>
            <h1 className="mt-2.5 text-xl font-black text-white sm:text-2xl lg:text-3xl">Gerenciar Condomínios</h1>
            <p className="mx-auto mt-1.5 max-w-2xl text-xs text-white/80 sm:text-sm">
              Administre todos os condomínios e usuários em um só lugar
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon="🏢" label="Total" value={stats.total} gradient="from-blue-500 to-cyan-500" />
            <StatCard icon="✅" label="Ativos" value={stats.active} gradient="from-emerald-500 to-teal-500" />
            <StatCard icon="👥" label="Usuários" value={stats.totalUsers} gradient="from-purple-500 to-pink-500" />
            <StatCard icon="🏠" label="Unidades" value={stats.totalUnits} gradient="from-amber-500 to-orange-500" />
          </div>
        </div>
      </header>

      <div className="relative z-20 mx-auto -mt-4 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex justify-end">
          <button
            onClick={openNewCondo}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 px-3.5 py-1.5 text-[11px] font-bold text-white shadow transition-all hover:shadow-lg sm:w-auto"
          >
            <span className="text-sm">➕</span> Novo Condomínio
          </button>
        </div>

        {condos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white py-6">
            <span className="text-4xl">📭</span>
            <p className="mt-2 text-sm font-semibold text-gray-700">Nenhum condomínio cadastrado</p>
            <p className="text-xs text-gray-500">Clique em &quot;Novo Condomínio&quot; para começar</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {condos.map((condo) => {
              const condoUsers = users.filter((user) => user.condoId === condo.id);
              const moradores = condoUsers.filter((user) => user.role === 'morador').length;
              const sindicos = condoUsers.filter((user) => user.role === 'sindico').length;
              const isExpanded = expandedCondoId === condo.id;

              return (
                <article
                  key={condo.id}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedCondoId(isExpanded ? null : condo.id)}
                    className="w-full text-left"
                  >
                    <div className="relative overflow-hidden bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 p-3.5">
                      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="rounded-xl bg-white/95 px-2.5 py-1 shadow backdrop-blur-md">
                                <h3 className="text-sm font-black text-gray-900 sm:text-base">{condo.name}</h3>
                              </div>
                              {condo.active ? (
                                <span className="rounded-full border border-emerald-300 bg-emerald-500/25 px-2 py-0.5 text-[11px] font-bold text-emerald-50">
                                  ✅ Ativo
                                </span>
                              ) : (
                                <span className="rounded-full border border-slate-300 bg-slate-500/30 px-2 py-0.5 text-[11px] font-bold text-slate-100">
                                  ⏸️ Inativo
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs">
                              <span className="flex items-center gap-1 rounded-lg bg-white/85 px-2 py-0.5 font-semibold text-gray-700 backdrop-blur-sm">
                                📍 {condo.city || 'Sem cidade'}
                              </span>
                              {condo.email && (
                                <span className="flex items-center gap-1 rounded-lg bg-white/85 px-2 py-0.5 font-semibold text-gray-700 backdrop-blur-sm">
                                  📧 {condo.email}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                            <span className="text-xl text-white">▼</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="grid grid-cols-3 gap-px bg-gray-200">
                    <div className="bg-white px-2.5 py-1.5 text-center">
                      <p className="text-xs font-semibold text-gray-500">Moradores</p>
                      <p className="text-base font-black text-gray-800">{moradores}</p>
                    </div>
                    <div className="bg-white px-2.5 py-1.5 text-center">
                      <p className="text-xs font-semibold text-gray-500">Síndicos</p>
                      <p className="text-base font-black text-gray-800">{sindicos}</p>
                    </div>
                    <div className="bg-white px-2.5 py-1.5 text-center">
                      <p className="text-xs font-semibold text-gray-500">Unidades</p>
                      <p className="text-base font-black text-gray-800">{condo.units}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 p-3.5">
                      <div className="mb-3 grid gap-2 sm:flex sm:flex-wrap">
                        <button
                          onClick={() => openNewUserForCondo(condo.id)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow transition-all hover:bg-emerald-700 sm:w-auto"
                        >
                          <span>➕</span> Novo Usuário
                        </button>
                        <button
                          onClick={() => openEditCondo(condo)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white shadow transition-all hover:bg-blue-700 sm:w-auto"
                        >
                          <span>✏️</span> Editar Condomínio
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Excluir condomínio ${condo.name}?`)) {
                              store.deleteCondo(condo.id);
                            }
                          }}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white shadow transition-all hover:bg-rose-700 sm:w-auto"
                        >
                          <span>🗑️</span> Excluir
                        </button>
                      </div>

                      {condoUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white py-6">
                          <span className="text-2xl">👥</span>
                          <p className="mt-2 text-xs font-semibold text-gray-600">Nenhum usuário neste condomínio</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {condoUsers.map((user, idx) => (
                            <div
                              key={user.id}
                              className="flex flex-col gap-2.5 rounded-2xl border border-gray-200 bg-white p-2.5 transition-all hover:bg-gray-50 hover:shadow-sm lg:flex-row lg:items-center lg:justify-between"
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-gray-800 text-xs font-black text-white">
                                  {user.photo ? (
                                    <img src={user.photo} alt={user.name} className="h-full w-full rounded-full object-cover" />
                                  ) : (
                                    user.name[0].toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
                                  <p className="truncate text-xs text-gray-600">{user.email}</p>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    <RoleBadge role={user.role} />
                                    {user.active && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                        ✅ Ativo
                                      </span>
                                    )}
                                    {user.unit && (
                                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                                        Unidade: {user.unit}
                                      </span>
                                    )}
                                    {user.role === 'morador' && user.kinship && (
                                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                                        Vinculo: {user.kinship}
                                      </span>
                                    )}
                                    {user.role === 'morador' && (
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                          user.canViewCharges !== false
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-rose-100 text-rose-700'
                                        }`}
                                      >
                                        Cobrancas: {user.canViewCharges !== false ? 'Sim' : 'Nao'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 sm:justify-end">
                                <button
                                  onClick={() => openEditUser(user)}
                                  className="flex-1 rounded-xl bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700 transition-all hover:bg-blue-200 sm:flex-none"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Excluir usuário ${user.name}?`)) {
                                      store.deleteUser(user.id);
                                    }
                                  }}
                                  className="flex-1 rounded-xl bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 transition-all hover:bg-rose-200 sm:flex-none"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {showCondoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="relative overflow-hidden bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 px-4 py-3.5">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/80">{editingCondo ? 'Editar' : 'Novo'}</p>
                  <h3 className="mt-0.5 text-lg font-black text-white">Condomínio</h3>
                </div>
                <button
                  onClick={() => setShowCondoModal(false)}
                  className="rounded-lg border border-white/30 bg-white/20 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/30"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-[78dvh] overflow-y-auto px-4 py-3 sm:max-h-[62vh]">
              <div className="space-y-3">
                <FormField label="Nome do Condomínio" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    placeholder="Ex.: Condomínio Residencial Flores"
                  />
                </FormField>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="CNPJ">
                    <input
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      placeholder="00.000.000/0000-00"
                    />
                  </FormField>
                  <FormField label="E-mail">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      placeholder="contato@condominio.com.br"
                    />
                  </FormField>
                </div>

                <FormField label="Endereço">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    placeholder="Rua das Flores, 123"
                  />
                </FormField>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Cidade">
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      placeholder="São Paulo"
                    />
                  </FormField>
                  <FormField label="Número de Unidades">
                    <input
                      type="number"
                      value={units}
                      onChange={(e) => setUnits(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      placeholder="100"
                    />
                  </FormField>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowCondoModal(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 transition-all hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={saveCondo}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-gray-700 to-gray-900 px-3 py-1.5 text-[11px] font-bold text-white shadow transition-all hover:shadow-lg"
              >
                <span>✅</span> Salvar Condomínio
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <UserModal
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null);
            setSelectedCondoId('');
          }}
          onSave={saveUser}
          initial={editingUser}
          condos={store.getCondos()}
          selectedCondoId={selectedCondoId}
          isEdit={!!editingUser}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, gradient }: { icon: string; label: string; value: number | string; gradient: string }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-3.5 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <div className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10 blur-lg transition-all group-hover:scale-125" />
      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">{label}</p>
            <p className="text-xl font-black text-white">{value}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-gray-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-700',
    'admin-master': 'bg-purple-100 text-purple-700',
    sindico: 'bg-blue-100 text-blue-700',
    porteiro: 'bg-amber-100 text-amber-700',
    morador: 'bg-emerald-100 text-emerald-700',
  };

  const icons: Record<UserRole, string> = {
    admin: '👨‍💼',
    'admin-master': '👨‍💼',
    sindico: '🏢',
    porteiro: '🚪',
    morador: '🏠',
  };

  const labels: Record<UserRole, string> = {
    admin: 'Admin',
    'admin-master': 'Admin Master',
    sindico: 'Síndico',
    porteiro: 'Porteiro',
    morador: 'Morador',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${styles[role]}`}>
      {icons[role]} {labels[role]}
    </span>
  );
}

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

const KINSHIP_OPTIONS = [
  { value: 'Titular', label: 'Titular' },
  { value: 'Conjuge', label: 'Conjuge' },
  { value: 'Filho(a)', label: 'Filho(a)' },
  { value: 'Outro', label: 'Outro' },
];

interface UserModalProps {
  onClose: () => void;
  onSave: (data: Partial<UserItem>) => void;
  initial: UserItem | null;
  condos: CondoData[];
  selectedCondoId: string;
  isEdit: boolean;
}

function UserModal({ onClose, onSave, initial, condos, selectedCondoId, isEdit }: UserModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState(initial?.cpf ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'morador');
  const [condoId, setCondoId] = useState(initial?.condoId ?? selectedCondoId);
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [kinship, setKinship] = useState(initial?.kinship ?? 'Titular');
  const [canViewCharges, setCanViewCharges] = useState(initial?.canViewCharges !== false);
  const [active, setActive] = useState(initial?.active ?? true);

  const handleSubmit = () => {
    const digitsCpf = cpf.replace(/\D/g, '');
    const trimmedPassword = password.trim();

    if (!name.trim() || !email.trim() || digitsCpf.length !== 11 || !birthDate) {
      alert('Preencha nome, e-mail, CPF valido e data de nascimento.');
      return;
    }

    if (!isEdit && trimmedPassword.length < 6) {
      alert('Informe uma senha com no minimo 6 caracteres.');
      return;
    }

    if (trimmedPassword && trimmedPassword.length < 6) {
      alert('A senha deve ter no minimo 6 caracteres.');
      return;
    }

    const payload: Partial<UserItem> = {
      id: initial?.id,
      name: name.trim(),
      email: email.trim(),
      cpf: formatCPF(cpf),
      birthDate,
      role,
      condoId,
      unit,
      active,
      kinship: role === 'morador' ? kinship : undefined,
      canViewCharges: role === 'morador' ? canViewCharges : undefined,
    };

    if (trimmedPassword) {
      payload.password = trimmedPassword;
    }

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 px-4 py-3.5">
          <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/80">{isEdit ? 'Editar' : 'Novo'}</p>
              <h3 className="mt-0.5 text-lg font-black text-white">Usuario</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/30 bg-white/20 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/30"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="max-h-[80dvh] overflow-y-auto px-4 py-3 sm:max-h-[72vh]">
          <div className="space-y-3">
            <FormField label="Nome Completo" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                placeholder="Joao da Silva"
              />
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="CPF" required>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </FormField>

              <FormField label="Data de Nascimento" required>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="E-mail" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  placeholder="joao@email.com"
                />
              </FormField>

              <FormField label="Senha de Acesso" required={!isEdit}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  placeholder={isEdit ? 'Opcional para alterar' : 'Minimo 6 caracteres'}
                />
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Perfil" required>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                >
                  <option value="morador" className="text-gray-900">Morador</option>
                  <option value="sindico" className="text-gray-900">Sindico</option>
                  <option value="porteiro" className="text-gray-900">Porteiro</option>
                  <option value="admin" className="text-gray-900">Admin</option>
                  <option value="admin-master" className="text-gray-900">Admin Master</option>
                </select>
              </FormField>

              <FormField label="Condominio">
                <select
                  value={condoId}
                  onChange={(e) => setCondoId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                >
                  <option value="" className="text-gray-900">Selecione...</option>
                  {condos.map((c) => (
                    <option key={c.id} value={c.id} className="text-gray-900">
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Unidade/Apartamento">
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                placeholder="Ex.: 101-A, Bloco B"
              />
            </FormField>

            {role === 'morador' && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <FormField label="Quem e o usuario" required>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {KINSHIP_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setKinship(option.value)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-all ${
                          kinship === option.value
                            ? 'border-sky-500 bg-sky-100 text-sky-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </FormField>

                <FormField label="Acesso as cobrancas">
                  <div className="flex w-full rounded-lg border border-gray-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setCanViewCharges(true)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-bold transition-all ${
                        canViewCharges ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Permitir
                    </button>
                    <button
                      type="button"
                      onClick={() => setCanViewCharges(false)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-bold transition-all ${
                        !canViewCharges ? 'bg-rose-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Bloquear
                    </button>
                  </div>
                </FormField>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-700 focus:ring-gray-400"
              />
              <label htmlFor="active" className="text-xs font-semibold text-gray-700">
                Usuario ativo
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 transition-all hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-gray-700 to-gray-900 px-3 py-1.5 text-[11px] font-bold text-white shadow transition-all hover:shadow-lg"
          >
            Salvar Usuario
          </button>
        </div>
      </div>
    </div>
  );
}

