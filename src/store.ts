import { useState, useCallback } from 'react';
import type {
  User, Condo, Invoice, Delivery, Notification,
  Announcement, Reservation, Vote, Complaint, MarketItem, CommonArea, LicenseCharge, Employee, PixConfig
} from './types';
import {
  initDB, dbGetAll, dbPutAll, dbClear,
  dbGetSetting, dbPutSetting, idbPut, idbDelete, idbPutSetting, DATA_STORES,
} from './db';

// ─── CPF FORMATTER ───────────────────────────────────────────────────────────
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return check === parseInt(digits[10]);
}

// ─── QR TOKEN ────────────────────────────────────────────────────────────────
export function generateQRToken(deliveryId: string): string {
  const payload = {
    sys: 'INOVATECH',
    id: deliveryId,
    ts: Date.now(),
    sig: btoa(`${deliveryId}-INOVATECH-SECURE-2024`).slice(0, 16)
  };
  return btoa(JSON.stringify(payload));
}

export function validateQRToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.sys !== 'INOVATECH') return null;
    const expectedSig = btoa(`${payload.id}-INOVATECH-SECURE-2024`).slice(0, 16);
    if (payload.sig !== expectedSig) return null;
    return payload.id;
  } catch {
    return null;
  }
}

// ─── ID GENERATOR ────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];

// ─── TYPES FOR INLINE ENTITIES ───────────────────────────────────────────────
type Document     = { id: string; condoId: string; name: string; category: string; uploadedBy: string; uploadedAt: string; size: string; type: string; url: string; tags: string[] };
type MaintRequest = { id: string; condoId: string; unit: string; userId: string; userName: string; title: string; description: string; category: string; priority: string; status: string; createdAt: string; photos: string[] };
type AccessLog    = { id: string; condoId: string; name: string; type: string; unit: string; time: string; direction: string; plate?: string; company?: string; description?: string };
type LostFoundItem = { id: string; condoId: string; userId: string; userName: string; type: string; title: string; description: string; location: string; date: string; contact: string; status: string; createdAt: string };
type SupportMessage = { id: string; userId: string; userName: string; userRole: string; condoName: string; message: string; sender: 'user' | 'admin'; createdAt: string; read: boolean };
type GatewayConfig = { gateway: string; apiKey: string; publicKey: string; webhookSecret: string; environment: string; monthlyValue: number; dueDay: number; graceDays: number; finePercent: number; interestPercent: number; autoCharge: boolean; notifyDaysBefore: number; pixKey: string; pixKeyType: string; acceptedMethods: string[] } | null;

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const d1id = 'del1';
const d2id = 'del2';
const d3id = 'del3';

const INITIAL_DATA = {
  users: [
    { id: 'u1', name: 'inovatech', email: 'admin@inovatech.com', password: 'Stilo@273388', role: 'admin', cpf: '000.000.000-00', birthDate: '1980-01-01', condoId: undefined, unit: undefined, phone: '(11) 99999-0001', createdAt: now, active: true },
    { id: 'u2', name: 'Carlos Mendes', email: 'sindico@inovatech.com', password: '123456', role: 'sindico', cpf: '123.456.789-09', birthDate: '1975-05-15', condoId: 'c1', unit: 'AP 01', phone: '(11) 99999-0002', createdAt: now, active: true },
    { id: 'u3', name: 'João Porteiro', email: 'porteiro@inovatech.com', password: '123456', role: 'porteiro', cpf: '987.654.321-00', birthDate: '1990-08-20', condoId: 'c1', unit: undefined, phone: '(11) 99999-0003', createdAt: now, active: true },
    { id: 'u4', name: 'Maria Silva', email: 'morador@inovatech.com', password: '123456', role: 'morador', cpf: '111.222.333-44', birthDate: '1995-03-10', condoId: 'c1', unit: '101-A', phone: '(11) 99999-0004', createdAt: now, active: true, canViewCharges: true },
    { id: 'u5', name: 'Pedro Costa', email: 'pedro@inovatech.com', password: '123456', role: 'morador', cpf: '555.666.777-88', birthDate: '1988-11-22', condoId: 'c1', unit: '202-B', phone: '(11) 99999-0005', createdAt: now, active: true, canViewCharges: true },
    { id: 'u6', name: 'Ana Lima', email: 'ana@inovatech.com', password: '123456', role: 'sindico', cpf: '222.333.444-55', birthDate: '1970-07-07', condoId: 'c2', unit: 'AP 01', phone: '(11) 99999-0006', createdAt: now, active: true },
    { id: 'u7', name: 'Roberto Dias', email: 'roberto@inovatech.com', password: '123456', role: 'sindico', cpf: '333.444.555-66', birthDate: '1968-12-30', condoId: 'c3', unit: 'AP 01', phone: '(11) 99999-0007', createdAt: now, active: true },
  ] as User[],
  condos: [
    { id: 'c1', name: 'Residencial Aurora', cnpj: '11.222.333/0001-00', email: 'contato@aurora.com', phone: '(11) 4004-0001', address: 'Av. das Flores, 1200', city: 'São Paulo - SP', units: 120, residents: 98, sindico: 'Carlos Mendes', sindicoId: 'u2', active: true, blocked: false, monthlyRevenue: 48000, pendingCharges: 3200, licenseValue: 299, createdAt: now },
    { id: 'c2', name: 'Edifício Horizonte', cnpj: '22.333.444/0001-99', email: 'financeiro@horizonte.com', phone: '(19) 3322-1100', address: 'Rua das Palmeiras, 450', city: 'Campinas - SP', units: 64, residents: 55, sindico: 'Ana Lima', sindicoId: 'u6', active: true, blocked: false, monthlyRevenue: 28000, pendingCharges: 1800, licenseValue: 199, createdAt: now },
    { id: 'c3', name: 'Condomínio Vista Verde', cnpj: '33.444.555/0001-88', email: 'adm@vistaverde.com', phone: '(13) 3232-4455', address: 'Rua dos Ipês, 88', city: 'Santos - SP', units: 200, residents: 175, sindico: 'Roberto Dias', sindicoId: 'u7', active: true, blocked: false, monthlyRevenue: 76000, pendingCharges: 5100, licenseValue: 399, createdAt: now },
  ] as Condo[],
  invoices: [
    { id: 'inv1', condoId: 'c1', userId: 'u4', userName: 'Maria Silva', unit: '101-A', description: 'Taxa Condominial - Outubro/2024', amount: 450, dueDate: '2024-10-10', status: 'paid', paidAt: '2024-10-08', createdAt: now },
    { id: 'inv2', condoId: 'c1', userId: 'u4', userName: 'Maria Silva', unit: '101-A', description: 'Taxa Condominial - Novembro/2024', amount: 450, dueDate: '2024-11-10', status: 'pending', createdAt: now },
    { id: 'inv3', condoId: 'c1', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', description: 'Taxa Condominial - Outubro/2024', amount: 480, dueDate: '2024-10-10', status: 'overdue', createdAt: now },
    { id: 'inv4', condoId: 'c1', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', description: 'Taxa Condominial - Novembro/2024', amount: 480, dueDate: '2024-11-10', status: 'pending', createdAt: now },
  ] as Invoice[],
  deliveries: [
    { id: d1id, condoId: 'c1', unit: '101-A', residentName: 'Maria Silva', sender: 'Amazon', trackingCode: 'AMZ123456BR', description: 'Caixa média - Eletrônicos', arrivedAt: now, status: 'waiting', qrToken: generateQRToken(d1id), notified: true },
    { id: d2id, condoId: 'c1', unit: '202-B', residentName: 'Pedro Costa', sender: 'Mercado Livre', trackingCode: 'ML789012BR', description: 'Envelope - Documentos', arrivedAt: new Date(Date.now() - 86400000).toISOString(), status: 'waiting', qrToken: generateQRToken(d2id), notified: true },
    { id: d3id, condoId: 'c1', unit: '101-A', residentName: 'Maria Silva', sender: 'Shopee', trackingCode: 'SH345678BR', description: 'Pacote pequeno - Vestuário', arrivedAt: new Date(Date.now() - 172800000).toISOString(), deliveredAt: new Date(Date.now() - 86400000).toISOString(), status: 'delivered', qrToken: generateQRToken(d3id), notified: true },
  ] as Delivery[],
  announcements: [
    { id: 'ann1', condoId: 'c1', title: 'Manutenção da Piscina', content: 'Informamos que a piscina ficará fechada para manutenção nos dias 15 e 16 de novembro. Pedimos desculpas pelo transtorno.', authorId: 'u2', authorName: 'Carlos Mendes', priority: 'normal', createdAt: now },
    { id: 'ann2', condoId: 'c1', title: '⚠️ Assembleia Geral Ordinária', content: 'Convocamos todos os condôminos para a Assembleia Geral Ordinária que será realizada no dia 20/11 às 19h no salão de festas.', authorId: 'u2', authorName: 'Carlos Mendes', priority: 'urgent', createdAt: new Date(Date.now() - 3600000).toISOString() },
  ] as Announcement[],
  commonAreas: [
    { id: 'area1', condoId: 'c1', name: 'Salão de Festas', capacity: 80, maxHours: 8, pricePerHour: 50, description: 'Espaço climatizado com cozinha equipada', rules: ['Máximo 80 pessoas', 'Até 8 horas', 'Limpeza obrigatória após uso'], image: '🎉', cancellationFinePercent: 50, cancellationFineWindowHours: 72 },
    { id: 'area2', condoId: 'c1', name: 'Churrasqueira', capacity: 30, maxHours: 6, pricePerHour: 30, description: 'Área gourmet com 4 churrasqueiras', rules: ['Máximo 30 pessoas', 'Até 6 horas', 'Não é permitido som alto após 22h'], image: '🔥', cancellationFinePercent: 50, cancellationFineWindowHours: 72 },
    { id: 'area3', condoId: 'c1', name: 'Quadra Esportiva', capacity: 20, maxHours: 2, pricePerHour: 0, description: 'Quadra poliesportiva iluminada', rules: ['Máximo 20 pessoas', 'Até 2 horas por reserva', 'Uso de calçado adequado obrigatório'], image: '🏀', cancellationFinePercent: 0, cancellationFineWindowHours: 48 },
    { id: 'area4', condoId: 'c1', name: 'Espaço Gourmet', capacity: 40, maxHours: 5, pricePerHour: 40, description: 'Ambiente sofisticado com vista panorâmica', rules: ['Máximo 40 pessoas', 'Até 5 horas', 'Mobiliário incluso'], image: '🍽️', cancellationFinePercent: 50, cancellationFineWindowHours: 72 },
  ] as CommonArea[],
  reservations: [
    { id: 'res1', condoId: 'c1', areaId: 'area1', areaName: 'Salão de Festas', userId: 'u4', userName: 'Maria Silva', unit: '101-A', date: today, startTime: '14:00', endTime: '20:00', totalCost: 300, status: 'confirmed', createdAt: now },
    { id: 'res2', condoId: 'c1', areaId: 'area2', areaName: 'Churrasqueira', userId: 'u5', userName: 'Pedro Costa', unit: '202-B', date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], startTime: '12:00', endTime: '18:00', totalCost: 180, status: 'confirmed', createdAt: now },
  ] as Reservation[],
  votes: [
    { id: 'v1', condoId: 'c1', title: 'Instalação de Câmeras no Estacionamento', description: 'Votação para aprovação da instalação de câmeras de segurança no estacionamento. Custo estimado: R$ 8.000,00 dividido entre os condôminos.', options: [{ id: 'v1o1', text: '✅ Aprovar instalação', votes: ['u4', 'u5'] }, { id: 'v1o2', text: '❌ Reprovar instalação', votes: [] }, { id: 'v1o3', text: '🤔 Quero mais informações', votes: [] }], createdBy: 'u2', endDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], status: 'open', createdAt: now },
    { id: 'v2', condoId: 'c1', title: 'Horário da Academia', description: 'Definição do horário de funcionamento da academia do condomínio.', options: [{ id: 'v2o1', text: '6h às 22h', votes: ['u4'] }, { id: 'v2o2', text: '5h às 23h', votes: ['u5'] }, { id: 'v2o3', text: '24 horas', votes: [] }], createdBy: 'u2', endDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0], status: 'open', createdAt: now },
  ] as Vote[],
  complaints: [
    { id: 'comp1', condoId: 'c1', category: 'Barulho', description: 'Barulho excessivo no apartamento 304 após as 22h todos os finais de semana.', location: 'Bloco A - AP 304', urgency: 'high', status: 'pending', anonymous: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'comp2', condoId: 'c1', category: 'Vazamento', description: 'Vazamento de água no teto do corredor do 2º andar.', location: 'Bloco B - 2º Andar', urgency: 'critical', status: 'read', anonymous: false, reporterId: 'u4', createdAt: new Date(Date.now() - 172800000).toISOString() },
  ] as Complaint[],
  marketItems: [
    { id: 'mkt1', condoId: 'c1', sellerId: 'u5', sellerName: 'Pedro Costa', unit: '202-B', title: 'Sofá 3 Lugares', description: 'Sofá em ótimo estado, cor cinza, 2 anos de uso.', price: 800, category: 'Móveis', status: 'available', createdAt: now },
    { id: 'mkt2', condoId: 'c1', sellerId: 'u4', sellerName: 'Maria Silva', unit: '101-A', title: 'Bicicleta Ergométrica', description: 'Bicicleta ergométrica com 8 níveis de resistência.', price: 350, category: 'Esportes', status: 'available', createdAt: now },
    { id: 'mkt3', condoId: 'c1', sellerId: 'u5', sellerName: 'Pedro Costa', unit: '202-B', title: 'Micro-ondas 30L', description: 'Micro-ondas LG 30 litros, funcionando perfeitamente.', price: 200, category: 'Eletrodomésticos', status: 'sold', createdAt: now },
  ] as MarketItem[],
  notifications: [
    { id: 'n1', userId: 'u4', title: '📦 Encomenda chegou!', message: 'Você tem uma nova encomenda da Amazon aguardando na portaria. Use seu QR Code para retirar.', type: 'delivery', read: false, createdAt: now },
    { id: 'n2', userId: 'u4', title: '💰 Cobrança pendente', message: 'Taxa Condominial de Novembro/2024 com vencimento em 10/11. Valor: R$ 450,00', type: 'charge', read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'n3', userId: 'u4', title: '📢 Novo comunicado', message: 'Carlos Mendes publicou: Assembleia Geral Ordinária - 20/11 às 19h', type: 'announcement', read: true, createdAt: new Date(Date.now() - 7200000).toISOString() },
  ] as Notification[],
  licenseCharges: [
    { id: 'lic1', condoId: 'c1', condoName: 'Residencial Aurora', description: 'Licença INOVATECH CONNECT - Novembro/2024', amount: 299, dueDate: '2024-11-10', status: 'pending', viewedBySindico: false, createdAt: now, reference: 'Novembro/2024' },
    { id: 'lic2', condoId: 'c2', condoName: 'Edifício Horizonte', description: 'Licença INOVATECH CONNECT - Novembro/2024', amount: 199, dueDate: '2024-11-10', status: 'pending', viewedBySindico: false, createdAt: now, reference: 'Novembro/2024' },
    { id: 'lic3', condoId: 'c1', condoName: 'Residencial Aurora', description: 'Licença INOVATECH CONNECT - Outubro/2024', amount: 299, dueDate: '2024-10-10', status: 'paid', paidAt: '2024-10-08', viewedBySindico: true, viewedAt: '2024-10-01', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), reference: 'Outubro/2024' },
  ] as LicenseCharge[],
  employees: [
    { id: 'emp1', condoId: 'c1', name: 'José Carlos Oliveira', cpf: '444.555.666-77', birthDate: '1985-03-15', phone: '(11) 98888-1111', email: 'jose.zelador@email.com', role: 'Zelador', department: 'Manutenção', admissionDate: '2020-01-10', salary: 2200, address: 'Rua das Acácias, 45 - São Paulo', notes: 'Responsável pela manutenção geral', document: '12.345.678-9', createdAt: now },
    { id: 'emp2', condoId: 'c1', name: 'Maria Aparecida Santos', cpf: '777.888.999-00', birthDate: '1990-07-22', phone: '(11) 97777-2222', role: 'Faxineira', department: 'Limpeza', admissionDate: '2021-05-03', salary: 1800, address: 'Av. Paulista, 100 - São Paulo', document: '98.765.432-1', createdAt: now },
    { id: 'emp3', condoId: 'c1', name: 'Antonio Lima Verde', cpf: '123.987.456-33', birthDate: '1978-11-08', phone: '(11) 96666-3333', role: 'Jardineiro', department: 'Paisagismo', admissionDate: '2019-08-15', salary: 1600, createdAt: now },
  ] as Employee[],
  pixConfigs: [] as PixConfig[],
  documents: [] as Document[],
  maintenanceRequests: [] as MaintRequest[],
  accessLogs: [] as AccessLog[],
  lostFound: [] as LostFoundItem[],
  supportMessages: [] as SupportMessage[],
  gatewayConfig: null as GatewayConfig,
};

// ─── GLOBAL IN-MEMORY CACHE ──────────────────────────────────────────────────
let _data = { ...INITIAL_DATA };

// ─── SEED DATABASE WITH INITIAL DATA ─────────────────────────────────────────
async function seedDatabase(data: typeof INITIAL_DATA): Promise<void> {
  await Promise.all([
    dbPutAll('users', data.users),
    dbPutAll('condos', data.condos),
    dbPutAll('invoices', data.invoices),
    dbPutAll('deliveries', data.deliveries),
    dbPutAll('announcements', data.announcements),
    dbPutAll('commonAreas', data.commonAreas as unknown as { id: string }[]),
    dbPutAll('reservations', data.reservations),
    dbPutAll('votes', data.votes),
    dbPutAll('complaints', data.complaints),
    dbPutAll('marketItems', data.marketItems),
    dbPutAll('notifications', data.notifications),
    dbPutAll('licenseCharges', data.licenseCharges),
    dbPutAll('employees', data.employees),
    dbPutAll('pixConfigs', data.pixConfigs),
    dbPutAll('documents', data.documents),
    dbPutAll('maintenanceRequests', data.maintenanceRequests),
    dbPutAll('accessLogs', data.accessLogs),
    dbPutAll('lostFound', data.lostFound),
    dbPutAll('supportMessages', data.supportMessages),
  ]);
}

async function hasPersistedBackendData(): Promise<boolean> {
  const allStores = await Promise.all(DATA_STORES.map((store) => dbGetAll<any>(store)));
  if (allStores.some((entries) => entries.length > 0)) {
    return true;
  }

  const gatewayConfig = await dbGetSetting<GatewayConfig>('gatewayConfig');
  return gatewayConfig !== null;
}

// ─── INIT STORE (chamado uma vez antes de renderizar) ─────────────────────────
export async function initStore(): Promise<void> {
  await initDB();

  const initialized = await dbGetSetting<boolean>('db_initialized');
  const hasPersistedData = await hasPersistedBackendData();

  if (!initialized && !hasPersistedData) {
    const LS_KEY = 'inovatech_data_v2';
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        _data = { ...INITIAL_DATA, ...parsed };
        await seedDatabase(_data);
        if (_data.gatewayConfig) {
          await dbPutSetting('gatewayConfig', _data.gatewayConfig);
        }
        localStorage.removeItem(LS_KEY);
      } catch {
        _data = { ...INITIAL_DATA };
        await seedDatabase(_data);
      }
    } else {
      _data = { ...INITIAL_DATA };
      await seedDatabase(_data);
    }
    await dbPutSetting('db_initialized', true);
    return;
  }

  if (!initialized && hasPersistedData) {
    await dbPutSetting('db_initialized', true);
  }

  const [
    users, condos, invoices, deliveries, announcements, commonAreas,
    reservations, votes, complaints, marketItems, notifications,
    licenseCharges, employees, pixConfigs, documents,
    maintenanceRequests, accessLogs, lostFound, supportMessages,
    gatewayConfig,
  ] = await Promise.all([
    dbGetAll<User>('users'),
    dbGetAll<Condo>('condos'),
    dbGetAll<Invoice>('invoices'),
    dbGetAll<Delivery>('deliveries'),
    dbGetAll<Announcement>('announcements'),
    dbGetAll<CommonArea>('commonAreas'),
    dbGetAll<Reservation>('reservations'),
    dbGetAll<Vote>('votes'),
    dbGetAll<Complaint>('complaints'),
    dbGetAll<MarketItem>('marketItems'),
    dbGetAll<Notification>('notifications'),
    dbGetAll<LicenseCharge>('licenseCharges'),
    dbGetAll<Employee>('employees'),
    dbGetAll<PixConfig>('pixConfigs'),
    dbGetAll<Document>('documents'),
    dbGetAll<MaintRequest>('maintenanceRequests'),
    dbGetAll<AccessLog>('accessLogs'),
    dbGetAll<LostFoundItem>('lostFound'),
    dbGetAll<SupportMessage>('supportMessages'),
    dbGetSetting<GatewayConfig>('gatewayConfig'),
  ]);

  _data = {
    users,
    condos,
    invoices,
    deliveries,
    announcements,
    commonAreas,
    reservations,
    votes,
    complaints,
    marketItems,
    notifications,
    licenseCharges,
    employees,
    pixConfigs,
    documents,
    maintenanceRequests,
    accessLogs,
    lostFound,
    supportMessages,
    gatewayConfig: gatewayConfig ?? null,
  };
}

// ─── EXPORTED STORE HOOK ──────────────────────────────────────────────────────
export function useStore() {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  // ── USERS ──────────────────────────────────────────────────────────────────
  const getUsers = () => _data.users;
  const getUsersByCondoId = (condoId: string) => _data.users.filter(u => u.condoId === condoId);

  const addUser = (u: Omit<User, 'id' | 'createdAt'>) => {
    const newUser: User = { ...u, id: 'u' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, users: [..._data.users, newUser] };
    idbPut('users', newUser);
    refresh();
    return newUser;
  };

  const updateUser = (id: string, data: Partial<User>) => {
    const updated = { ..._data.users.find(u => u.id === id)!, ...data };
    _data = { ..._data, users: _data.users.map(u => u.id === id ? updated : u) };
    idbPut('users', updated);
    refresh();
  };

  const deleteUser = (id: string) => {
    _data = { ..._data, users: _data.users.filter(u => u.id !== id) };
    idbDelete('users', id);
    refresh();
  };

  // ── CONDOS ─────────────────────────────────────────────────────────────────
  const getCondos = () => _data.condos;

  const addCondo = (c: Omit<Condo, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => {
    const newCondo: Condo = {
      ...c,
      id: c.id || 'c' + uid(),
      createdAt: c.createdAt || new Date().toISOString()
    };
    _data = { ..._data, condos: [..._data.condos, newCondo] };
    idbPut('condos', newCondo);
    refresh();
    return newCondo;
  };

  const updateCondo = (id: string, data: Partial<Condo>) => {
    const updated = { ..._data.condos.find(c => c.id === id)!, ...data };
    _data = { ..._data, condos: _data.condos.map(c => c.id === id ? updated : c) };
    idbPut('condos', updated);
    refresh();
  };

  const deleteCondo = (id: string) => {
    _data = { ..._data, condos: _data.condos.filter(c => c.id !== id) };
    idbDelete('condos', id);
    refresh();
  };

  const blockCondo = (id: string) => {
    const condo = _data.condos.find(c => c.id === id);
    const updated = { ..._data.condos.find(c => c.id === id)!, blocked: true, blockedAt: new Date().toISOString() };
    _data = { ..._data, condos: _data.condos.map(c => c.id === id ? updated : c) };
    idbPut('condos', updated);
    const sindico = _data.users.find(u => u.condoId === id && u.role === 'sindico');
    if (sindico && condo) {
      const notif: Notification = { id: 'n' + uid(), userId: sindico.id, title: '🔒 Condomínio BLOQUEADO', message: `O condomínio "${condo.name}" foi bloqueado por inadimplência de licença.`, type: 'charge', read: false, createdAt: new Date().toISOString() };
      _data = { ..._data, notifications: [..._data.notifications, notif] };
      idbPut('notifications', notif);
    }
    refresh();
  };

  const unblockCondo = (id: string) => {
    const condo = _data.condos.find(c => c.id === id);
    const updated = { ..._data.condos.find(c => c.id === id)!, blocked: false, blockedAt: null as unknown as string };
    _data = { ..._data, condos: _data.condos.map(c => c.id === id ? updated : c) };
    idbPut('condos', updated);
    const sindico = _data.users.find(u => u.condoId === id && u.role === 'sindico');
    if (sindico && condo) {
      const notif: Notification = { id: 'n' + uid(), userId: sindico.id, title: '🔓 Condomínio DESBLOQUEADO', message: `O condomínio "${condo.name}" foi desbloqueado! Acesso restaurado para todos.`, type: 'charge', read: false, createdAt: new Date().toISOString() };
      _data = { ..._data, notifications: [..._data.notifications, notif] };
      idbPut('notifications', notif);
    }
    refresh();
  };

  // ── LICENSE CHARGES ────────────────────────────────────────────────────────
  const getLicenseCharges = (condoId?: string) =>
    condoId ? _data.licenseCharges.filter(l => l.condoId === condoId) : _data.licenseCharges;

  const addLicenseCharge = (
    data: Omit<LicenseCharge, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
  ) => {
    const newCharge: LicenseCharge = {
      ...data,
      id: data.id || ('lic' + uid()),
      createdAt: data.createdAt || new Date().toISOString()
    };
    _data = { ..._data, licenseCharges: [..._data.licenseCharges, newCharge] };
    idbPut('licenseCharges', newCharge);
    const sindico = _data.users.find(u => u.condoId === data.condoId && u.role === 'sindico');
    if (sindico) {
      const notif: Notification = { id: 'n' + uid(), userId: sindico.id, title: '💳 Nova cobrança de licença', message: `INOVATECH: ${data.description} - R$ ${data.amount.toFixed(2)}. Vence em ${data.dueDate}.`, type: 'charge', read: false, createdAt: new Date().toISOString() };
      _data = { ..._data, notifications: [..._data.notifications, notif] };
      idbPut('notifications', notif);
    }
    refresh();
    return newCharge;
  };

  const markLicenseViewed = (id: string, sindicoId: string) => {
    const charge = _data.licenseCharges.find(l => l.id === id);
    if (!charge || charge.viewedBySindico) return;
    const updated = { ...charge, viewedBySindico: true, viewedAt: new Date().toISOString() };
    _data = { ..._data, licenseCharges: _data.licenseCharges.map(l => l.id === id ? updated : l) };
    idbPut('licenseCharges', updated);
    const admin = _data.users.find(u => u.role === 'admin');
    if (admin) {
      const sindico = _data.users.find(u => u.id === sindicoId);
      const notif: Notification = { id: 'n' + uid(), userId: admin.id, title: '👁️ Cobrança visualizada', message: `Síndico "${sindico?.name ?? ''}" do condomínio "${charge.condoName}" visualizou a cobrança de licença (${charge.reference}).`, type: 'charge', read: false, createdAt: new Date().toISOString() };
      _data = { ..._data, notifications: [..._data.notifications, notif] };
      idbPut('notifications', notif);
    }
    refresh();
  };

  const markLicensePaid = (id: string) => {
    const charge = _data.licenseCharges.find(l => l.id === id);
    if (!charge) return;
    const updatedCharge = { ...charge, status: 'paid' as const, paidAt: new Date().toISOString() };
    _data = { ..._data, licenseCharges: _data.licenseCharges.map(l => l.id === id ? updatedCharge : l) };
    idbPut('licenseCharges', updatedCharge);
    const updatedCondo = { ..._data.condos.find(c => c.id === charge.condoId)!, blocked: false, blockedAt: null as unknown as string };
    _data = { ..._data, condos: _data.condos.map(c => c.id === charge.condoId ? updatedCondo : c) };
    idbPut('condos', updatedCondo);
    const sindico = _data.users.find(u => u.condoId === charge.condoId && u.role === 'sindico');
    if (sindico) {
      const notif: Notification = { id: 'n' + uid(), userId: sindico.id, title: '✅ Pagamento confirmado!', message: `Licença "${charge.reference}" confirmada. Acesso restaurado para todos os usuários.`, type: 'charge', read: false, createdAt: new Date().toISOString() };
      _data = { ..._data, notifications: [..._data.notifications, notif] };
      idbPut('notifications', notif);
    }
    refresh();
  };

  const deleteLicenseCharge = (id: string) => {
    _data = { ..._data, licenseCharges: _data.licenseCharges.filter(l => l.id !== id) };
    idbDelete('licenseCharges', id);
    refresh();
  };

  // ── INVOICES ───────────────────────────────────────────────────────────────
  const getInvoices = (condoId?: string) => condoId ? _data.invoices.filter(i => i.condoId === condoId) : _data.invoices;
  const getInvoicesByUser = (userId: string) => _data.invoices.filter(i => i.userId === userId);

  const addInvoice = (inv: Omit<Invoice, 'id' | 'createdAt'>) => {
    const newInv: Invoice = { ...inv, id: 'inv' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, invoices: [..._data.invoices, newInv] };
    idbPut('invoices', newInv);
    refresh();
    return newInv;
  };

  const markInvoicePaid = (id: string) => {
    const updated = { ..._data.invoices.find(i => i.id === id)!, status: 'paid' as const, paidAt: new Date().toISOString() };
    _data = { ..._data, invoices: _data.invoices.map(i => i.id === id ? updated : i) };
    idbPut('invoices', updated);
    refresh();
  };

  const deleteInvoice = (id: string) => {
    _data = { ..._data, invoices: _data.invoices.filter(i => i.id !== id) };
    idbDelete('invoices', id);
    refresh();
  };

  // ── DELIVERIES ─────────────────────────────────────────────────────────────
  const getDeliveries = (condoId?: string) => condoId ? _data.deliveries.filter(d => d.condoId === condoId) : _data.deliveries;
  const getDeliveriesByUnit = (unit: string) => _data.deliveries.filter(d => d.unit === unit);

  const addDelivery = (d: Omit<Delivery, 'id' | 'qrToken' | 'arrivedAt'>) => {
    const id = 'del' + uid();
    const newDel: Delivery = { ...d, id, qrToken: generateQRToken(id), arrivedAt: new Date().toISOString() };
    _data = { ..._data, deliveries: [..._data.deliveries, newDel] };
    idbPut('deliveries', newDel);
    const resident = _data.users.find(u => u.condoId === d.condoId && u.unit === d.unit);
    if (resident) {
      const notif: Notification = { id: 'n' + uid(), userId: resident.id, title: '📦 Nova encomenda chegou!', message: `Você tem uma encomenda de "${d.sender}" aguardando na portaria. Use seu QR Code para retirar.`, type: 'delivery', read: false, createdAt: new Date().toISOString() };
      _data = { ..._data, notifications: [..._data.notifications, notif] };
      idbPut('notifications', notif);
    }
    refresh();
    return newDel;
  };

  const confirmDeliveryByQR = (token: string): boolean => {
    const deliveryId = validateQRToken(token);
    if (!deliveryId) return false;
    const delivery = _data.deliveries.find(d => d.id === deliveryId && d.status === 'waiting');
    if (!delivery) return false;
    const updated = { ...delivery, status: 'delivered' as const, deliveredAt: new Date().toISOString() };
    _data = { ..._data, deliveries: _data.deliveries.map(d => d.id === deliveryId ? updated : d) };
    idbPut('deliveries', updated);
    const resident = _data.users.find(u => u.condoId === delivery.condoId && u.unit === delivery.unit);
    if (resident) {
      const notif: Notification = { id: 'n' + uid(), userId: resident.id, title: '✅ Encomenda retirada!', message: `Sua encomenda de "${delivery.sender}" foi retirada com sucesso via QR Code.`, type: 'delivery', read: false, createdAt: new Date().toISOString() };
      _data = { ..._data, notifications: [..._data.notifications, notif] };
      idbPut('notifications', notif);
    }
    refresh();
    return true;
  };

  // ── ANNOUNCEMENTS ──────────────────────────────────────────────────────────
  const getAnnouncements = (condoId?: string) => condoId ? _data.announcements.filter(a => a.condoId === condoId) : _data.announcements;

  const addAnnouncement = (a: Omit<Announcement, 'id' | 'createdAt'>) => {
    const newAnn: Announcement = { ...a, id: 'ann' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, announcements: [..._data.announcements, newAnn] };
    idbPut('announcements', newAnn);
    refresh();
    return newAnn;
  };

  const deleteAnnouncement = (id: string) => {
    _data = { ..._data, announcements: _data.announcements.filter(a => a.id !== id) };
    idbDelete('announcements', id);
    refresh();
  };

  // ── COMMON AREAS ───────────────────────────────────────────────────────────
  const getCommonAreas = (condoId?: string) => condoId ? _data.commonAreas.filter(a => a.condoId === condoId) : _data.commonAreas;

  const addCommonArea = (a: Omit<CommonArea, 'id'>) => {
    const newArea: CommonArea = { ...a, id: 'area' + uid() };
    _data = { ..._data, commonAreas: [..._data.commonAreas, newArea] };
    idbPut('commonAreas', newArea as unknown as { id: string });
    refresh();
    return newArea;
  };

  const updateCommonArea = (id: string, data: Partial<CommonArea>) => {
    const updated = { ..._data.commonAreas.find(a => a.id === id)!, ...data };
    _data = { ..._data, commonAreas: _data.commonAreas.map(a => a.id === id ? updated : a) };
    idbPut('commonAreas', updated as unknown as { id: string });
    refresh();
  };

  const deleteCommonArea = (id: string) => {
    const affectedIds = _data.reservations.filter(r => r.areaId === id).map(r => r.id);
    _data = {
      ..._data,
      commonAreas: _data.commonAreas.filter(a => a.id !== id),
      reservations: _data.reservations.map(r => r.areaId === id ? { ...r, status: 'cancelled' as const } : r),
    };
    idbDelete('commonAreas', id);
    _data.reservations.filter(r => affectedIds.includes(r.id)).forEach(r => idbPut('reservations', r));
    refresh();
  };

  // ── RESERVATIONS ───────────────────────────────────────────────────────────
  const getReservations = (condoId?: string) => condoId ? _data.reservations.filter(r => r.condoId === condoId) : _data.reservations;
  const getReservationsByUser = (userId: string) => _data.reservations.filter(r => r.userId === userId);

  const addReservation = (r: Omit<Reservation, 'id' | 'createdAt'>) => {
    const newRes: Reservation = { ...r, id: 'res' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, reservations: [..._data.reservations, newRes] };
    idbPut('reservations', newRes);
    refresh();
    return newRes;
  };

  const cancelReservation = (id: string, isManager = false): string | null => {
    const res = _data.reservations.find(r => r.id === id);
    if (!res) return null;
    const resDate = new Date(res.date);
    const now2 = new Date();
    const diffDays = (resDate.getTime() - now2.getTime()) / (1000 * 60 * 60 * 24);
    let fine = 0;
    if (!isManager && diffDays < 2) {
      fine = res.totalCost * 0.5;
      if (fine > 0) {
        addInvoice({ condoId: res.condoId, userId: res.userId, userName: res.userName, unit: res.unit, description: `Multa Cancelamento - ${res.areaName} (${res.date})`, amount: fine, dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], status: 'pending' });
      }
    }
    const updated = { ...res, status: 'cancelled' as const, cancelledAt: new Date().toISOString(), cancellationFine: fine };
    _data = { ..._data, reservations: _data.reservations.map(r => r.id === id ? updated : r) };
    idbPut('reservations', updated);
    refresh();
    return fine > 0 ? `Multa de R$ ${fine.toFixed(2)} aplicada por cancelamento tardio.` : null;
  };

  // ── VOTES ──────────────────────────────────────────────────────────────────
  const getVotes = (condoId?: string) => condoId ? _data.votes.filter(v => v.condoId === condoId) : _data.votes;

  const addVote = (v: Omit<Vote, 'id' | 'createdAt'>) => {
    const newVote: Vote = { ...v, id: 'v' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, votes: [..._data.votes, newVote] };
    idbPut('votes', newVote);
    refresh();
    return newVote;
  };

  const castVote = (voteId: string, optionId: string, userId: string): boolean => {
    const vote = _data.votes.find(v => v.id === voteId);
    if (!vote) return false;
    const alreadyVoted = vote.options.some(o => o.votes.includes(userId));
    if (alreadyVoted) return false;
    const updated = { ...vote, options: vote.options.map(o => o.id === optionId ? { ...o, votes: [...o.votes, userId] } : o) };
    _data = { ..._data, votes: _data.votes.map(v => v.id === voteId ? updated : v) };
    idbPut('votes', updated);
    refresh();
    return true;
  };

  const deleteVote = (id: string) => {
    _data = { ..._data, votes: _data.votes.filter(v => v.id !== id) };
    idbDelete('votes', id);
    refresh();
  };

  // ── COMPLAINTS ─────────────────────────────────────────────────────────────
  const getComplaints = (condoId?: string) => condoId ? _data.complaints.filter(c => c.condoId === condoId) : _data.complaints;

  const addComplaint = (c: Omit<Complaint, 'id' | 'createdAt'>) => {
    const newC: Complaint = { ...c, id: 'comp' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, complaints: [..._data.complaints, newC] };
    idbPut('complaints', newC);
    refresh();
    return newC;
  };

  const updateComplaint = (id: string, data: Partial<Complaint>) => {
    const updated = { ..._data.complaints.find(c => c.id === id)!, ...data };
    _data = { ..._data, complaints: _data.complaints.map(c => c.id === id ? updated : c) };
    idbPut('complaints', updated);
    refresh();
  };

  const deleteComplaint = (id: string) => {
    _data = { ..._data, complaints: _data.complaints.filter(c => c.id !== id) };
    idbDelete('complaints', id);
    refresh();
  };

  // ── MARKET ─────────────────────────────────────────────────────────────────
  const getMarketItems = (condoId?: string) => condoId ? _data.marketItems.filter(m => m.condoId === condoId) : _data.marketItems;

  const addMarketItem = (m: Omit<MarketItem, 'id' | 'createdAt'>) => {
    const newItem: MarketItem = { ...m, id: 'mkt' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, marketItems: [..._data.marketItems, newItem] };
    idbPut('marketItems', newItem);
    refresh();
    return newItem;
  };

  const deleteMarketItem = (id: string) => {
    _data = { ..._data, marketItems: _data.marketItems.filter(m => m.id !== id) };
    idbDelete('marketItems', id);
    refresh();
  };

  const markItemSold = (id: string) => {
    const updated = { ..._data.marketItems.find(m => m.id === id)!, status: 'sold' as const };
    _data = { ..._data, marketItems: _data.marketItems.map(m => m.id === id ? updated : m) };
    idbPut('marketItems', updated);
    refresh();
  };

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  const getNotifications = (userId: string) => _data.notifications.filter(n => n.userId === userId);

  const markNotificationRead = (id: string) => {
    const updated = { ..._data.notifications.find(n => n.id === id)!, read: true };
    _data = { ..._data, notifications: _data.notifications.map(n => n.id === id ? updated : n) };
    idbPut('notifications', updated);
    refresh();
  };

  const markAllRead = (userId: string) => {
    const updated = _data.notifications.map(n => n.userId === userId ? { ...n, read: true } : n);
    _data = { ..._data, notifications: updated };
    updated.filter(n => n.userId === userId).forEach(n => idbPut('notifications', n));
    refresh();
  };

  const addNotification = (n: Omit<Notification, 'id' | 'createdAt'>) => {
    const newN: Notification = { ...n, id: 'n' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, notifications: [..._data.notifications, newN] };
    idbPut('notifications', newN);
    refresh();
    return newN;
  };

  // ── PIX CONFIG ─────────────────────────────────────────────────────────────
  const getPixConfig = (condoId: string): PixConfig | null =>
    _data.pixConfigs.find(p => p.condoId === condoId) || null;

  const savePixConfig = (data: Omit<PixConfig, 'id' | 'updatedAt'>) => {
    const existing = _data.pixConfigs.find(p => p.condoId === data.condoId);
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
      _data = { ..._data, pixConfigs: _data.pixConfigs.map(p => p.condoId === data.condoId ? updated : p) };
      idbPut('pixConfigs', updated);
    } else {
      const newPix = { ...data, id: 'pix' + uid(), updatedAt: new Date().toISOString() };
      _data = { ..._data, pixConfigs: [..._data.pixConfigs, newPix] };
      idbPut('pixConfigs', newPix);
    }
    refresh();
  };

  // ── GATEWAY CONFIG ─────────────────────────────────────────────────────────
  const getGatewayConfig = () => _data.gatewayConfig;

  const saveGatewayConfig = (config: GatewayConfig) => {
    _data = { ..._data, gatewayConfig: config };
    idbPutSetting('gatewayConfig', config);
    refresh();
  };

  // ── EMPLOYEES ──────────────────────────────────────────────────────────────
  const getEmployees = (condoId?: string) => condoId ? _data.employees.filter(e => e.condoId === condoId) : _data.employees;

  const addEmployee = (e: Omit<Employee, 'id' | 'createdAt'>) => {
    const newEmp: Employee = { ...e, id: 'emp' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, employees: [..._data.employees, newEmp] };
    idbPut('employees', newEmp);
    refresh();
    return newEmp;
  };

  const updateEmployee = (id: string, data: Partial<Employee>) => {
    const updated = { ..._data.employees.find(e => e.id === id)!, ...data };
    _data = { ..._data, employees: _data.employees.map(e => e.id === id ? updated : e) };
    idbPut('employees', updated);
    refresh();
  };

  const deleteEmployee = (id: string) => {
    _data = { ..._data, employees: _data.employees.filter(e => e.id !== id) };
    idbDelete('employees', id);
    refresh();
  };

  // ── DOCUMENTS ──────────────────────────────────────────────────────────────
  const getDocuments = (condoId?: string) => condoId ? _data.documents.filter(d => d.condoId === condoId) : _data.documents;

  const addDocument = (doc: Omit<Document, 'id' | 'uploadedAt'>) => {
    const newDoc: Document = { ...doc, id: 'doc' + uid(), uploadedAt: new Date().toISOString() };
    _data = { ..._data, documents: [..._data.documents, newDoc] };
    idbPut('documents', newDoc);
    refresh();
    return newDoc;
  };

  const deleteDocument = (id: string) => {
    _data = { ..._data, documents: _data.documents.filter(d => d.id !== id) };
    idbDelete('documents', id);
    refresh();
  };

  // ── MAINTENANCE ────────────────────────────────────────────────────────────
  const getMaintenanceRequests = (condoId?: string) => condoId ? _data.maintenanceRequests.filter(m => m.condoId === condoId) : _data.maintenanceRequests;

  const addMaintenanceRequest = (m: Omit<MaintRequest, 'id' | 'createdAt'>) => {
    const newM: MaintRequest = { ...m, id: 'maint' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, maintenanceRequests: [..._data.maintenanceRequests, newM] };
    idbPut('maintenanceRequests', newM);
    refresh();
    return newM;
  };

  const updateMaintenanceRequest = (id: string, data: Partial<MaintRequest>) => {
    const updated = { ..._data.maintenanceRequests.find(m => m.id === id)!, ...data };
    _data = { ..._data, maintenanceRequests: _data.maintenanceRequests.map(m => m.id === id ? updated : m) };
    idbPut('maintenanceRequests', updated);
    refresh();
  };

  // ── ACCESS LOGS ────────────────────────────────────────────────────────────
  const getAccessLogs = (condoId?: string) => condoId ? _data.accessLogs.filter(a => a.condoId === condoId) : _data.accessLogs;

  const addAccessLog = (log: Omit<AccessLog, 'id' | 'time'>) => {
    const newLog: AccessLog = { ...log, id: 'acc' + uid(), time: new Date().toISOString() };
    _data = { ..._data, accessLogs: [..._data.accessLogs, newLog] };
    idbPut('accessLogs', newLog);
    refresh();
    return newLog;
  };

  // ── LOST & FOUND ───────────────────────────────────────────────────────────
  const getLostFound = (condoId?: string) => condoId ? _data.lostFound.filter(l => l.condoId === condoId) : _data.lostFound;

  const addLostFound = (item: Omit<LostFoundItem, 'id' | 'createdAt'>) => {
    const newItem: LostFoundItem = { ...item, id: 'lf' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, lostFound: [..._data.lostFound, newItem] };
    idbPut('lostFound', newItem);
    refresh();
    return newItem;
  };

  const updateLostFound = (id: string, data: Partial<LostFoundItem>) => {
    const updated = { ..._data.lostFound.find(l => l.id === id)!, ...data };
    _data = { ..._data, lostFound: _data.lostFound.map(l => l.id === id ? updated : l) };
    idbPut('lostFound', updated);
    refresh();
  };

  // ── SUPPORT MESSAGES ───────────────────────────────────────────────────────
  const getSupportMessages = (userId?: string) => userId ? _data.supportMessages.filter(m => m.userId === userId) : _data.supportMessages;

  const addSupportMessage = (msg: Omit<SupportMessage, 'id' | 'createdAt'>) => {
    const newMsg: SupportMessage = { ...msg, id: 'sup' + uid(), createdAt: new Date().toISOString() };
    _data = { ..._data, supportMessages: [..._data.supportMessages, newMsg] };
    idbPut('supportMessages', newMsg);
    refresh();
    return newMsg;
  };

  const markSupportRead = (userId: string) => {
    const updated = _data.supportMessages.map(m => m.userId === userId ? { ...m, read: true } : m);
    _data = { ..._data, supportMessages: updated };
    updated.filter(m => m.userId === userId).forEach(m => idbPut('supportMessages', m));
    refresh();
  };

  // ── RESET ──────────────────────────────────────────────────────────────────
  const resetAllData = async (): Promise<void> => {
    await Promise.all(DATA_STORES.map(s => dbClear(s)));
    await dbPutSetting('gatewayConfig', null);
    await dbPutSetting('db_initialized', false);
    _data = { ...INITIAL_DATA };
    await seedDatabase(_data);
    await dbPutSetting('db_initialized', true);
    refresh();
  };

  return {
    // users
    getUsers, getUsersByCondoId, addUser, updateUser, deleteUser,
    // condos
    getCondos, addCondo, updateCondo, deleteCondo, blockCondo, unblockCondo,
    // invoices
    getInvoices, getInvoicesByUser, addInvoice, markInvoicePaid, deleteInvoice,
    // deliveries
    getDeliveries, getDeliveriesByUnit, addDelivery, confirmDeliveryByQR,
    // announcements
    getAnnouncements, addAnnouncement, deleteAnnouncement,
    // areas
    getCommonAreas, addCommonArea, updateCommonArea, deleteCommonArea,
    // reservations
    getReservations, getReservationsByUser, addReservation, cancelReservation,
    // votes
    getVotes, addVote, castVote, deleteVote,
    // complaints
    getComplaints, addComplaint, updateComplaint, deleteComplaint,
    // market
    getMarketItems, addMarketItem, deleteMarketItem, markItemSold,
    // notifications
    getNotifications, markNotificationRead, markAllRead, addNotification,
    // license
    getLicenseCharges, addLicenseCharge, markLicenseViewed, markLicensePaid, deleteLicenseCharge,
    // employees
    getEmployees, addEmployee, updateEmployee, deleteEmployee,
    // pix
    getPixConfig, savePixConfig,
    // gateway
    getGatewayConfig, saveGatewayConfig,
    // documents
    getDocuments, addDocument, deleteDocument,
    // maintenance
    getMaintenanceRequests, addMaintenanceRequest, updateMaintenanceRequest,
    // access logs
    getAccessLogs, addAccessLog,
    // lost & found
    getLostFound, addLostFound, updateLostFound,
    // support
    getSupportMessages, addSupportMessage, markSupportRead,
    // util
    resetAllData,
  };
}
